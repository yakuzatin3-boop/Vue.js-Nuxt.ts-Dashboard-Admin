<script setup lang="ts">
import type { Component } from 'vue'
import type { ChartPoint, ChartSlice } from '~/types/chart'
import type { ChatBlock, ChatFormat, ChatRankRow } from '~/types/chat'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleCheck,
  Command,
  CornerDownLeft,
  Info,
  LoaderCircle,
  LogOut,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  TriangleAlert,
  User,
} from '@lucide/vue'
import { chartColor } from '~/types/chart'
import { navigation } from '~/utils/navigation'
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatDateTime,
  humanize,
  initials,
} from '~/utils/format'

// The copilot renders its own rail and context panel, so the shared layout would
// wrap a second set of them around it.
definePageMeta({ layout: false })

useHead({ title: 'Chart Bot' })

interface PromptCard {
  question: string
  hint: string
  icon: Component
}

interface Capability {
  label: string
  detail: string
}

/**
 * Right-rail prompts. Held local rather than derived from the engine's own
 * suggestions so the rail reads as a stable menu instead of reshuffling itself
 * after every question.
 */
const suggestedPrompts: PromptCard[] = [
  { question: 'How is the store doing?', hint: 'Revenue, orders and basket size', icon: TrendingUp },
  { question: 'What are my top 5 products?', hint: 'Ranked by units and revenue', icon: Sparkles },
  { question: 'What is running out of stock?', hint: 'Levels against restock thresholds', icon: TriangleAlert },
  { question: 'Which payment method wins?', hint: 'Split by method, plus failures', icon: ChartNoAxesCombined },
]

/**
 * What the bot may read, stated up front: an answer the admin cannot trace back
 * to a number is the thing that erodes trust in a tool like this fastest.
 */
const dataCapabilities: Capability[] = [
  { label: 'Revenue & order history', detail: 'By month, with period-over-period change' },
  { label: 'Top products', detail: 'Leaderboard and any single product lookup' },
  { label: 'Category breakdowns', detail: 'Revenue and units per category' },
  { label: 'Restock thresholds', detail: 'Live stock levels and the restock list' },
  { label: 'Payment success rates', detail: 'By method, with failure counts' },
  { label: 'Customers & ratings', detail: 'New customers per month, review scores' },
]

const {
  messages,
  suggestions,
  thinking,
  pending,
  stats,
  analytics,
  loadError,
  ask,
  clear,
  refresh,
} = await useChartBot()

const { user, logout, fetchProfile } = useAuth()
const toast = useToast()

const draft = ref('')
const transcript = ref<HTMLDivElement | null>(null)
const composer = ref<HTMLTextAreaElement | null>(null)

const MAX = 400
const AUTOCOMPLETE_LIMIT = 4

const remaining = computed(() => MAX - draft.value.length)
const canSend = computed(() => draft.value.trim().length > 0 && !thinking.value)
const isWelcomeOnly = computed(() => messages.value.length <= 1)

/** Live-data strip, so the numbers behind every answer stay visible. */
const dataScope = computed(() => [
  stats.value?.totalRevenue ? `${stats.value.totalRevenue} all time` : 'Revenue not loaded',
  `${stats.value?.totalOrders?.toLocaleString() ?? 0} orders`,
  `${analytics.value?.months ?? 0} months history`,
])

/** Autocomplete runs off the engine's current follow ups, not a static list. */
const autocomplete = computed(() => {
  const query = draft.value.trim().toLowerCase()

  if (!query)
    return []

  return suggestions.value
    .filter(entry => entry.toLowerCase().includes(query))
    .slice(0, AUTOCOMPLETE_LIMIT)
})

/** What the most recent answer was about, for the rail's provenance card. */
const lastIntent = computed(() => {
  const last = [...messages.value].reverse().find(entry => entry.reply)

  return last?.reply ? humanize(last.reply.intent) : null
})

const FORMATTERS: Record<ChatFormat, (value: number) => string> = {
  currency: formatCompactCurrency,
  number: formatCompactNumber,
}

const blockFormatter = (format: ChatFormat) => FORMATTERS[format]

/** Finite values only: one missing field must not turn a whole chart into NaN. */
const finitePoints = (points: ChartPoint[]) => points.filter(point => Number.isFinite(point.value))

const blockMax = (points: ChartPoint[]) =>
  Math.max(1, ...finitePoints(points).map(point => point.value))

/** Bar height as a percentage, floored so a zero month still shows a sliver. */
const barPercent = (value: number, points: ChartPoint[]) =>
  Number.isFinite(value) ? Math.max(2, (value / blockMax(points)) * 100) : 2

/** Pulls the figure back out of a formatted string so it can drive a bar width. */
const barValue = (value: string | undefined) => {
  if (!value)
    return 0

  const parsed = Number(value.replace(/[^0-9.-]/g, ''))

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const rankMax = (rows: ChatRankRow[]) => Math.max(1, ...rows.map(row => barValue(row.value)))

const NOTE_TONES = {
  info: { wrap: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300', icon: Info },
  good: { wrap: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300', icon: CircleCheck },
  warn: { wrap: 'border-amber-500/20 bg-amber-500/10 text-amber-300', icon: TriangleAlert },
} as const

const isBlockKind = <K extends ChatBlock['kind']>(
  block: ChatBlock,
  kind: K,
): block is Extract<ChatBlock, { kind: K }> => block.kind === kind

/**
 * Fixed viewBox rather than measured pixels: this is a sparkline with no text
 * inside it, so the stretch is invisible and it avoids a ResizeObserver per
 * chart. `non-scaling-stroke` keeps the line weight honest under the stretch.
 */
const seriesPath = (points: ChartPoint[], height = 34) => {
  const safe = finitePoints(points)

  if (safe.length < 2)
    return { line: '', area: '' }

  const max = Math.max(...safe.map(point => point.value))
  const min = Math.min(...safe.map(point => point.value))
  const span = max - min || 1
  const step = 100 / (safe.length - 1)

  const coords = safe.map((point, index) => ({
    x: index * step,
    y: height - 3 - ((point.value - min) / span) * (height - 8),
  }))

  const line = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  return { line, area: `${line} L100 ${height} L0 ${height} Z` }
}

/** Donut segments as cumulative dash offsets around a fixed circumference. */
const DONUT_RADIUS = 34
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

const donutSegments = (slices: ChartSlice[]) => {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0) || 1
  let consumed = 0

  return slices.map((slice, index) => {
    const share = Math.max(0, slice.value) / total
    const offset = consumed

    consumed += share

    return {
      ...slice,
      share,
      color: chartColor(slice.tone ?? index),
      dasharray: `${(share * DONUT_CIRCUMFERENCE).toFixed(2)} ${DONUT_CIRCUMFERENCE.toFixed(2)}`,
      dashoffset: (-offset * DONUT_CIRCUMFERENCE).toFixed(2),
    }
  })
}

const isoStamp = (at: number) => new Date(at).toISOString()
const stamp = (at: number) => formatDateTime(isoStamp(at))

const submit = async () => {
  const question = draft.value

  draft.value = ''
  await ask(question)
}

const onSuggest = (question: string) => {
  draft.value = ''
  void ask(question)
}

const applyAutocomplete = (question: string) => {
  draft.value = question
  composer.value?.focus()
}

/** Grows with the content up to a cap, then scrolls, so the transcript holds still. */
const autoGrow = () => {
  const node = composer.value

  if (!node)
    return

  node.style.height = 'auto'
  node.style.height = `${Math.min(node.scrollHeight, 160)}px`
}

watch(draft, () => nextTick(autoGrow))

const onComposerKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing)
    return

  // Enter sends unless the question needs more than one line.
  event.preventDefault()

  if (canSend.value)
    void submit()
}

const onGlobalKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    composer.value?.focus()
  }
}

const onAttach = () => {
  toast.info('Attachments are not supported yet. Ask about a product by name instead.')
}

/**
 * Scrolls to the newest turn. Keyed on message count rather than on `messages`
 * itself, so a refresh that re-answers without adding a turn does not yank the
 * transcript out of view.
 */
const scrollToLatest = async () => {
  await nextTick()
  transcript.value?.scrollTo({ top: transcript.value.scrollHeight, behavior: 'smooth' })
}

watch(() => messages.value.length, scrollToLatest)
watch(() => thinking.value, scrollToLatest)

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  void nextTick(autoGrow)

  // The login response is enough for the rail; this only fills in the rest.
  if (user.value)
    void fetchProfile().catch(() => {})
})

onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-950 text-slate-100 antialiased">
    <div
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 bg-[radial-gradient(55rem_35rem_at_0_0%,rgba(79,70,229,0.18),transparent_60%),radial-gradient(45rem_30rem_at_100%_100%,rgba(139,92,246,0.12),transparent_60%)]"
    />

    <!-- A. Left navigation -->
    <aside class="relative z-10 hidden w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md lg:flex">
      <div class="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800/80 px-4">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
          <Store class="h-5 w-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold tracking-tight text-slate-100">
            Ecommerce
          </p>
          <p class="truncate text-[11px] text-slate-500">
            Admin workspace
          </p>
        </div>
        <ChevronDown class="h-4 w-4 shrink-0 text-slate-500" />
      </div>

      <nav class="scrollbar-slim flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div
          v-for="section in navigation"
          :key="section.title"
          class="space-y-1"
        >
          <p class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {{ section.title }}
          </p>
          <NuxtLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="relative flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150"
            :class="item.to === '/chart-bot'
              ? 'border-indigo-500/20 bg-indigo-600/10 text-indigo-400 shadow-[0_0_18px_-6px_rgba(99,102,241,0.65)]'
              : 'border-transparent text-slate-400 hover:border-slate-700/80 hover:bg-slate-800/40 hover:text-slate-100'"
          >
            <span
              v-if="item.to === '/chart-bot'"
              aria-hidden="true"
              class="absolute top-1/2 -left-3 h-5 w-0.5 -translate-y-1/2 rounded-r bg-indigo-400"
            />
            <component
              :is="item.icon"
              class="h-4 w-4 shrink-0"
            />
            {{ item.label }}
          </NuxtLink>
        </div>
      </nav>

      <div class="shrink-0 border-t border-slate-800/80 p-3">
        <div class="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 transition-all hover:border-slate-700/80">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
            {{ initials(user?.name, user?.email?.[0]?.toUpperCase() ?? 'A') }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-semibold text-slate-100">
              {{ user?.name ?? 'Administrator' }}
            </p>
            <p class="truncate text-[11px] text-slate-500">
              {{ user?.email ?? 'Not signed in' }}
            </p>
          </div>
          <button
            type="button"
            title="Sign out"
            class="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
            @click="logout()"
          >
            <LogOut class="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Content column -->
    <div class="relative z-10 flex min-w-0 flex-1 flex-col">
      <!-- B. Chat header -->
      <header class="flex h-16 shrink-0 items-center gap-4 border-b border-slate-800/80 bg-slate-950/80 px-4 backdrop-blur-md sm:px-6">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
          <Sparkles class="h-5 w-5" />
        </span>

        <div class="min-w-0 flex-1">
          <h1 class="truncate text-sm font-bold tracking-tight text-slate-100">
            Chart Bot
          </h1>
          <p class="flex items-center gap-1.5 truncate text-[11px] text-slate-500">
            <span
              class="relative flex h-1.5 w-1.5 shrink-0"
              aria-hidden="true"
            >
              <span
                v-if="!pending"
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
              />
              <span
                class="relative inline-flex h-1.5 w-1.5 rounded-full"
                :class="pending ? 'bg-amber-400' : 'bg-emerald-400'"
              />
            </span>
            <span class="truncate tabular-nums">{{ dataScope.join(' • ') }}</span>
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span
            v-if="pending"
            class="hidden items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 sm:inline-flex"
          >
            <LoaderCircle class="h-3.5 w-3.5 animate-spin" />
            Syncing
          </span>

          <button
            type="button"
            class="hidden items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 transition-all hover:border-slate-700/80 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
            :disabled="thinking"
            @click="refresh()"
          >
            <RefreshCw
              class="h-4 w-4"
              :class="thinking ? 'animate-spin' : ''"
            />
            Refresh data
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 transition-all hover:border-rose-500/30 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="messages.length <= 1 || thinking"
            @click="clear()"
          >
            <Trash2 class="h-4 w-4" />
            <span class="hidden sm:inline">Clear chat</span>
          </button>
        </div>
      </header>

      <div class="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <!-- B. Transcript + composer -->
        <section class="flex min-h-0 min-w-0 flex-col">
          <div
            ref="transcript"
            class="scrollbar-slim flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6"
            role="log"
            aria-live="polite"
            aria-label="Conversation with the Chart Bot"
          >
            <p
              v-if="loadError"
              class="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            >
              {{ loadError }}
            </p>

            <!-- Welcome card -->
            <article
              v-if="isWelcomeOnly"
              class="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md transition-all hover:border-slate-700/80 sm:p-6"
            >
              <div class="flex items-start gap-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                  <Bot class="h-5 w-5" />
                </span>
                <div class="min-w-0 flex-1">
                  <h2 class="text-sm font-bold tracking-tight text-slate-100">
                    Ask me anything about this store
                  </h2>
                  <p class="mt-1 text-sm leading-6 text-slate-400">
                    I read the same live data the dashboard does, so every figure I give
                    you is one you can verify on the Analytics page.
                  </p>
                </div>
              </div>

              <p class="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-200/80">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">Data in scope</span>
                <span class="mt-1 block text-sm tabular-nums text-indigo-100">{{ dataScope.join(' • ') }}</span>
              </p>

              <div class="mt-4 flex flex-wrap gap-2">
                <button
                  v-for="chip in suggestions"
                  :key="chip"
                  type="button"
                  class="rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-indigo-500/40 hover:bg-indigo-600/20 hover:text-indigo-400"
                  @click="onSuggest(chip)"
                >
                  {{ chip }}
                </button>
              </div>
            </article>

            <!-- Turns -->
            <template
              v-for="message in messages"
              :key="message.id"
            >
              <!-- User -->
              <article
                v-if="message.role === 'user'"
                class="flex justify-end gap-3"
              >
                <div class="flex min-w-0 max-w-[min(38rem,86%)] flex-col items-end gap-1">
                  <p class="rounded-2xl rounded-tr-xs bg-indigo-600 px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap text-white">
                    {{ message.text }}
                  </p>
                  <time
                    :datetime="isoStamp(message.at)"
                    class="px-1 text-[11px] text-slate-500"
                  >
                    You · {{ stamp(message.at) }}
                  </time>
                </div>

                <span
                  aria-hidden="true"
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700/60 bg-slate-800 text-slate-300"
                >
                  <User class="h-4 w-4" />
                </span>
              </article>

              <!-- Assistant -->
              <article
                v-else
                class="flex gap-3"
              >
                <span
                  aria-hidden="true"
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
                >
                  <Bot class="h-4 w-4" />
                </span>

                <div class="flex min-w-0 max-w-[min(46rem,90%)] flex-col items-start gap-1">
                  <div class="w-full rounded-2xl rounded-tl-xs border border-slate-800 bg-slate-900/90 p-4">
                    <p class="text-sm leading-6 text-slate-200">
                      {{ message.reply?.headline ?? message.text }}
                    </p>

                    <div
                      v-if="message.reply?.blocks.length"
                      class="mt-4 space-y-3"
                    >
                      <template
                        v-for="(block, index) in message.reply.blocks"
                        :key="`${block.kind}-${index}`"
                      >
                        <!-- Inline metric badges -->
                        <div
                          v-if="isBlockKind(block, 'metrics')"
                          class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60"
                        >
                          <p
                            v-if="block.caption"
                            class="border-b border-slate-800 px-3.5 py-2 text-[11px] font-medium uppercase tracking-wider text-slate-500"
                          >
                            {{ block.caption }}
                          </p>
                          <div class="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-4">
                            <div
                              v-for="metric in block.items"
                              :key="metric.label"
                              class="min-w-0 bg-slate-950/60 px-3.5 py-2.5"
                            >
                              <p class="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500">
                                {{ metric.label }}
                              </p>
                              <p class="mt-1 truncate text-sm font-bold text-slate-100 tabular-nums">
                                {{ metric.value }}
                              </p>
                              <p
                                v-if="metric.change !== undefined"
                                class="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums"
                                :class="metric.change === null
                                  ? 'text-slate-500'
                                  : metric.change > 0
                                    ? 'text-emerald-400'
                                    : metric.change < 0
                                      ? 'text-rose-400'
                                      : 'text-slate-500'"
                              >
                                <component
                                  :is="metric.change !== null && metric.change > 0 ? ArrowUpRight : ArrowDownRight"
                                  class="h-3 w-3"
                                />
                                <template v-if="metric.change === null">
                                  No baseline
                                </template>
                                <template v-else>
                                  {{ metric.change > 0 ? '+' : '' }}{{ metric.change }}/
                                </template>
                              </p>
                              <p
                                v-else-if="metric.hint"
                                class="mt-0.5 truncate text-[11px] text-slate-500"
                              >
                                {{ metric.hint }}
                              </p>
                            </div>
                          </div>
                        </div>

                        <!-- Trend sparkline -->
                        <div
                          v-else-if="isBlockKind(block, 'trend')"
                          class="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"
                        >
                          <p
                            v-if="block.caption"
                            class="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                          >
                            {{ block.caption }}
                          </p>
                          <svg
                            viewBox="0 0 100 34"
                            preserveAspectRatio="none"
                            class="mt-2 h-20 w-full"
                            role="img"
                            :aria-label="`Trend across ${block.points.length} points`"
                          >
                            <path
                              :d="seriesPath(block.points).area"
                              :fill="chartColor(block.tone ?? 0)"
                              opacity="0.14"
                            />
                            <path
                              :d="seriesPath(block.points).line"
                              fill="none"
                              :stroke="chartColor(block.tone ?? 0)"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              vector-effect="non-scaling-stroke"
                            />
                          </svg>
                          <div class="mt-2 flex justify-between text-[10px] text-slate-500">
                            <span>{{ block.points[0]?.label }}</span>
                            <span>{{ block.points[block.points.length - 1]?.label }}</span>
                          </div>
                        </div>

                        <!-- Column chart -->
                        <div
                          v-else-if="isBlockKind(block, 'columns')"
                          class="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"
                        >
                          <p
                            v-if="block.caption"
                            class="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                          >
                            {{ block.caption }}
                          </p>
                          <div class="mt-3 flex gap-1.5">
                            <div
                              v-for="point in block.points"
                              :key="point.label"
                              class="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
                            >
                              <div class="flex h-24 w-full items-end">
                                <span
                                  class="w-full rounded-t-md transition-opacity group-hover:opacity-80"
                                  :style="{
                                    height: `${barPercent(point.value, block.points)}%`,
                                    backgroundColor: chartColor(block.tone ?? 0),
                                  }"
                                  :title="`${point.label}: ${blockFormatter(block.format)(point.value)}`"
                                />
                              </div>
                              <span class="w-full truncate text-center text-[10px] text-slate-500">{{ point.label }}</span>
                            </div>
                          </div>
                        </div>

                        <!-- Donut -->
                        <div
                          v-else-if="isBlockKind(block, 'donut')"
                          class="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"
                        >
                          <p
                            v-if="block.caption"
                            class="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                          >
                            {{ block.caption }}
                          </p>
                          <div class="mt-3 flex items-center gap-4">
                            <svg
                              viewBox="0 0 80 80"
                              class="h-24 w-24 shrink-0 -rotate-90"
                              role="img"
                              aria-label="Part-to-whole breakdown"
                            >
                              <circle
                                cx="40"
                                cy="40"
                                :r="DONUT_RADIUS"
                                fill="none"
                                stroke="currentColor"
                                class="text-slate-300"
                                stroke-width="10"
                              />
                              <circle
                                v-for="segment in donutSegments(block.slices)"
                                :key="segment.label"
                                cx="40"
                                cy="40"
                                :r="DONUT_RADIUS"
                                fill="none"
                                :stroke="segment.color"
                                stroke-width="10"
                                :stroke-dasharray="segment.dasharray"
                                :stroke-dashoffset="segment.dashoffset"
                              >
                                <title>{{ segment.label }}</title>
                              </circle>
                            </svg>

                            <ul class="min-w-0 flex-1 space-y-1.5">
                              <li
                                v-for="segment in donutSegments(block.slices)"
                                :key="segment.label"
                                class="flex items-center gap-2 text-[11px]"
                              >
                                <span
                                  class="h-2 w-2 shrink-0 rounded-full"
                                  :style="{ backgroundColor: segment.color }"
                                />
                                <span class="min-w-0 flex-1 truncate text-slate-400">{{ segment.label }}</span>
                                <span class="shrink-0 font-semibold text-slate-200 tabular-nums">
                                  {{ Math.round(segment.share * 100) }}/
                                </span>
                              </li>
                            </ul>
                          </div>
                        </div>

                        <!-- Ranked list -->
                        <div
                          v-else-if="isBlockKind(block, 'rank')"
                          class="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"
                        >
                          <p
                            v-if="block.caption"
                            class="text-[11px] font-medium uppercase tracking-wider text-slate-500"
                          >
                            {{ block.caption }}
                          </p>
                          <ul
                            v-if="block.rows.length"
                            class="mt-3 space-y-2.5"
                          >
                            <li
                              v-for="(row, rowIndex) in block.rows"
                              :key="`${row.label}-${rowIndex}`"
                              class="min-w-0"
                            >
                              <div class="flex items-baseline gap-3">
                                <span class="min-w-0 flex-1 truncate text-xs text-slate-300">{{ row.label }}</span>
                                <span
                                  v-if="row.value"
                                  class="shrink-0 text-xs font-semibold text-slate-100 tabular-nums"
                                >
                                  {{ row.value }}
                                </span>
                              </div>
                              <div
                                v-if="barValue(row.value)"
                                class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
                              >
                                <div
                                  class="h-full rounded-full"
                                  :style="{
                                    width: `${(barValue(row.value) / rankMax(block.rows)) * 100}%`,
                                    backgroundColor: chartColor(row.tone ?? rowIndex),
                                  }"
                                />
                              </div>
                              <p
                                v-else-if="row.detail"
                                class="mt-0.5 text-[11px] text-slate-500"
                              >
                                {{ row.detail }}
                              </p>
                            </li>
                          </ul>
                          <p
                            v-else
                            class="mt-2 text-xs text-slate-500"
                          >
                            {{ block.empty ?? 'Nothing to show here yet.' }}
                          </p>
                        </div>

                        <!-- Note -->
                        <div
                          v-else-if="isBlockKind(block, 'note')"
                          class="flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-6"
                          :class="NOTE_TONES[block.tone].wrap"
                        >
                          <component
                            :is="NOTE_TONES[block.tone].icon"
                            class="mt-0.5 h-4 w-4 shrink-0"
                          />
                          <p class="min-w-0 flex-1">
                            {{ block.text }}
                          </p>
                        </div>
                      </template>
                    </div>

                    <!-- Follow ups -->
                    <div
                      v-if="message.reply?.suggestions.length"
                      class="mt-3 flex flex-wrap gap-2 border-t border-slate-800/80 pt-3"
                    >
                      <button
                        v-for="chip in message.reply.suggestions"
                        :key="chip"
                        type="button"
                        class="rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-all hover:border-indigo-500/40 hover:bg-indigo-600/20 hover:text-indigo-400"
                        @click="onSuggest(chip)"
                      >
                        {{ chip }}
                      </button>
                    </div>

                    <NuxtLink
                      to="/analytics"
                      class="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                    >
                      <ChartNoAxesCombined class="h-3.5 w-3.5" />
                      See data on Analytics page
                    </NuxtLink>
                  </div>

                  <time
                    :datetime="isoStamp(message.at)"
                    class="px-1 text-[11px] text-slate-500"
                  >
                    Chart Bot · {{ stamp(message.at) }}
                  </time>
                </div>
              </article>
            </template>

            <!-- Thinking -->
            <div
              v-if="thinking"
              class="flex gap-3"
              aria-live="polite"
            >
              <span
                aria-hidden="true"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
              >
                <Bot class="h-4 w-4" />
              </span>

              <div class="rounded-2xl rounded-tl-xs border border-slate-800 bg-slate-900/90 px-4 py-3">
                <div class="flex items-center gap-2">
                  <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                  <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:150ms]" />
                  <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:300ms]" />
                  <span class="ml-1 text-xs text-slate-400">Reading the store data…</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sticky command bar -->
          <div class="shrink-0 border-t border-slate-800/80 bg-slate-950/70 p-3 backdrop-blur-md sm:p-4">
            <form
              class="relative mx-auto w-full max-w-3xl"
              @submit.prevent="canSend && submit()"
            >
              <div
                v-if="autocomplete.length"
                class="absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/95 backdrop-blur-md"
              >
                <p class="border-b border-slate-800/80 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Complete your question
                </p>
                <button
                  v-for="entry in autocomplete"
                  :key="entry"
                  type="button"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-indigo-600/10 hover:text-indigo-400"
                  @click="applyAutocomplete(entry)"
                >
                  <Sparkles class="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span class="min-w-0 flex-1 truncate">{{ entry }}</span>
                  <CornerDownLeft class="h-3 w-3 shrink-0 text-slate-300" />
                </button>
              </div>

              <div class="flex items-end gap-2 rounded-2xl border border-indigo-500/40 bg-slate-900/80 p-2 shadow-2xl shadow-indigo-950/60 backdrop-blur-md transition-colors focus-within:border-indigo-500">
                <label
                  for="chart-bot-input"
                  class="sr-only"
                >
                  Ask the Chart Bot a question about this store
                </label>

                <textarea
                  id="chart-bot-input"
                  ref="composer"
                  v-model="draft"
                  :maxlength="MAX"
                  :disabled="thinking"
                  rows="1"
                  placeholder="Ask about revenue, orders, products, stock, payments…"
                  autocomplete="off"
                  class="max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  @keydown="onComposerKeydown"
                />

                <div class="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="Attach a file"
                    class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
                    @click="onAttach"
                  >
                    <Paperclip class="h-4 w-4" />
                  </button>

                  <NuxtLink
                    to="/analytics"
                    title="Open the Analytics page"
                    class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
                  >
                    <ChartNoAxesCombined class="h-4 w-4" />
                  </NuxtLink>

                  <button
                    type="submit"
                    :disabled="!canSend"
                    class="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white transition-all hover:from-indigo-500 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <LoaderCircle
                      v-if="thinking"
                      class="h-3.5 w-3.5 animate-spin"
                    />
                    <Send
                      v-else
                      class="h-3.5 w-3.5"
                    />
                    Send
                  </button>
                </div>
              </div>

              <div class="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
                <span class="flex items-center gap-1.5">
                  <span class="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-800/60 px-1.5 py-0.5 font-medium text-slate-400">
                    <Command class="h-3 w-3" />
                    K
                  </span>
                  to focus · Enter sends · Shift+Enter adds a line
                </span>
                <span
                  class="tabular-nums"
                  :class="remaining <= 40 ? 'text-amber-400' : ''"
                >
                  {{ remaining }} left
                </span>
              </div>
            </form>
          </div>
        </section>

        <!-- C. Context panel -->
        <aside class="scrollbar-slim hidden min-h-0 flex-col gap-4 overflow-y-auto border-l border-slate-800/80 bg-slate-900/40 p-4 backdrop-blur-md xl:flex">
          <section class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
            <div class="flex items-center gap-2">
              <Sparkles class="h-4 w-4 text-indigo-400" />
              <h2 class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Try asking
              </h2>
            </div>
            <p class="mt-1 text-[11px] text-slate-500">
              Tap one to send it straight away.
            </p>

            <div class="mt-3 space-y-2">
              <button
                v-for="prompt in suggestedPrompts"
                :key="prompt.question"
                type="button"
                class="group w-full rounded-lg border border-slate-700/60 bg-slate-800/80 p-3 text-left transition-all hover:border-indigo-500/40 hover:bg-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="thinking"
                @click="onSuggest(prompt.question)"
              >
                <span class="flex items-start gap-2.5">
                  <component
                    :is="prompt.icon"
                    class="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-indigo-400"
                  />
                  <span class="min-w-0">
                    <span class="block text-xs font-semibold text-slate-300 transition-colors group-hover:text-indigo-400">
                      {{ prompt.question }}
                    </span>
                    <span class="mt-0.5 block text-[11px] text-slate-500">{{ prompt.hint }}</span>
                  </span>
                </span>
              </button>
            </div>
          </section>

          <section class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
            <div class="flex items-center gap-2">
              <Check class="h-4 w-4 text-emerald-400" />
              <h2 class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                What I can read
              </h2>
            </div>
            <p class="mt-1 text-[11px] text-slate-500">
              Nothing is guessed. Every answer traces back to these.
            </p>

            <ul class="mt-3 space-y-2.5">
              <li
                v-for="capability in dataCapabilities"
                :key="capability.label"
                class="flex gap-2.5"
              >
                <Check class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span class="min-w-0">
                  <span class="block text-xs font-semibold text-slate-300">{{ capability.label }}</span>
                  <span class="block text-[11px] text-slate-500">{{ capability.detail }}</span>
                </span>
              </li>
            </ul>
          </section>

          <section class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <p class="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Provenance
            </p>
            <p
              v-if="lastIntent"
              class="mt-1.5 text-xs leading-5 text-slate-400"
            >
              Last answer was a <span class="font-semibold text-indigo-400">{{ lastIntent }}</span>
              read from the live dataset. Change anything, then hit Refresh data to recalculate it.
            </p>
            <p
              v-else
              class="mt-1.5 text-xs leading-5 text-slate-500"
            >
              Ask a question and this panel will name the intent it was answered from.
            </p>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>
