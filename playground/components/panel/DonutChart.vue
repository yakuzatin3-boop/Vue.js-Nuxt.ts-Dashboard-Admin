<script setup lang="ts">
import type { ChartSlice } from '~/types/chart'
import { chartColor } from '~/types/chart'

/**
 * Part-to-whole breakdown drawn as a donut.
 *
 * Arc segments are emitted as <circle> elements with stroke-dasharray rather
 * than <path> arcs: a circle's dash pattern gives the same result with no
 * trigonometry, and the rounded joins come for free from stroke-linecap.
 */
const props = withDefaults(
  defineProps<{
    slices: ChartSlice[]
    size?: number
    thickness?: number
    valueFormatter?: (value: number) => string
  }>(),
  {
    size: 168,
    thickness: 22,
    valueFormatter: (value: number) => String(value),
  },
)

const total = computed(() => props.slices.reduce((sum, slice) => sum + slice.value, 0))

const radius = computed(() => (props.size - props.thickness) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const center = computed(() => props.size / 2)

const segments = computed(() => {
  if (total.value <= 0)
    return []

  let offset = 0

  return props.slices.map((slice, index) => {
    const fraction = slice.value / total.value
    const length = fraction * circumference.value

    const segment = {
      ...slice,
      color: chartColor(slice.tone ?? index),
      // stroke-dashoffset is negative to advance the dash along the path.
      dasharray: `${Math.max(length, 0)} ${circumference.value - Math.max(length, 0)}`,
      dashoffset: -offset,
      percent: Math.round(fraction * 100),
    }

    offset += length

    return segment
  })
})
</script>

<template>
  <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
    <div
      class="relative shrink-0"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <svg
        :width="size"
        :height="size"
        :viewBox="`0 0 ${size} ${size}`"
        class="-rotate-90"
        role="img"
        :aria-label="`Breakdown of ${valueFormatter(total)}`"
      >
        <circle
          :cx="center"
          :cy="center"
          :r="radius"
          fill="none"
          class="stroke-slate-800"
          :stroke-width="thickness"
        />

        <circle
          v-for="segment in segments"
          :key="segment.label"
          :cx="center"
          :cy="center"
          :r="radius"
          fill="none"
          :stroke="segment.color"
          :stroke-width="thickness"
          :stroke-dasharray="segment.dasharray"
          :stroke-dashoffset="segment.dashoffset"
          stroke-linecap="butt"
        >
          <title>{{ segment.label }}: {{ valueFormatter(segment.value) }}</title>
        </circle>
      </svg>

      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="nums text-xl font-semibold tracking-tight text-slate-100">
          {{ valueFormatter(total) }}
        </span>
        <span class="text-[11px] text-slate-400">Total</span>
      </div>
    </div>

    <ul class="w-full min-w-0 space-y-2">
      <li
        v-for="segment in segments"
        :key="segment.label"
        class="flex items-center gap-2 text-sm"
      >
        <span
          class="h-2.5 w-2.5 shrink-0 rounded-sm"
          :style="{ backgroundColor: segment.color }"
        />
        <span class="min-w-0 flex-1 truncate text-slate-300">{{ segment.label }}</span>
        <span class="nums shrink-0 font-medium text-slate-100">{{ valueFormatter(segment.value) }}</span>
        <span class="nums w-10 shrink-0 text-right text-xs text-slate-400">
          {{ segment.percent }}%
        </span>
      </li>

      <li
        v-if="!segments.length"
        class="text-sm text-slate-400"
      >
        Nothing to break down yet.
      </li>
    </ul>
  </div>
</template>
