<script setup lang="ts">
/**
 * Renders one structured bot reply as admin components.
 *
 * The old implementation printed markdown into a whitespace-pre-wrap div, so
 * asterisks leaked through and nothing was clickable. Every block here maps onto
 * a component that already exists on the Analytics page, which is what makes a
 * reply look like part of the dashboard instead of a chat transcript.
 */
import type { ChatFormat, ChatRankRow, ChatReply } from '~/types/chat'
import {
  ChartNoAxesCombined,
  CircleCheck,
  Info,
  Sparkles,
  TriangleAlert,
} from '@lucide/vue'
import { formatCompactCurrency, formatCompactNumber } from '~/utils/format'

const props = defineProps<{
  reply: ChatReply
}>()

defineEmits<{ suggest: [question: string] }>()

const FORMATTERS: Record<ChatFormat, (value: number) => string> = {
  currency: formatCompactCurrency,
  number: formatCompactNumber,
}

const formatter = (format: ChatFormat) => FORMATTERS[format]

/** Pulls the figure out of a formatted string so it can drive a bar width. */
const bar = (value: string | undefined) => {
  if (!value)
    return 0

  const parsed = Number(value.replace(/[^0-9.-]/g, ''))

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** Widest rank row, so every bar in the list is scaled against one leader. */
const rankMax = (rows: ChatRankRow[]) => {
  const values = rows.map(row => bar(row.value))

  return values.length ? Math.max(...values, 1) : 1
}

const NOTE_STYLES = {
  info: 'border-slate-800/80 bg-slate-950/50 text-slate-300',
  good: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
}

const NOTE_ICONS = { info: Info, good: CircleCheck, warn: TriangleAlert }
</script>

<template>
  <div class="min-w-0 space-y-3">
    <p class="text-sm leading-6 text-slate-100">
      {{ props.reply.headline }}
    </p>

    <template
      v-for="(block, index) in props.reply.blocks"
      :key="index"
    >
      <!-- Headline numbers, laid out like the analytics metric row. -->
      <div
        v-if="block.kind === 'metrics'"
        class="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60"
      >
        <p
          v-if="block.caption"
          class="border-b border-slate-800/80 bg-slate-950/60 px-4 py-2 text-[11px] font-medium tracking-wide text-slate-400 uppercase"
        >
          {{ block.caption }}
        </p>

        <div class="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-4">
          <div
            v-for="metric in block.items"
            :key="metric.label"
            class="min-w-0 bg-slate-900/60 px-4 py-3"
          >
            <p class="truncate text-[11px] font-medium tracking-wide text-slate-400 uppercase">
              {{ metric.label }}
            </p>
            <p class="nums mt-1 truncate text-lg font-semibold tracking-tight text-slate-100">
              {{ metric.value }}
            </p>
            <p
              v-if="metric.change !== undefined"
              class="nums mt-0.5 text-xs font-medium"
              :class="metric.change === null
                ? 'text-slate-400'
                : metric.change > 0
                  ? 'text-emerald-400'
                  : metric.change < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'"
            >
              <template v-if="metric.change === null">
                No baseline
              </template>
              <template v-else>
                {{ metric.change > 0 ? '+' : '' }}{{ metric.change }}%
                <span class="font-normal text-slate-400">vs prior period</span>
              </template>
            </p>
            <p
              v-else-if="metric.hint"
              class="mt-0.5 truncate text-xs text-slate-400"
            >
              {{ metric.hint }}
            </p>
          </div>
        </div>
      </div>

      <!-- Line chart for continuous series. -->
      <div
        v-else-if="block.kind === 'trend'"
        class="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 pt-3 pb-2"
      >
        <p
          v-if="block.caption"
          class="mb-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase"
        >
          {{ block.caption }}
        </p>

        <TrendChart
          :points="block.points"
          :color="`var(--chart-${((block.tone ?? 0) / 6) + 1})`"
          :value-formatter="formatter(block.format)"
          :height="200"
        />
      </div>

      <!-- Column chart for discrete counts. -->
      <div
        v-else-if="block.kind === 'columns'"
        class="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 pt-3 pb-2"
      >
        <p
          v-if="block.caption"
          class="mb-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase"
        >
          {{ block.caption }}
        </p>

        <ColumnChart
          :points="block.points"
          :color="`var(--chart-${((block.tone ?? 0) / 6) + 1})`"
          :value-formatter="formatter(block.format)"
          :height="180"
        />
      </div>

      <div
        v-else-if="block.kind === 'donut'"
        class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4"
      >
        <p
          v-if="block.caption"
          class="mb-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase"
        >
          {{ block.caption }}
        </p>

        <DonutChart
          :slices="block.slices"
          :size="140"
          :thickness="20"
          :value-formatter="formatter(block.format)"
        />
      </div>

      <!-- Ranked list with bars, the same visual as the analytics page. -->
      <div
        v-else-if="block.kind === 'rank'"
        class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4"
      >
        <p
          v-if="block.caption"
          class="mb-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase"
        >
          {{ block.caption }}
        </p>

        <ul
          v-if="block.rows.length"
          class="space-y-3"
        >
          <li
            v-for="(row, rowIndex) in block.rows"
            :key="`${row.label}-${rowIndex}`"
            class="min-w-0"
          >
            <div class="mb-1 flex items-baseline gap-3">
              <span class="min-w-0 flex-1 truncate text-sm text-slate-100">
                {{ row.label }}
              </span>
              <span
                v-if="row.value"
                class="nums shrink-0 text-sm font-semibold text-slate-100"
              >
                {{ row.value }}
              </span>
            </div>

            <ProgressRow
              v-if="bar(row.value)"
              :value="bar(row.value)"
              :max="rankMax(block.rows)"
              :detail="row.detail"
              :color="`var(--chart-${((row.tone ?? rowIndex) / 6) + 1})`"
            />

            <p
              v-else-if="row.detail"
              class="text-xs text-slate-400"
            >
              {{ row.detail }}
            </p>
          </li>
        </ul>

        <p
          v-else
          class="py-2 text-sm text-slate-400"
        >
          {{ block.empty ?? 'Nothing to show here yet.' }}
        </p>
      </div>

      <div
        v-else-if="block.kind === 'note'"
        class="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-6"
        :class="NOTE_STYLES[block.tone]"
      >
        <component
          :is="NOTE_ICONS[block.tone]"
          class="mt-0.5 h-4 w-4 shrink-0"
        />
        <p class="min-w-0 flex-1">
          {{ block.text }}
        </p>
      </div>
    </template>

    <!-- Follow ups. Tap to send, so the thread keeps moving without typing. -->
    <div
      v-if="props.reply.suggestions.length"
      class="flex flex-wrap items-center gap-2 pt-1"
    >
      <span class="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
        <Sparkles class="h-3.5 w-3.5" />
        Ask next
      </span>

      <button
        v-for="suggestion in props.reply.suggestions"
        :key="suggestion"
        type="button"
        class="rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-400"
        @click="$emit('suggest', suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>

    <NuxtLink
      to="/analytics"
      class="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:underline"
    >
      <ChartNoAxesCombined class="h-3.5 w-3.5" />
      See the same data on the Analytics page
    </NuxtLink>
  </div>
</template>
