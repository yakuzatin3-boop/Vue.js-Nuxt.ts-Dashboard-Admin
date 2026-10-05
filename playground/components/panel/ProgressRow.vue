<script setup lang="ts">
/**
 * Labelled progress bar. Used for shares and health ratios where the reader
 * needs the fraction, not just the fill.
 */
const props = withDefaults(
  defineProps<{
    value: number
    max?: number
    label?: string
    detail?: string
    color?: string
  }>(),
  {
    max: 100,
    label: undefined,
    detail: undefined,
    color: 'var(--chart-1)',
  },
)

const percent = computed(() => {
  const { value, max } = props

  if (!max)
    return 0

  return Math.min(100, Math.max(0, (value / max) * 100))
})
</script>

<template>
  <div class="min-w-0">
    <div
      v-if="label || detail"
      class="mb-1.5 flex items-baseline justify-between gap-3"
    >
      <span
        v-if="label"
        class="truncate text-sm text-slate-300"
      >{{ label }}</span>
      <span
        v-if="detail"
        class="nums shrink-0 text-xs font-medium text-slate-400"
      >{{ detail }}</span>
    </div>

    <div
      class="h-2 w-full overflow-hidden rounded-full bg-slate-800"
      role="progressbar"
      :aria-valuenow="Math.round(percent)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label ?? 'Progress'"
    >
      <div
        class="h-full rounded-full transition-[width] duration-500"
        :style="{ width: `${percent}%`, backgroundColor: color }"
      />
    </div>
  </div>
</template>
