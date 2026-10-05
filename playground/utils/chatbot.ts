/**
 * The Chart Bot's brain: a deterministic question router over the store data.
 *
 * Everything here is pure. The page fetches, hands over whatever it has, and
 * renders the returned blocks. That split is deliberate: the bot's behaviour is
 * unit-testable without a browser, a server or a database.
 *
 * Design notes worth keeping:
 *
 * - Matching is rule based rather than fuzzy. The vocabulary of a shop admin is
 *   small ("revenue", "stock", "best seller") and a scored keyword match answers
 *   it in microseconds with results that can be explained and tuned. A language
 *   model would add a network round trip per question and, more importantly,
 *   would be able to invent numbers. Everything printed below comes from a field
 *   of the payload.
 * - Rules are ordered most-specific first and the first hit wins, so
 *   "why did revenue drop in March" resolves to a diagnosis instead of falling
 *   through to the generic revenue answer.
 * - Each intent declares the datasets it needs, so the page only pays for the
 *   extra endpoints a given question actually uses.
 */
import type {
  AdminStats,
  Analytics,
  Category,
  Inventory,
  LowStockItem,
  Product,
  RevenueByMonth,
  Review,
} from '~/types/api'

import type { ChatBlock, ChatData, ChatDataset, ChatFormat, ChatIntent, ChatRankRow, ChatReply } from '~/types/chat'
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatMonth,
  formatNumber,
  humanize,
} from './format'
import { expandMonths, lastMonths } from './months'

/** How many months of analytics the bot loads, and the widest window it offers. */
export const CHAT_MONTHS = 12

const STATUS_TONES: Record<string, number> = {
  PENDING: 3,
  PAID: 2,
  PROCESSING: 1,
  SHIPPED: 0,
  DELIVERED: 2,
  CANCELLED: 4,
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sept: 9,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const currency = (value: number | string | null | undefined) => formatCurrency(value)
const compactCurrency = (value: number | string | null | undefined) => formatCompactCurrency(value)
const number = (value: number | string | null | undefined) => formatNumber(value)

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/** Whole percentage change, or null when there is no baseline to compare to. */
const pctChange = (current: number, previous: number) =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null

const changeWord = (change: number | null) => {
  if (change === null)
    return 'no comparable prior period'
  if (change > 0)
    return `up ${change}%`
  if (change < 0)
    return `down ${Math.abs(change)}%`
  return 'flat'
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`

/** The formatter a chart axis should use, chosen once when the block is built. */
export const chatFormatter = (format: ChatFormat) =>
  format === 'currency' ? compactCurrency : formatCompactNumber

/* -------------------------------------------------------------------------- */
/*                              Question parsing                              */
/* -------------------------------------------------------------------------- */

interface Question {
  raw: string
  text: string
  tokens: string[]
  /** "top 3", "top ten" — an explicit row limit the user asked for. */
  limit?: number
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twenty: 20,
}

const parseQuestion = (raw: string): Question => {
  const text = raw.trim().toLowerCase()
  const limitMatch = text.match(/\btop\s+(\d{1,2})\b/)
  const wordMatch = text.match(/\btop\s+(one|two|three|four|five|six|seven|eight|nine|ten|twenty)\b/)
  const digits = limitMatch?.[1] ? Number(limitMatch[1]) : undefined
  const words = wordMatch?.[1] ? WORD_NUMBERS[wordMatch[1]] : undefined
  const limit = digits && digits > 0 && digits <= 50 ? digits : words

  return {
    raw: raw.trim(),
    text,
    tokens: text.split(/[^a-z0-9$%.-]+/).filter(Boolean),
    limit,
  }
}

const has = (question: Question, ...needles: string[]) => {
  const haystack = ` ${question.text} `

  return needles.some(needle => haystack.includes(needle))
}

/** Regexes are pre-compiled once; they are matched against every question. */
interface Rule {
  intent: ChatIntent
  pattern: RegExp
}

const RULES: Rule[] = [
  { intent: 'greeting', pattern: /^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b/ },
  { intent: 'thanks', pattern: /\b(thanks|thank you|cheers|nice one|perfect)\b/ },
  {
    intent: 'help',
    pattern: /\b(help|what can you (do|answer|ask)|how do i use|commands|examples|capabilities|who are you)\b/,
  },
  { intent: 'forecast', pattern: /\b(forecast|predict|projection|project|next month|next quarter|expect(ed)?)\b/ },
  {
    intent: 'diagnose',
    pattern: /\b(why|what.s wrong|explain|reason|cause|diagnos\w*|drop\w*|fell|falling|decline\w*|problem|struggl\w*|underperform\w*)\b/,
  },
  { intent: 'ratings', pattern: /\b(review\w*|rating\w*|rate[sd]?|star\w*|satisfact\w*|nps|csat)\b/ },
  {
    intent: 'inventory',
    pattern: /\b(stock|inventory|restock|reorder|warehouse|out of stock|low stock|units on hand|backorder)\b/,
  },
  {
    intent: 'payments',
    pattern: /\b(payment\w*|paid|pay|card|cash|stripe|paypal|wallet|bank transfer|refund\w*|transaction\w*|checkout method|tender)\b/,
  },
  {
    intent: 'customers',
    pattern: /\b(customer\w*|client\w*|user\w*|signup\w*|sign ?up|register\w*|audience|buyers?|shoppers?|retention|cohort)\b/,
  },
  {
    intent: 'categories',
    pattern: /\b(categor\w*|collection\w*|department\w*|line\w*|segment\w*|vertical)\b/,
  },
  {
    intent: 'products',
    pattern: /\b(product\w*|item\w*|sku\w*|best ?sell\w*|top ?sell\w*|seller\w*|winner\w*|slow ?mov\w*|dead ?stock\w*|catalogue|catalog)\b/,
  },
  {
    intent: 'aov',
    pattern: /\b(average order|basket ?size|aov|average (order )?value|average spend|spend per|ticket size|average basket)\b/,
  },
  {
    intent: 'orders',
    pattern: /\b(order\w*|checkout\w*|purchase\w*|cart\w*|basket\w*|fulfil\w*|shipping\w*|deliver\w*|pending|cancelled|canceled|status)\b/,
  },
  {
    intent: 'revenue',
    pattern: /\b(revenue|sales|sold|money|earn\w*|income|turnover|topline|gmv|margin\w*|profit\w*)\b/,
  },
  {
    intent: 'month',
    pattern: new RegExp(
      `\\b(month\\w*|${MONTH_NAMES.join('|')}|${Object.keys(MONTH_ALIASES).join('|')}|quarter|ytd|year to date|week\\w*)\\b`,
    ),
  },
  {
    intent: 'overview',
    pattern: /\b(overview|summar\w*|how\s+(is|are)\s+(the\s+\w+\s+|it\s+|we\s+)?(going|doing|performing)|status|dashboard|health|performance|kpi\w*|snapshot|how are we|how.s my store|anything (i|to) (should|know))\b/,
  },
]

/**
 * Every rule that matched, strongest signal last. Exposed so the fallback can
 * suggest a nearby question instead of just shrugging.
 */
const rankIntents = (question: Question) =>
  RULES
    .map((rule, index) => ({ intent: rule.intent, index, hit: rule.pattern.test(question.text) }))
    .filter(entry => entry.hit)

export const classify = (question: Question): ChatIntent =>
  rankIntents(question)[0]?.intent ?? 'unknown'

/** Questions worth offering when nothing matched well. */
const nearestIntents = (question: Question): ChatIntent[] => {
  const scored = rankIntents(question)

  if (scored.length > 0)
    return scored.map(entry => entry.intent)

  // Nothing matched at all, so fall back to token overlap with the examples.
  const examples = SUGGESTIONS.map(entry => ({ ...entry, overlap: overlapScore(question, entry.label) }))
    .sort((a, b) => b.overlap - a.overlap)

  return [...new Set(examples.slice(0, 3).map(entry => entry.intent))]
}

const overlapScore = (question: Question, label: string) => {
  const labelTokens = new Set(label.toLowerCase().split(/[^a-z]+/).filter(Boolean))
  const hits = question.tokens.filter(token => labelTokens.has(token)).length

  return hits / Math.max(1, Math.min(question.tokens.length, labelTokens.size))
}

/** The example questions offered in the empty state and after every reply. */
export const SUGGESTIONS: { label: string, intent: ChatIntent }[] = [
  { label: 'How is the store doing?', intent: 'overview' },
  { label: 'Show me the revenue trend', intent: 'revenue' },
  { label: 'How did last month go?', intent: 'month' },
  { label: 'Why did revenue change?', intent: 'diagnose' },
  { label: 'What are my top 5 products?', intent: 'products' },
  { label: 'Which category earns the most?', intent: 'categories' },
  { label: 'What is running out of stock?', intent: 'inventory' },
  { label: 'Which payment method wins?', intent: 'payments' },
  { label: 'How many new customers?', intent: 'customers' },
  { label: 'What is my average order value?', intent: 'aov' },
  { label: 'What do the orders look like?', intent: 'orders' },
  { label: 'What do customers rate us?', intent: 'ratings' },
  { label: 'Forecast next month', intent: 'forecast' },
  { label: 'What should I work on?', intent: 'help' },
]

/** Datasets each intent needs beyond `/admin/stats` and `/admin/analytics`. */
const INTENT_DATASETS: Partial<Record<ChatIntent, ChatDataset[]>> = {
  product: ['products', 'inventory', 'reviews'],
  products: ['products'],
  categories: ['categories'],
  inventory: ['inventory', 'products'],
  ratings: ['reviews', 'products'],
}

/** Only these intents get promoted to a single-product answer by name match. */
const PRODUCT_OVERRIDABLE: ChatIntent[] = ['inventory', 'ratings', 'products', 'unknown']

export const datasetsForIntent = (intent: ChatIntent): ChatDataset[] => INTENT_DATASETS[intent] ?? []

/* -------------------------------------------------------------------------- */
/*                              Series assembly                               */
/* -------------------------------------------------------------------------- */

interface Window {
  months: string[]
  label: string
}

interface Series {
  revenue: RevenueByMonth[]
  orders: number[]
  units: number[]
  customers: number[]
}

/**
 * A gap-free month axis for the loaded window. The API only returns months that
 * have rows, so the axis is rebuilt here exactly as the analytics page does it:
 * one dropped month would shift every later value one slot to the left.
 */
const buildAxis = (analytics: Analytics | null, fallbackMonths: number): string[] => {
  const seen = [
    ...(analytics?.revenueByMonth ?? []).map(row => row.month),
    ...(analytics?.customersByMonth ?? []).map(row => row.month),
    ...(analytics?.unitsByMonth ?? []).map(row => row.month),
  ]

  return seen.length ? expandMonths(seen) : lastMonths(fallbackMonths)
}

const buildSeries = (analytics: Analytics | null, months: string[]): Series => {
  const revenue = new Map((analytics?.revenueByMonth ?? []).map(row => [row.month, row]))
  const units = new Map((analytics?.unitsByMonth ?? []).map(row => [row.month, row.units]))
  const customers = new Map((analytics?.customersByMonth ?? []).map(row => [row.month, row.count]))

  return {
    revenue: months.map(month => revenue.get(month) ?? { month, total: '0', orders: 0 }),
    orders: months.map(month => revenue.get(month)?.orders ?? 0),
    units: months.map(month => units.get(month) ?? 0),
    customers: months.map(month => customers.get(month) ?? 0),
  }
}

/**
 * Month number named in the question, or undefined. Word boundaries matter:
 * "may" is both a month and an English modal, so a bare `includes('may')` would
 * pull every "what may I ask" into the month branch.
 */
const namedMonth = (text: string) => {
  for (const [index, name] of MONTH_NAMES.entries()) {
    if (new RegExp(`\\b${name}\\b`).test(text))
      return index + 1
  }

  for (const [alias, index] of Object.entries(MONTH_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(text))
      return index
  }

  return undefined
}

/**
 * Reads a time window out of the question. "last month", "in March", "top of the
 * last 6 months" and "year to date" all resolve to concrete month keys, and
 * anything unrecognised falls back to the whole loaded window.
 */
const resolveWindow = (question: Question, axis: string[]): Window => {
  const full = { months: axis, label: `the last ${axis.length} months` }
  const { text } = question

  const named = namedMonth(text)
  const yearMatch = text.match(/\b(20\d{2})\b/)

  if (named) {
    const month = String(named).padStart(2, '0')

    if (yearMatch) {
      const key = `${yearMatch[1]}-${month}`

      // An explicit year is taken at face value even outside the loaded axis:
      // the caller reports "no data" rather than silently answering a different
      // month than the one that was asked about.
      return { months: [key], label: formatMonth(key) }
    }

    // With no year, take the most recent occurrence inside the axis so "in
    // March" means this March rather than March three years ago.
    const match = axis.filter(key => key.endsWith(`-${month}`)).at(-1)

    return match
      ? { months: [match], label: formatMonth(match) }
      : { months: [], label: 'that month' }
  }

  if (has(question, 'year to date', 'ytd')) {
    const months = axis.filter(key => key.startsWith(`${new Date().getUTCFullYear()}-`))

    return { months: months.length ? months : axis, label: 'year to date' }
  }

  if (has(question, 'last month', 'previous month', 'past month')) {
    const previous = axis.at(-2)

    return previous
      ? { months: [previous], label: formatMonth(previous) }
      : { months: axis.slice(-1), label: 'the latest month' }
  }

  if (has(question, 'this month', 'current month', 'so far this month')) {
    const current = axis.at(-1)

    return current
      ? { months: [current], label: formatMonth(current) }
      : { months: axis.slice(-1), label: 'the latest month' }
  }

  // Weekly granularity is not in the payload, so a "this week" question is
  // answered against the month containing it rather than being refused.
  if (has(question, 'week')) {
    const current = axis.at(-1)

    return { months: current ? [current] : [], label: 'this month' }
  }

  if (has(question, 'quarter')) {
    const months = axis.slice(-3)

    return { months, label: 'the last quarter' }
  }

  const rangeMatch = text.match(/\b(?:last|past|previous|over|in the)\s+(\d{1,2})\s*(?:month|months|mo)\b/)

  if (rangeMatch) {
    const count = Math.max(1, Number(rangeMatch[1]))
    const months = axis.slice(-count)

    return { months, label: `the last ${months.length} months` }
  }

  return full
}

const windowRevenue = (series: Series, months: string[]) => {
  const rows = series.revenue.filter(row => months.includes(row.month))

  return {
    total: sum(rows.map(row => Number(row.total))),
    orders: sum(rows.map(row => row.orders)),
  }
}

/** Sums a per-month series over the window. All series are index-aligned. */
const windowSum = (values: number[], series: Series, months: string[]) =>
  sum(values.filter((_, index) => months.includes(series.revenue[index]!.month)))

const averageOrderValue = (revenue: number, orders: number) => (orders > 0 ? revenue / orders : 0)

/* -------------------------------------------------------------------------- */
/*                              Intent builders                               */
/* -------------------------------------------------------------------------- */

interface BuildContext {
  question: Question
  stats: AdminStats
  analytics: Analytics
  axis: string[]
  series: Series
}

/** Share of the loaded axis that the resolved window covers, as a percentage. */
const windowCoverage = (months: string[], axis: string[]) =>
  Math.round((axis.filter(key => months.includes(key)).length / Math.max(1, axis.length)) * 100)

const buildOverview = ({ question, stats, analytics, series, axis }: BuildContext): ChatReply => {
  const window = resolveWindow(question, axis)
  const months = window.months
  const revenue = windowRevenue(series, months)
  const units = windowSum(series.units, series, months)
  const aov = averageOrderValue(revenue.total, revenue.orders)

  const coverage = windowCoverage(months, axis)
  const emptyStore = stats.totalOrders === 0

  const blocks: ChatBlock[] = [
    {
      kind: 'metrics',
      caption: window.label === 'the last 12 months' ? 'All time' : `Last ${months.length} months`,
      items: [
        {
          label: 'Revenue',
          value: currency(stats.totalRevenue),
          hint: `${currency(revenue.total)} in ${window.label}`,
          change: analytics.changes.revenue,
          tone: 0,
        },
        {
          label: 'Orders',
          value: number(stats.totalOrders),
          hint: `${number(revenue.orders)} in ${window.label}`,
          change: analytics.changes.orders,
          tone: 1,
        },
        {
          label: 'Average order value',
          value: currency(analytics.averageOrderValue),
          hint: `${currency(aov)} in ${window.label}`,
          change: analytics.changes.averageOrderValue,
          tone: 2,
        },
        {
          label: 'Customers',
          value: number(stats.totalCustomers),
          hint: `${number(stats.totalUsers)} registered accounts`,
          tone: 5,
        },
      ],
    },
    {
      kind: 'trend',
      caption: `Revenue by month · ${coverage}% of the loaded window is covered`,
      points: series.revenue.map(row => ({ label: formatMonth(row.month), value: Number(row.total) })),
      format: 'currency',
      tone: 0,
    },
    {
      kind: 'note',
      tone: stats.lowStockCount > 0 ? 'warn' : 'good',
      text: stats.lowStockCount > 0
        ? `${plural(stats.lowStockCount, 'product')} ${stats.lowStockCount === 1 ? 'is' : 'are'} at or below the low stock threshold, and ${number(units)} units moved in ${window.label}.`
        : `Stock levels are healthy and ${plural(units, 'unit')} moved in ${window.label}.`,
    },
  ]

  if (!emptyStore && stats.recentOrders.length) {
    blocks.splice(2, 0, {
      kind: 'rank',
      caption: 'Most recent checkouts',
      rows: stats.recentOrders.slice(0, 3).map(order => ({
        label: `#${order.id} · ${order.user?.name || order.user?.email || 'Guest'}`,
        value: currency(order.total),
        detail: `${humanize(order.status)} · ${formatMonth(order.createdAt.slice(0, 7))}`,
      })),
    })
  }

  return {
    intent: 'overview',
    headline: emptyStore
      ? 'The store is live but no orders have come through yet.'
      : `Revenue is ${changeWord(analytics.changes.revenue)} over ${window.label}, at ${currency(revenue.total)} across ${plural(revenue.orders, 'order')}.`,
    blocks,
    suggestions: emptyStore
      ? ['What is running out of stock?', 'Which payment method wins?', 'What do customers rate us?']
      : ['What should I work on?', 'Why did revenue change?', 'Show me the revenue trend', 'What is running out of stock?'],
  }
}

const buildRevenue = ({ question, stats, analytics, series, axis }: BuildContext): ChatReply => {
  const window = resolveWindow(question, axis)
  const revenue = windowRevenue(series, window.months)
  const best = series.revenue.reduce<RevenueByMonth | null>((top, row) => (!top || Number(row.total) > Number(top.total) ? row : top), null)
  const worst = series.revenue.reduce<RevenueByMonth | null>((bottom, row) => (!bottom || Number(row.total) < Number(bottom.total) ? row : bottom), null)
  const firstHalf = windowRevenue(series, window.months.slice(0, Math.ceil(window.months.length / 2)))
  const secondHalf = windowRevenue(series, window.months.slice(Math.ceil(window.months.length / 2)))
  const shapeChange = pctChange(secondHalf.total, firstHalf.total)

  return {
    intent: 'revenue',
    headline: window.months.length > 1
      ? `${currency(revenue.total)} came in across ${plural(revenue.orders, 'order')} in ${window.label}, ${changeWord(analytics.changes.revenue)} on the previous period.`
      : `${currency(revenue.total)} in ${plural(revenue.orders, 'order')} for ${window.label}.`,
    blocks: [
      {
        kind: 'metrics',
        items: [
          {
            label: `Revenue · ${window.label}`,
            value: currency(revenue.total),
            hint: `${number(revenue.orders)} orders`,
            tone: 0,
          },
          {
            label: 'All-time revenue',
            value: currency(stats.totalRevenue),
            hint: `${plural(stats.fulfilledOrders, 'fulfilled order')}`,
            tone: 1,
          },
          {
            label: 'Best month',
            value: best ? currency(best.total) : '—',
            hint: best ? `${formatMonth(best.month)} · ${number(best.orders)} orders` : 'No revenue yet',
            tone: 2,
          },
          {
            label: 'Second half vs first',
            value: shapeChange === null ? '—' : `${shapeChange > 0 ? '+' : ''}${shapeChange}%`,
            hint: `${currency(firstHalf.total)} → ${currency(secondHalf.total)}`,
            tone: 3,
          },
        ],
      },
      {
        kind: 'trend',
        caption: `Monthly revenue${window.months.length === series.revenue.length ? '' : ` · ${window.label}`}`,
        points: series.revenue.map(row => ({ label: formatMonth(row.month), value: Number(row.total) })),
        format: 'currency',
        tone: 0,
      },
      {
        kind: 'note',
        tone: shapeChange !== null && shapeChange < -5 ? 'warn' : 'info',
        text: worst && Number(worst.total) === 0
          ? `${formatMonth(worst.month)} recorded no revenue at all, which is the low point of the loaded window.`
          : `The slowest month is ${worst ? formatMonth(worst.month) : '—'} at ${currency(worst?.total ?? 0)}, ${currency(Math.abs(Number(best?.total ?? 0) - Number(worst?.total ?? 0)))} behind ${best ? formatMonth(best.month) : 'the peak'}.`,
      },
    ],
    suggestions: ['Why did revenue change?', 'How did last month go?', 'What are my top 5 products?', 'Forecast next month'],
  }
}

const buildMonth = ({ question, series, axis }: BuildContext): ChatReply => {
  const window = resolveWindow(question, axis)

  if (!window.months.length) {
    return {
      intent: 'month',
      headline: 'That month falls outside the loaded window, so there is nothing to compare it against.',
      blocks: [{ kind: 'note', tone: 'warn', text: `I have ${axis.length} months of history loaded. Try one of the months in the trend chart.` }],
      suggestions: ['Show me the revenue trend', 'How is the store doing?'],
    }
  }

  const month = window.months.at(-1)!
  const row = series.revenue.find(entry => entry.month === month)!
  const index = series.revenue.findIndex(entry => entry.month === month)
  const previous = index > 0 ? series.revenue[index - 1] : undefined
  const revenueChange = previous ? pctChange(Number(row.total), Number(previous.total)) : null
  const ordersChange = previous ? pctChange(row.orders, previous.orders) : null
  const rank = [...series.revenue]
    .sort((a, b) => Number(b.total) - Number(a.total))
    .findIndex(entry => entry.month === month) + 1
  const aov = averageOrderValue(Number(row.total), row.orders)
  const units = series.units[index] ?? 0
  const newCustomers = series.customers[index] ?? 0

  return {
    intent: 'month',
    headline: revenueChange === null
      ? `${formatMonth(month)} brought in ${currency(row.total)} from ${plural(row.orders, 'order')}.`
      : `${formatMonth(month)} brought in ${currency(row.total)}, ${changeWord(revenueChange)} month on month.`,
    blocks: [
      {
        kind: 'metrics',
        caption: formatMonth(month),
        items: [
          { label: 'Revenue', value: currency(row.total), change: revenueChange, hint: `Rank #${rank} of ${series.revenue.length}`, tone: 0 },
          { label: 'Orders', value: number(row.orders), change: ordersChange, hint: `${currency(aov)} average order`, tone: 1 },
          { label: 'Units sold', value: number(units), hint: row.orders ? `${(units / row.orders).toFixed(1)} per order` : 'No orders', tone: 3 },
          { label: 'New customers', value: number(newCustomers), hint: 'Signed up that month', tone: 5 },
        ],
      },
      {
        kind: 'columns',
        caption: 'Orders by month',
        points: series.revenue.map(entry => ({ label: formatMonth(entry.month), value: entry.orders })),
        format: 'number',
        tone: 1,
      },
      {
        kind: 'note',
        tone: revenueChange === null ? 'info' : (revenueChange > 0 ? 'good' : 'warn'),
        text: revenueChange === null
          ? 'This is the first month in the loaded window, so there is no prior month to compare it to.'
          : ordersChange !== null && Math.abs(ordersChange) > Math.abs(revenueChange)
            ? `Volume moved the number: orders were ${changeWord(ordersChange)} while revenue was ${changeWord(revenueChange)}.`
            : `Basket size carried the change: revenue was ${changeWord(revenueChange)} on ${changeWord(ordersChange)} orders.`,
      },
    ],
    suggestions: ['Why did revenue change?', 'What are my top 5 products?', 'Which category earns the most?', 'Forecast next month'],
  }
}

const buildDiagnose = ({ analytics, series }: BuildContext): ChatReply => {
  const current = series.revenue.at(-1)
  const previous = series.revenue.at(-2)

  if (!current || !previous) {
    return {
      intent: 'diagnose',
      headline: 'I need at least two months of history to explain a change.',
      blocks: [{ kind: 'note', tone: 'warn', text: `Only ${series.revenue.length} month of history is loaded.` }],
      suggestions: ['Show me the revenue trend', 'How is the store doing?'],
    }
  }

  const currentRevenue = Number(current.total)
  const previousRevenue = Number(previous.total)
  const revenueChange = pctChange(currentRevenue, previousRevenue)
  const ordersChange = pctChange(current.orders, previous.orders)
  const currentAov = averageOrderValue(currentRevenue, current.orders)
  const previousAov = averageOrderValue(previousRevenue, previous.orders)
  const aovChange = pctChange(currentAov, previousAov)

  // Revenue is roughly orders × basket size. Splitting the delta across the two
  // terms says which one the manager should actually go and fix.
  const volumeEffect = (current.orders - previous.orders) * previousAov
  const basketEffect = previous.orders * (currentAov - previousAov)
  const volumeLeads = Math.abs(volumeEffect) >= Math.abs(basketEffect)
  const dominantShare = Math.round((Math.max(Math.abs(volumeEffect), Math.abs(basketEffect)) / Math.max(1, Math.abs(currentRevenue - previousRevenue))) * 100)

  const cancelled = analytics.orderStatusBreakdown.find(row => row.status === 'CANCELLED')?.count ?? 0
  const totalOrders = sum(analytics.orderStatusBreakdown.map(row => row.count))
  const stalled = (analytics.orderStatusBreakdown.find(row => row.status === 'PENDING')?.count ?? 0)
  const stalledShare = totalOrders > 0 ? Math.round((stalled / totalOrders) * 100) : 0

  // A month that starts from zero has no percentage, so the comparison switches
  // to absolute figures rather than reporting a meaningless "no baseline".
  const movement = previousRevenue === 0
    ? currentRevenue === 0
      ? 'flat, with neither month recording revenue'
      : `${currency(currentRevenue - previousRevenue)} more than ${formatMonth(previous.month)}, which recorded nothing`
    : `${changeWord(revenueChange)} against ${formatMonth(previous.month)}`

  const driver = volumeLeads
    ? `${plural(Math.abs(current.orders - previous.orders), 'order')} of volume (${changeWord(ordersChange)}) explains about ${Math.min(100, dominantShare)}% of the swing.`
    : `Basket size (${changeWord(aovChange)}) explains about ${Math.min(100, dominantShare)}% of the swing, on ${changeWord(ordersChange)} orders.`

  return {
    intent: 'diagnose',
    headline: `${formatMonth(current.month)} revenue moved ${movement}. ${driver}`,
    blocks: [
      {
        kind: 'metrics',
        caption: `${formatMonth(previous.month)} vs ${formatMonth(current.month)}`,
        items: [
          { label: 'Revenue', value: currency(currentRevenue), change: revenueChange, hint: `Was ${currency(previousRevenue)}`, tone: 0 },
          { label: 'Orders', value: number(current.orders), change: ordersChange, hint: `Was ${number(previous.orders)}`, tone: 1 },
          { label: 'Average order value', value: currency(currentAov), change: aovChange, hint: `Was ${currency(previousAov)}`, tone: 2 },
        ],
      },
      {
        kind: 'trend',
        caption: 'Where the change sits in the trend',
        points: series.revenue.map(row => ({ label: formatMonth(row.month), value: Number(row.total) })),
        format: 'currency',
        tone: 0,
      },
      {
        kind: 'rank',
        caption: 'What changed',
        rows: [
          { label: 'Volume effect (orders × old basket)', value: `${volumeEffect >= 0 ? '+' : ''}${currency(volumeEffect)}`, detail: `${changeWord(ordersChange)} orders` },
          { label: 'Basket effect (old orders × new basket)', value: `${basketEffect >= 0 ? '+' : ''}${currency(basketEffect)}`, detail: `${changeWord(aovChange)} basket size` },
          { label: 'Net revenue movement', value: `${currentRevenue - previousRevenue >= 0 ? '+' : ''}${currency(currentRevenue - previousRevenue)}`, detail: `${changeWord(revenueChange)}` },
        ],
      },
      {
        kind: 'note',
        tone: revenueChange !== null && revenueChange < 0 ? 'warn' : 'good',
        text: stalled > 0
          ? `${plural(stalled, 'order')} ${stalled === 1 ? 'is' : 'are'} still sitting in PENDING, ${stalledShare}% of the pipeline's ${number(totalOrders)} orders. Clearing those is the fastest revenue you can unlock.`
          : cancelled > 0 && totalOrders > 0
            ? `${number(cancelled)} cancelled orders sit in the same window, ${Math.round((cancelled / totalOrders) * 100)}% of all orders.`
            : 'No orders are stuck in PENDING, so nothing is being held back by fulfilment.',
      },
    ],
    suggestions: ['What are my top 5 products?', 'Which category earns the most?', 'What is running out of stock?', 'Forecast next month'],
  }
}

const buildOrders = ({ question, analytics, stats, series, axis }: BuildContext): ChatReply => {
  const window = resolveWindow(question, axis)
  const revenue = windowRevenue(series, window.months)
  const totalOrders = sum(analytics.orderStatusBreakdown.map(row => row.count))
  const delivered = analytics.orderStatusBreakdown
    .filter(row => row.status === 'DELIVERED' || row.status === 'SHIPPED')
    .reduce((carry, row) => carry + row.count, 0)
  const cancelled = analytics.orderStatusBreakdown.find(row => row.status === 'CANCELLED')?.count ?? 0
  const pending = analytics.orderStatusBreakdown.find(row => row.status === 'PENDING')?.count ?? 0

  const slices = analytics.orderStatusBreakdown.map((row, index) => ({
    label: humanize(row.status),
    value: row.count,
    tone: STATUS_TONES[row.status] ?? index,
  }))

  return {
    intent: 'orders',
    headline: `${plural(totalOrders, 'order')} on record, ${Math.round((delivered / Math.max(1, totalOrders - cancelled)) * 100)}% of which reached the customer.`,
    blocks: [
      {
        kind: 'metrics',
        caption: window.label,
        items: [
          { label: `Orders · ${window.label}`, value: number(revenue.orders), hint: `${currency(revenue.total)} of revenue`, tone: 1 },
          { label: 'Delivered or shipped', value: number(delivered), hint: `of ${number(Math.max(0, totalOrders - cancelled))} eligible`, tone: 2 },
          { label: 'Awaiting fulfilment', value: number(pending), hint: 'Still in PENDING', tone: 3 },
          { label: 'Cancelled', value: number(cancelled), hint: `${Math.round((cancelled / Math.max(1, totalOrders)) * 100)}% of all orders`, tone: 4 },
        ],
      },
      {
        kind: 'columns',
        caption: 'Orders closed per month',
        points: series.revenue.map(row => ({ label: formatMonth(row.month), value: row.orders })),
        format: 'number',
        tone: 1,
      },
      { kind: 'donut', caption: 'Where orders sit right now', slices, format: 'number' },
      {
        kind: 'note',
        tone: pending > 0 ? 'warn' : 'good',
        text: pending > 0
          ? `${plural(pending, 'order')} still need fulfilment. Every one of them is revenue already collected but not delivered.`
          : `Nothing is stuck in PENDING, and ${plural(cancelled, 'order')} have been cancelled all time.`,
      },
      ...(stats.recentOrders.length
        ? [{
            kind: 'columns' as const,
            caption: 'Revenue behind the order count',
            points: series.revenue.map(row => ({ label: formatMonth(row.month), value: Number(row.total) })),
            format: 'currency' as const,
            tone: 0,
          }]
        : []),
    ],
    suggestions: ['What is my average order value?', 'Which payment method wins?', 'Why did revenue change?', 'How did last month go?'],
  }
}

const buildAov = ({ analytics, series, axis }: BuildContext): ChatReply => {
  const points = series.revenue.map((row) => {
    return { label: formatMonth(row.month), value: averageOrderValue(Number(row.total), row.orders) }
  })
  const withOrders = points.filter(point => point.value > 0)
  const best = withOrders.reduce<(typeof points)[number] | null>((top, point) => (!top || point.value > top.value ? point : top), null)
  const worst = withOrders.reduce<(typeof points)[number] | null>((bottom, point) => (!bottom || point.value < bottom.value ? point : bottom), null)
  const unitsPerOrder = analytics.currentPeriod.orders > 0 ? analytics.currentPeriod.units / analytics.currentPeriod.orders : 0

  return {
    intent: 'aov',
    headline: `Average order value is ${currency(analytics.averageOrderValue)}, ${changeWord(analytics.changes.averageOrderValue)} on the previous period.`,
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: 'Average order value', value: currency(analytics.averageOrderValue), change: analytics.changes.averageOrderValue, tone: 0 },
          { label: 'Best month', value: best ? currency(best.value) : '—', hint: best ? best.label : 'No orders yet', tone: 1 },
          { label: 'Weakest month', value: worst ? currency(worst.value) : '—', hint: worst ? worst.label : 'No orders yet', tone: 2 },
          { label: 'Units per order', value: unitsPerOrder.toFixed(1), hint: 'Basket depth', tone: 3 },
        ],
      },
      {
        kind: 'trend',
        caption: 'Average order value by month',
        points,
        format: 'currency',
        tone: 2,
      },
      {
        kind: 'note',
        tone: 'info',
        text: unitsPerOrder < 1.5 && unitsPerOrder > 0
          ? `Orders carry ${unitsPerOrder.toFixed(1)} units each, so a bundle or a free-shipping threshold is the cheapest lever on this number.`
          : `Orders carry ${unitsPerOrder.toFixed(1)} units each, which is already a deep basket.`,
      },
      {
        kind: 'note',
        tone: 'info',
        text: `Computed over ${axis.length} loaded months.`,
      },
    ],
    suggestions: ['What are my top 5 products?', 'Which category earns the most?', 'What do the orders look like?', 'Why did revenue change?'],
  }
}

const buildProducts = ({ question, analytics, stats }: BuildContext): ChatReply => {
  const limit = Math.min(question.limit ?? 5, analytics.topProducts.length || 5)
  const rows = analytics.topProducts.slice(0, limit)
  const totalRevenue = sum(analytics.topProducts.map(row => Number(row.revenue)))
  const totalUnits = sum(analytics.topProducts.map(row => row.unitsSold))
  const leader = rows[0]
  const leaderShare = leader && totalRevenue > 0 ? Math.round((Number(leader.revenue) / totalRevenue) * 100) : 0
  const topThree = sum(rows.slice(0, 3).map(row => Number(row.revenue)))
  const concentration = totalRevenue > 0 ? Math.round((topThree / totalRevenue) * 100) : 0

  return {
    intent: 'products',
    headline: leader
      ? `${leader.name} leads with ${currency(leader.revenue)} across ${plural(leader.unitsSold, 'unit')}.`
      : 'No products have sold yet, so there is no ranking to show.',
    blocks: [
      {
        kind: 'rank',
        caption: `Top ${rows.length} by revenue`,
        empty: 'No products have sold yet.',
        rows: rows.map<ChatRankRow>((row, index) => ({
          label: row.name,
          value: currency(row.revenue),
          detail: `${number(row.unitsSold)} units · ${totalRevenue > 0 ? Math.round((Number(row.revenue) / totalRevenue) * 100) : 0}% of tracked revenue`,
          tone: index,
        })),
      },
      {
        kind: 'metrics',
        items: [
          { label: 'Tracked revenue', value: currency(totalRevenue), hint: `${plural(rows.length, 'product')} in the ranking`, tone: 0 },
          { label: 'Units sold', value: number(totalUnits), hint: 'Across the ranking', tone: 3 },
          { label: 'Leader share', value: `${leaderShare}%`, hint: leader ? leader.name : '—', tone: 2 },
          { label: 'Top 3 concentration', value: `${concentration}%`, hint: 'Share of tracked revenue', tone: 5 },
        ],
      },
      {
        kind: 'note',
        tone: concentration > 70 ? 'warn' : 'info',
        text: concentration > 70
          ? `${rows.slice(0, 3).length} products carry ${concentration}% of tracked revenue. That is a concentration risk: a stock-out on any one of them hits the whole period.`
          : `Revenue is spread across ${plural(rows.length, 'product')} rather than concentrated in a few hero SKUs.`,
      },
      {
        kind: 'note',
        tone: stats.lowStockCount > 0 ? 'warn' : 'info',
        text: stats.lowStockCount > 0
          ? `${plural(stats.lowStockCount, 'product')} ${stats.lowStockCount === 1 ? 'is' : 'are'} at or below the low stock threshold, which is where a bestseller quietly stops selling.`
          : 'Nothing is at or below its low stock threshold, so the ranking is not being capped by stockouts.',
      },
    ],
    suggestions: ['What is running out of stock?', 'Which category earns the most?', 'What do customers rate us?', 'How is the store doing?'],
  }
}

/** Crude singular form, enough to make "lamps" match "Lamp". */
const stem = (token: string) => token.replace(/(?:ies|es|s)$/u, '')

/**
 * How much of a catalogue name the question names.
 *
 * Scored as name coverage rather than question coverage: "how many aura lamps
 * are left in stock" names the product even though most of the sentence is
 * filler, so a long question must not penalise a good match. A whole-token hit
 * counts double a prefix hit, so "aura" cannot beat "aura lamp".
 */
const nameScore = (question: string, name: string) => {
  const questionTokens = new Set(question.split(/[^a-z0-9]+/).filter(token => token.length > 1).map(stem))
  const nameTokens = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

  if (!nameTokens.length)
    return 0

  let score = 0

  for (const token of nameTokens) {
    if (questionTokens.has(token) || questionTokens.has(stem(token)))
      score += 2
    else if (questionTokens.has(token.slice(0, 4)) && token.length > 4)
      score += 1
  }

  return score / (nameTokens.length * 2)
}

/**
 * The best catalogue match for a question, or null when nothing is close enough.
 *
 * Shared by the router and the product answer so both agree on what "close
 * enough" means. A loose threshold would answer "what is running out of stock"
 * with one arbitrary product instead of the restock list.
 */
const matchProduct = (question: string, products: Product[] | undefined) => {
  const candidates = (products ?? [])
    .map(product => ({ product, score: nameScore(question, product.name) }))
    // Half the name has to be named, and at least one token has to be a full
    // word in the name. Without the second condition a two-word name matched on
    // a single four-letter prefix would qualify.
    .filter(entry => entry.score >= 0.5)
    .sort((a, b) => b.score - a.score)

  return candidates[0] ?? null
}

const buildProductAnswer = (
  question: Question,
  products: Product[] | undefined,
  categories: Category[] | undefined,
  inventory: Inventory[] | undefined,
  reviews: Review[] | undefined,
  stats: AdminStats,
  analytics: Analytics,
): ChatReply => {
  const best = matchProduct(question.text, products)

  if (!best) {
    return {
      intent: 'product',
      headline: products?.length ? 'No product in the catalogue matches that name.' : 'The catalogue is not loaded for this question.',
      blocks: [{
        kind: 'note',
        tone: 'info',
        text: 'Ask using part of the product name, for example "how many units of the aura lamp are left".',
      }],
      suggestions: ['What are my top 5 products?', 'What is running out of stock?', 'Which category earns the most?'],
    }
  }

  const product = best.product
  const stock = inventory?.find(row => row.productId === product.id)
  const sold = analytics.topProducts.find(row => row.productId === product.id)
  const productReviews = (reviews ?? []).filter(review => review.productId === product.id)
  const rating = productReviews.length
    ? productReviews.reduce((carry, review) => carry + review.rating, 0) / productReviews.length
    : null
  const available = stock ? stock.quantity - stock.reserved : product.stock ?? null
  const category = categories?.find(row => row.id === product.categoryId)
  const rank = analytics.topProducts.findIndex(row => row.productId === product.id)

  const status = available === null
    ? 'info'
    : (available <= 0 ? 'warn' : (stock && available <= stock.lowStockThreshold ? 'warn' : 'good'))

  return {
    intent: 'product',
    headline: `${product.name} — ${sold ? `${currency(sold.revenue)} across ${plural(sold.unitsSold, 'unit')}` : 'no recorded sales yet'}.`,
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: 'Price', value: currency(product.price), hint: product.originalPrice ? `Was ${currency(product.originalPrice)}` : undefined, tone: 0 },
          { label: 'Units sold', value: sold ? number(sold.unitsSold) : '—', hint: sold && rank >= 0 ? `Rank #${rank + 1} by revenue` : undefined, tone: 1 },
          { label: 'Available', value: available === null ? '—' : number(available), hint: stock ? `${number(stock.quantity)} on hand · ${number(stock.reserved)} reserved` : 'No inventory record', tone: 2 },
          { label: 'Rating', value: rating === null ? '—' : `${rating.toFixed(1)} / 5`, hint: `${plural(productReviews.length, 'review')}`, tone: 4 },
        ],
      },
      {
        kind: 'note',
        tone: status,
        text: status === 'warn'
          ? `Stock is the constraint: ${available === null ? 'no inventory record exists' : `${number(available)} units are sellable`}, which is at or below the low stock threshold of ${number(stock?.lowStockThreshold ?? 0)}.`
          : `There is room to sell: ${available === null ? 'stock is unknown' : `${number(available)} units are sellable`} against a threshold of ${number(stock?.lowStockThreshold ?? 0)}.`,
      },
      ...(category
        ? [{ kind: 'note' as const, tone: 'info' as const, text: `Sits in ${category.name}${product.brand ? ` under ${product.brand.name}` : ''}, priced at ${currency(product.price)}${product.isActive ? '' : ' but the listing is inactive'}.` }]
        : []),
    ],
    suggestions: ['What are my top 5 products?', 'What is running out of stock?', 'Which category earns the most?', 'What do customers rate us?'],
  }
}

const buildCategories = ({ data, analytics }: { data: Category[] | undefined, analytics: Analytics }): ChatReply => {
  const rows = analytics.revenueByCategory.filter(row => Number(row.revenue) > 0)
  const total = sum(rows.map(row => Number(row.revenue)))
  const leader = rows[0]

  return {
    intent: 'categories',
    headline: leader
      ? `${leader.name} is the biggest earner at ${currency(leader.revenue)}, ${total > 0 ? Math.round((Number(leader.revenue) / total) * 100) : 0}% of category revenue.`
      : 'No category has recorded revenue yet.',
    blocks: [
      {
        kind: 'rank',
        caption: 'Revenue by category',
        empty: 'No category revenue yet. It appears once orders include categorised products.',
        rows: rows.map<ChatRankRow>((row, index) => ({
          label: data?.find(category => category.id === row.categoryId)?.name ?? row.name,
          value: currency(row.revenue),
          detail: `${number(row.units)} units · ${total > 0 ? Math.round((Number(row.revenue) / total) * 100) : 0}%`,
          tone: index,
        })),
      },
      {
        kind: 'donut',
        caption: 'Share of category revenue',
        slices: rows.slice(0, 6).map((row, index) => ({
          label: data?.find(category => category.id === row.categoryId)?.name ?? row.name,
          value: Number(row.revenue),
          tone: index,
        })),
        format: 'currency',
      },
      ...(rows.length > 1
        ? [{
            kind: 'note' as const,
            tone: 'info' as const,
            text: `${rows[0]!.name} leads ${rows[1]!.name} by ${currency(Math.abs(Number(rows[0]!.revenue) - Number(rows[1]!.revenue)))} on revenue, while ${rows[0]!.name} sells ${number(rows[0]!.units)} units against ${number(rows[1]!.units)}.`,
          }]
        : []),
    ],
    suggestions: ['What are my top 5 products?', 'How is the store doing?', 'Why did revenue change?', 'What is running out of stock?'],
  }
}

const buildInventory = ({ data, analytics, stats }: { data: Inventory[] | undefined, analytics: Analytics, stats: AdminStats }): ChatReply => {
  const items = analytics.lowStockItems
  const outOfStock = items.filter((item: LowStockItem) => item.quantity === 0)
  const inventoryRows = data ?? []
  const totalUnits = stats.totalInventoryUnits
  const reserved = sum(inventoryRows.map(row => row.reserved))
  const sellable = Math.max(0, totalUnits - reserved)

  const rows = items.map<ChatRankRow>((item, _index) => ({
    label: item.name,
    value: `${number(item.quantity)} left`,
    detail: `Threshold ${number(item.threshold)} · ${number(item.reserved)} reserved`,
    tone: item.quantity === 0 ? 4 : 3,
  }))

  return {
    intent: 'inventory',
    headline: items.length
      ? `${plural(items.length, 'product')} ${items.length === 1 ? 'is' : 'are'} at or below the low stock threshold, ${outOfStock.length} of them at zero.`
      : 'Stock levels are healthy. Nothing is at or below its low stock threshold.',
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: 'Units on hand', value: number(totalUnits), hint: `${number(reserved)} reserved`, tone: 3 },
          { label: 'Sellable now', value: number(sellable), hint: 'On hand minus reserved', tone: 2 },
          { label: 'Low stock', value: number(stats.lowStockCount), hint: 'At or below threshold', tone: 3 },
          { label: 'Out of stock', value: number(outOfStock.length), hint: 'Zero on hand', tone: 4 },
        ],
      },
      {
        kind: 'rank',
        caption: 'Restock list, tightest first',
        empty: 'Stock levels are healthy.',
        rows,
      },
      {
        kind: 'note',
        tone: outOfStock.length > 0 ? 'warn' : items.length > 0 ? 'info' : 'good',
        text: outOfStock.length > 0
          ? `${outOfStock.map(item => item.name).slice(0, 3).join(', ')}${outOfStock.length > 3 ? ` and ${outOfStock.length - 3} more` : ''} ${outOfStock.length === 1 ? 'is' : 'are'} at zero units, so ${outOfStock.length === 1 ? 'it is' : 'they are'} not contributing revenue at all.`
          : items.length > 0
            ? `${plural(items.length, 'item')} need replenishing, but none are at zero yet.`
            : `Every tracked product is above its threshold, with ${number(sellable)} units sellable.`,
      },
    ],
    suggestions: ['What are my top 5 products?', 'Which category earns the most?', 'How is the store doing?', 'Why did revenue change?'],
  }
}

const buildPayments = ({ stats, analytics }: { stats: AdminStats, analytics: Analytics }): ChatReply => {
  const rows = analytics.paymentMethodBreakdown.filter(row => Number(row.amount) > 0)
  const total = sum(rows.map(row => Number(row.amount)))
  const leader = rows[0]
  const successRate = stats.totalPayments > 0 ? Math.round((stats.paidPayments / stats.totalPayments) * 100) : 0

  return {
    intent: 'payments',
    headline: leader
      ? `${humanize(leader.method)} is the leading tender at ${currency(leader.amount)}, ${total > 0 ? Math.round((Number(leader.amount) / total) * 100) : 0}% of collected volume.`
      : 'No payments have been recorded yet.',
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: 'Collected', value: currency(total), hint: `${plural(rows.reduce((carry, row) => carry + row.count, 0), 'payment')}`, tone: 2 },
          { label: 'Successful', value: `${successRate}%`, hint: `${number(stats.paidPayments)} of ${number(stats.totalPayments)}`, tone: 1 },
          { label: 'Failed', value: number(stats.failedPayments), hint: `${Math.round((stats.failedPayments / Math.max(1, stats.totalPayments)) * 100)}% of attempts`, tone: 4 },
          { label: 'Average payment', value: currency(averageOrderValue(total, rows.reduce((carry, row) => carry + row.count, 0))), tone: 0 },
        ],
      },
      {
        kind: 'donut',
        caption: 'Collected volume by method',
        slices: rows.map((row, index) => ({ label: humanize(row.method), value: Number(row.amount), tone: index })),
        format: 'currency',
      },
      {
        kind: 'rank',
        caption: 'Payments by method',
        empty: 'No payments recorded yet.',
        rows: rows.map<ChatRankRow>((row, index) => ({
          label: humanize(row.method),
          value: currency(row.amount),
          detail: `${plural(row.count, 'payment')} · ${total > 0 ? Math.round((Number(row.amount) / total) * 100) : 0}%`,
          tone: index,
        })),
      },
      {
        kind: 'note',
        tone: successRate >= 90 ? 'good' : 'warn',
        text: stats.totalPayments === 0
          ? 'No payment attempts have been recorded, so there is no tender mix to compare yet.'
          : successRate >= 90
            ? `${successRate}% of payment attempts succeed. That is healthy: a failed payment is revenue you already spent marketing on and did not collect.`
            : `${successRate}% of payment attempts succeed, so roughly ${number(stats.failedPayments)} orders lost their money somewhere in checkout.`,
      },
    ],
    suggestions: ['What do the orders look like?', 'What is my average order value?', 'How is the store doing?', 'Why did revenue change?'],
  }
}

const buildCustomers = ({ analytics, series, stats }: { analytics: Analytics, series: Series, stats: AdminStats }): ChatReply => {
  const period = analytics.currentPeriod
  const points = series.customers.map((count, index) => ({ label: formatMonth(series.revenue[index]!.month), value: count }))
  const best = points.reduce<(typeof points)[number] | null>((top, point) => (!top || point.value > top.value ? point : top), null)
  const recent = sum(points.slice(-3).map(point => point.value))
  const prior = sum(points.slice(-6, -3).map(point => point.value))

  return {
    intent: 'customers',
    headline: `${plural(period.newCustomers, 'new customer')} signed up in the current period, against ${number(prior)} in the three months before it.`,
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: 'Customers', value: number(stats.totalCustomers), hint: `${number(stats.totalUsers)} registered accounts`, tone: 5 },
          { label: 'New this period', value: number(period.newCustomers), hint: `vs ${number(analytics.previousPeriod.orders)} orders placed`, tone: 1 },
          { label: 'Best month', value: best ? number(best.value) : '—', hint: best ? best.label : 'No signups yet', tone: 2 },
          { label: 'Last 3 months', value: number(recent), hint: prior > 0 ? `Was ${number(prior)}` : 'No prior window', tone: 3 },
        ],
      },
      {
        kind: 'columns',
        caption: 'New customers per month',
        points,
        format: 'number',
        tone: 5,
      },
      {
        kind: 'note',
        tone: recent >= prior ? 'good' : 'warn',
        text: prior > 0
          ? `Signups over the last three months are ${changeWord(pctChange(recent, prior))} on the three before that.`
          : 'There is not enough history to compare signup momentum yet.',
      },
    ],
    suggestions: ['What is my average order value?', 'What do the orders look like?', 'How is the store doing?', 'Why did revenue change?'],
  }
}

const buildRatings = ({ stats, analytics, reviews, products }: { stats: AdminStats, analytics: Analytics, reviews?: Review[], products?: Product[] }): ChatReply => {
  const rows = reviews ?? []
  const distribution = new Map<number, number>()
  for (const review of rows) {
    distribution.set(review.rating, (distribution.get(review.rating) ?? 0) + 1)
  }

  const average = stats.averageRating
  const worst = rows
    .reduce<Review | null>((bottom, review) => (!bottom || review.rating < bottom.rating ? review : bottom), null)
  const best = rows
    .reduce<Review | null>((top, review) => (!top || review.rating > top.rating ? review : top), null)

  const topRated = [...(products ?? [])]
    .filter(product => (product.ratingCount ?? 0) > 0)
    .sort((a, b) => Number(b.ratingAverage) - Number(a.ratingAverage))
    .slice(0, 5)

  const fiveStarShare = rows.length ? Math.round(((distribution.get(5) ?? 0) / rows.length) * 100) : 0
  const oneStarShare = rows.length ? Math.round(((distribution.get(1) ?? 0) / rows.length) * 100) : 0

  return {
    intent: 'ratings',
    headline: average === null
      ? 'Nothing has been rated yet, so there is no satisfaction signal to read.'
      : `Customers rate the store ${average.toFixed(1)} out of 5 across ${plural(stats.totalReviews, 'review')}.`,
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: 'Average rating', value: average === null ? '—' : `${average.toFixed(1)} / 5`, hint: `${plural(stats.totalReviews, 'review')}`, tone: 4 },
          { label: 'Five star share', value: rows.length ? `${fiveStarShare}%` : '—', hint: `${number(distribution.get(5) ?? 0)} reviews`, tone: 2 },
          { label: 'One star share', value: rows.length ? `${oneStarShare}%` : '—', hint: `${number(distribution.get(1) ?? 0)} reviews`, tone: 4 },
          { label: 'Rated products', value: number(new Set(rows.map(row => row.productId)).size), hint: `${number(stats.totalProducts)} in catalogue`, tone: 5 },
        ],
      },
      ...(rows.length
        ? [{
            kind: 'columns' as const,
            caption: 'Rating distribution',
            points: [5, 4, 3, 2, 1].map(stars => ({ label: `${stars} star`, value: distribution.get(stars) ?? 0 })),
            format: 'number' as const,
            tone: 4,
          }]
        : []),
      {
        kind: 'rank',
        caption: 'Highest rated products',
        empty: 'No product has a rating yet.',
        rows: topRated.map<ChatRankRow>((product, index) => ({
          label: product.name,
          value: `${Number(product.ratingAverage).toFixed(1)} / 5`,
          detail: `${number(product.ratingCount ?? 0)} ratings`,
          tone: index,
        })),
      },
      {
        kind: 'note',
        tone: average !== null && average >= 4 ? 'good' : 'warn',
        text: worst && worst.rating <= 2
          ? `The weakest review sits at ${worst.rating} star on ${products?.find(product => product.id === worst.productId)?.name ?? `product #${worst.productId}`}. That is the one to reply to.`
          : best && best.rating === 5
            ? `Nothing is rated below ${Math.min(...rows.map(row => row.rating))} stars. Keep replying to new reviews, since that is what keeps them coming.`
            : 'Spread the response effort across the lowest-rated products first.',
      },
      ...(analytics.topProducts.length
        ? [{
            kind: 'note' as const,
            tone: 'info' as const,
            text: `${analytics.topProducts.length} products carry all tracked revenue, so their ratings move revenue more than any other signal.`,
          }]
        : []),
    ],
    suggestions: ['What are my top 5 products?', 'What is running out of stock?', 'How is the store doing?', 'Why did revenue change?'],
  }
}

const buildForecast = ({ series, analytics }: { series: Series, analytics: Analytics }): ChatReply => {
  const values = series.revenue.map(row => Number(row.total))
  const count = values.length
  const last = series.revenue.at(-1)

  if (count < 3 || !last) {
    return {
      intent: 'forecast',
      headline: 'There is not enough history to project from yet.',
      blocks: [{ kind: 'note', tone: 'warn', text: `I need at least three months of revenue, and only ${count} ${count === 1 ? 'is' : 'are'} loaded.` }],
      suggestions: ['Show me the revenue trend', 'How is the store doing?'],
    }
  }

  // Least squares on the monthly totals. Linear rather than seasonal because the
  // loaded window is short, and a seasonal fit on a partial year invents a peak
  // that the data never showed.
  const n = count
  const sumX = (n * (n - 1)) / 2
  const sumY = sum(values)
  const sumXY = values.reduce((carry, value, index) => carry + index * value, 0)
  const sumXX = values.reduce((carry, _value, index) => carry + index * index, 0)
  const denominator = n * sumXX - sumX * sumX
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  const projection = Math.max(0, intercept + slope * n)

  const nextMonthKey = (() => {
    const [year, month] = last.month.split('-').map(Number)
    const next = new Date(Date.UTC(year!, month!, 1))

    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
  })()

  const projectedOrders = analytics.currentPeriod.orders > 0
    ? Math.round(projection / (Number(analytics.averageOrderValue) || 1))
    : 0
  const accuracy = count >= 6 ? 'fit over the loaded window' : 'a short-window fit, so treat it as directional only'

  return {
    intent: 'forecast',
    headline: `Linear trend puts ${formatMonth(nextMonthKey)} at roughly ${currency(projection)}, from ${currency(Number(last.total))} this month.`,
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: `Projected ${formatMonth(nextMonthKey)}`, value: currency(projection), hint: 'Least-squares on monthly revenue', tone: 0 },
          { label: 'Monthly slope', value: `${slope >= 0 ? '+' : ''}${compactCurrency(slope)}`, hint: slope >= 0 ? 'Trending up' : 'Trending down', tone: slope >= 0 ? 2 : 4 },
          { label: 'Implied orders', value: number(projectedOrders), hint: 'At the current average order value', tone: 1 },
          { label: 'Run rate', value: compactCurrency(sumY / n), hint: 'Mean of the loaded months', tone: 3 },
        ],
      },
      {
        kind: 'trend',
        caption: `History plus the ${formatMonth(nextMonthKey)} projection`,
        points: [
          ...series.revenue.map(row => ({ label: formatMonth(row.month), value: Number(row.total) })),
          { label: `${formatMonth(nextMonthKey)} (proj.)`, value: projection },
        ],
        format: 'currency',
        tone: 0,
      },
      {
        kind: 'note',
        tone: 'info',
        text: `This is an extrapolation (${accuracy}), not a promise. It assumes the last ${count} months keep repeating and ignores seasonality, stock-outs and campaigns.`,
      },
    ],
    suggestions: ['Why did revenue change?', 'What are my top 5 products?', 'What is running out of stock?', 'How is the store doing?'],
  }
}

const buildHelp = (): ChatReply => ({
  intent: 'help',
  headline: 'I answer questions about this store using its own data, and I only show numbers that came from the API.',
  blocks: [
    {
      kind: 'rank',
      caption: 'Things you can ask',
      rows: [
        { label: 'Store health', detail: '"How is the store doing?", "What should I work on?"' },
        { label: 'Revenue and trend', detail: '"Show me the revenue trend", "How did last month go?"' },
        { label: 'Why it moved', detail: '"Why did revenue change?", "Why are orders down?"' },
        { label: 'Products and categories', detail: '"What are my top 5 products?", "Which category earns the most?"' },
        { label: 'A single product', detail: '"How many units of <product name> are left?"' },
        { label: 'Stock and inventory', detail: '"What is running out of stock?"' },
        { label: 'Payments', detail: '"Which payment method wins?"' },
        { label: 'Customers and ratings', detail: '"How many new customers?", "What do customers rate us?"' },
        { label: 'Planning', detail: '"Forecast next month"' },
      ],
    },
    {
      kind: 'note',
      tone: 'info',
      text: 'Tip: ask about a specific month ("how did March go") or name a product directly. Everything is read live, so refresh the page after a change elsewhere and ask again.',
    },
  ],
  suggestions: SUGGESTIONS.slice(0, 4).map(entry => entry.label),
})

const buildThanks = (): ChatReply => ({
  intent: 'thanks',
  headline: 'Any time. Ask again whenever the data moves.',
  blocks: [],
  suggestions: ['Why did revenue change?', 'What is running out of stock?', 'Forecast next month'],
})

const buildGreeting = (): ChatReply => ({
  intent: 'greeting',
  headline: 'I am the Chart Bot. I read this store\'s live data, so every number I give you is one the dashboard would also show.',
  blocks: [
    {
      kind: 'note',
      tone: 'info',
      text: 'Ask a question in plain words. I understand revenue, orders, products, categories, stock, payments, customers, ratings and forecasts.',
    },
  ],
  suggestions: SUGGESTIONS.slice(0, 4).map(entry => entry.label),
})

/* -------------------------------------------------------------------------- */
/*                                   Router                                   */
/* -------------------------------------------------------------------------- */

/**
 * Stand-in payloads for when only one of the two aggregate endpoints answered.
 * Every builder reads `stats` and `analytics` as non-null, so a zeroed shape is
 * cheaper and safer than threading null checks through a dozen functions. The
 * resulting reply is honest about it: totals read as zero rather than throwing.
 */
const ZERO_STATS: AdminStats = {
  totalOrders: 0,
  pendingOrders: 0,
  cancelledOrders: 0,
  fulfilledOrders: 0,
  totalRevenue: '0',
  totalProducts: 0,
  activeProducts: 0,
  inactiveProducts: 0,
  totalCustomers: 0,
  totalUsers: 0,
  totalBrands: 0,
  totalCategories: 0,
  totalInventoryUnits: 0,
  lowStockCount: 0,
  totalReviews: 0,
  averageRating: null,
  totalPayments: 0,
  paidPayments: 0,
  failedPayments: 0,
  revenueByMonth: [],
  orderStatusBreakdown: [],
  recentOrders: [],
  topProducts: [],
}

const EMPTY_ANALYTICS: Analytics = {
  months: CHAT_MONTHS,
  revenueByMonth: [],
  orderStatusBreakdown: [],
  revenueByCategory: [],
  topProducts: [],
  lowStockItems: [],
  customersByMonth: [],
  unitsByMonth: [],
  currentPeriod: { revenue: '0', orders: 0, units: 0, newCustomers: 0 },
  previousPeriod: { revenue: '0', orders: 0 },
  changes: { revenue: null, orders: null, averageOrderValue: null },
  averageOrderValue: '0',
  paymentMethodBreakdown: [],
  catalogueHealth: { totalProducts: 0, activeProducts: 0, inactiveProducts: 0 },
}

/**
 * Words that appear in a question about one specific product. They signal that
 * the catalogue is worth loading, but on their own they say nothing about which
 * product: "what is running out of stock" contains "stock" and is not a question
 * about a single item.
 */
const PRODUCT_SIGNAL = /\b(?:product|item|stock|inventory|left|price|rating|review|sold|sell|units|sku)\b/

/**
 * Resolves a question to an intent, and to the datasets that intent needs.
 *
 * Called before the answer is built, so `answerQuestion` can be handed a
 * complete `ChatData` on the first attempt. Without this the product and
 * inventory answers would fall back to their "not loaded" branch the first time
 * anyone asked about a product.
 *
 * `catalogue` is optional and the composable calls this twice: once to find out
 * what to fetch, then again with the catalogue in hand so a product name can
 * win the routing. A named product outranks the keyword rules, but only where a
 * keyword answer would not be more useful, so "what is running out of stock"
 * stays on the restock list rather than answering about one arbitrary product.
 */
export const routeQuestion = (
  raw: string,
  catalogue?: Product[],
): { intent: ChatIntent, datasets: ChatDataset[] } => {
  const question = parseQuestion(raw)
  const keywordIntent = classify(question)

  const named = PRODUCT_OVERRIDABLE.includes(keywordIntent)
    ? matchProduct(question.text, catalogue)
    : null

  const intent: ChatIntent = named ? 'product' : keywordIntent
  const datasets = datasetsForIntent(intent)

  // The catalogue can turn a keyword match into a product answer on the second
  // pass, so it is always fetched when the question carries a per-product signal.
  if (!named && PRODUCT_SIGNAL.test(question.text) && !datasets.includes('products'))
    datasets.push('products')

  return { intent, datasets }
}

/**
 * The single entry point the page calls. Pure: same question plus same data
 * always produces the same reply, which is what makes it testable.
 */
export const answerQuestion = (raw: string, data: ChatData): ChatReply => {
  const question = parseQuestion(raw)

  if (!question.text)
    return { intent: 'unknown', headline: 'Ask me anything about the store and I will answer from live data.', blocks: [], suggestions: SUGGESTIONS.slice(0, 4).map(entry => entry.label) }

  if (!data.analytics && !data.stats) {
    return {
      intent: 'unknown',
      headline: 'I could not load the store data, so I have nothing to answer with.',
      blocks: [{ kind: 'note', tone: 'warn', text: 'The analytics endpoints did not respond. Check the API is reachable and that you are signed in as an admin.' }],
      suggestions: [],
    }
  }

  const stats = data.stats ?? ZERO_STATS
  const analytics = data.analytics ?? EMPTY_ANALYTICS

  const axis = buildAxis(analytics, analytics.months || CHAT_MONTHS)
  const series = buildSeries(analytics, axis)
  const { intent } = routeQuestion(raw, data.products)
  const context: BuildContext = { question, stats, analytics, axis, series }

  switch (intent) {
    case 'greeting':
      return buildGreeting()
    case 'thanks':
      return buildThanks()
    case 'help':
      return buildHelp()
    case 'overview':
      return buildOverview(context)
    case 'revenue':
      return buildRevenue(context)
    case 'month':
      return buildMonth(context)
    case 'forecast':
      return buildForecast(context)
    case 'diagnose':
      return buildDiagnose(context)
    case 'orders':
      return buildOrders(context)
    case 'aov':
      return buildAov(context)
    case 'products':
      return buildProducts(context)
    case 'product':
      return buildProductAnswer(question, data.products, data.categories, data.inventory, data.reviews, stats, analytics)
    case 'categories':
      return buildCategories({ data: data.categories, analytics })
    case 'inventory':
      return buildInventory({ data: data.inventory, analytics, stats })
    case 'payments':
      return buildPayments({ stats, analytics })
    case 'customers':
      return buildCustomers({ analytics, series, stats })
    case 'ratings':
      return buildRatings({ stats, analytics, reviews: data.reviews, products: data.products })
    default: {
      const near = describeIntents(nearestIntents(question))

      return {
        intent: 'unknown',
        headline: near
          ? `I do not track that, but it sounds close to a question about ${near}.`
          : 'I do not track that, so I cannot answer it from the store data.',
        blocks: [{
          kind: 'note',
          tone: 'info',
          text: 'I can only answer from what this store records: revenue, orders, products, categories, stock, payments, customers, ratings and projections.',
        }],
        suggestions: SUGGESTIONS.slice(0, 4).map(entry => entry.label),
      }
    }
  }
}

const INTENT_NOUNS: Partial<Record<ChatIntent, string>> = {
  overview: 'overall performance',
  revenue: 'revenue',
  month: 'a specific month',
  forecast: 'the forecast',
  diagnose: 'why revenue moved',
  orders: 'orders',
  aov: 'average order value',
  products: 'top products',
  product: 'a single product',
  categories: 'categories',
  inventory: 'stock levels',
  payments: 'payments',
  customers: 'customers',
  ratings: 'ratings',
}

const describeIntents = (intents: ChatIntent[]) =>
  [...new Set(intents.map(intent => INTENT_NOUNS[intent]).filter(Boolean))].slice(0, 2).join(' or ')
