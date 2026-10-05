import type {
  AdminStats,
  Analytics,
  Category,
  Inventory,
  Product,
  Review,
} from '~/types/api'
import type { ChartPoint, ChartSlice } from '~/types/chart'

export type ChatRole = 'user' | 'assistant'

/** Number formatting a chart or metric should use, resolved at build time. */
export type ChatFormat = 'currency' | 'number'

export interface ChatMetric {
  label: string
  value: string
  hint?: string
  /** Whole percentage against the comparable prior period. Null = no baseline. */
  change?: number | null
  /** Index into the chart palette. */
  tone?: number
}

export interface ChatRankRow {
  label: string
  /** Right-aligned figure. Omitted for label-only rows, e.g. the help list. */
  value?: string
  detail?: string
  tone?: number
}

/**
 * A rendered answer is a list of these rather than markdown text: every block
 * maps to a real admin component, so a reply looks like the rest of the app
 * instead of a wall of asterisks.
 */
export type ChatBlock
  = | { kind: 'metrics', caption?: string, items: ChatMetric[] }
    | { kind: 'trend', caption?: string, points: ChartPoint[], format: ChatFormat, tone?: number }
    | { kind: 'columns', caption?: string, points: ChartPoint[], format: ChatFormat, tone?: number }
    | { kind: 'donut', caption?: string, slices: ChartSlice[], format: ChatFormat }
    | { kind: 'rank', caption?: string, rows: ChatRankRow[], empty?: string }
    | { kind: 'note', tone: 'info' | 'good' | 'warn', text: string }

export interface ChatReply {
  intent: ChatIntent
  /** One sentence above the blocks. Never restates the question. */
  headline: string
  blocks: ChatBlock[]
  /** Tap-to-ask follow ups. */
  suggestions: string[]
}

export interface ChatMessage {
  id: number
  role: ChatRole
  /** Raw question, or the reply headline for assistant turns. */
  text: string
  reply?: ChatReply
  at: number
}

export type ChatIntent
  = | 'greeting'
    | 'help'
    | 'thanks'
    | 'overview'
    | 'revenue'
    | 'month'
    | 'forecast'
    | 'diagnose'
    | 'orders'
    | 'aov'
    | 'products'
    | 'product'
    | 'categories'
    | 'inventory'
    | 'payments'
    | 'customers'
    | 'ratings'
    | 'unknown'

/** Optional datasets an intent needs beyond the two aggregate endpoints. */
export type ChatDataset = 'products' | 'categories' | 'inventory' | 'reviews'

export interface ChatData {
  stats: AdminStats | null
  analytics: Analytics | null
  products?: Product[]
  categories?: Category[]
  inventory?: Inventory[]
  reviews?: Review[]
}
