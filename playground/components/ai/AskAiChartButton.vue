<script setup lang="ts">
import type { AiInsightsContext } from '~/types/ai-insights'
import { Sparkles } from '@lucide/vue'

/**
 * Sits in a chart panel's `#actions` slot. Clicking hands the live series to
 * the assistant, stored locally so the back end never needs a fixture of what
 * the dashboard showed: what you see in the chart is exactly what the model
 * is asked about.
 */
const props = withDefaults(
  defineProps<{
    page: string
    chartId: string
    chartTitle: string
    chartData: Record<string, unknown>
    dateRange?: string
  }>(),
  { dateRange: undefined },
)

const emit = defineEmits<{ ask: [context: AiInsightsContext] }>()

const ask = () => {
  emit('ask', {
    page: props.page,
    chartId: props.chartId,
    chartTitle: props.chartTitle,
    dateRange: props.dateRange,
    chartData: props.chartData,
  })
}
</script>

<template>
  <button
    type="button"
    :title="`Ask the assistant about ${chartTitle}`"
    class="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
    @click="ask"
  >
    <Sparkles class="h-4 w-4" />
    <span class="hidden sm:inline">Ask AI</span>
  </button>
</template>
