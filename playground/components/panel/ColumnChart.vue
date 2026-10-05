<script setup lang="ts">
/**
 * Column chart for discrete counts (orders per month, new customers).
 *
 * The SVG is drawn at the container's real pixel size rather than being scaled
 * with a fixed viewBox. That costs one ResizeObserver, and buys correct text and
 * border rendering: `preserveAspectRatio="none"` would stretch the axis labels
 * horizontally on wide screens.
 */
import type { ChartPoint } from '~/types/chart'

const props = withDefaults(
  defineProps<{
    points: ChartPoint[]
    color?: string
    valueFormatter?: (value: number) => string
    /** Height in pixels at every breakpoint. */
    height?: number
  }>(),
  {
    color: 'var(--chart-2)',
    valueFormatter: (value: number) => String(value),
    height: 240,
  },
)

const { element: container, width } = useElementSize<HTMLDivElement>()

const PAD_TOP = 12
const PAD_BOTTOM = 30
const PAD_LEFT = 44
const PAD_RIGHT = 8

const plotWidth = computed(() => Math.max(0, width.value - PAD_LEFT - PAD_RIGHT))
const plotHeight = computed(() => Math.max(0, props.height - PAD_TOP - PAD_BOTTOM))

const maxValue = computed(() => {
  const max = Math.max(0, ...props.points.map(point => point.value))
  if (max === 0)
    return 1

  const magnitude = 10 ** Math.floor(Math.log10(max))

  return Math.ceil(max / magnitude) * magnitude
})

const gridLines = computed(() =>
  Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3

    return {
      value: maxValue.value * (1 - ratio),
      y: PAD_TOP + ratio * plotHeight.value,
    }
  }),
)

const bars = computed(() => {
  const count = props.points.length
  if (count === 0 || plotWidth.value === 0)
    return []

  // A gap between bars reads better than none, but never let it eat the bar.
  const slot = plotWidth.value / count
  const barWidth = Math.max(4, Math.min(38, slot * 0.62))

  return props.points.map((point, index) => {
    const height = maxValue.value ? (point.value / maxValue.value) * plotHeight.value : 0

    return {
      ...point,
      width: barWidth,
      // Centre each bar in its own slot rather than aligning to the left edge.
      x: PAD_LEFT + index * slot + (slot - barWidth) / 2,
      y: PAD_TOP + plotHeight.value - height,
      height: Math.max(height, point.value > 0 ? 2 : 0),
      labelX: PAD_LEFT + index * slot + slot / 2,
    }
  })
})

/** Thin out labels when the container is too narrow to fit them all. */
const labelStride = computed(() => {
  const perLabel = 52

  return Math.max(1, Math.ceil(bars.value.length / Math.max(1, Math.floor(plotWidth.value / perLabel))))
})
</script>

<template>
  <div
    ref="container"
    class="relative w-full"
  >
    <div
      v-if="!points.length"
      class="flex items-center justify-center text-sm text-slate-400"
      :style="{ height: `${height}px` }"
    >
      No data for this period.
    </div>

    <svg
      v-else
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      :aria-label="`Column chart with ${points.length} bars`"
    >
      <g>
        <text
          v-for="line in gridLines"
          :key="line.y"
          :x="PAD_LEFT - 8"
          :y="line.y + 3"
          text-anchor="end"
          class="fill-slate-400 text-[10px]"
        >{{ valueFormatter(Math.round(line.value)) }}</text>

        <line
          v-for="line in gridLines"
          :key="`rule-${line.y}`"
          :x1="PAD_LEFT"
          :x2="width - PAD_RIGHT"
          :y1="line.y"
          :y2="line.y"
          class="stroke-slate-800"
          stroke-width="1"
        />
      </g>

      <g>
        <rect
          v-for="bar in bars"
          :key="bar.label"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          :rx="Math.min(6, bar.width / 2)"
          :fill="color"
          opacity="0.9"
        >
          <title>{{ bar.label }}: {{ valueFormatter(bar.value) }}</title>
        </rect>
      </g>

      <g>
        <text
          v-for="(bar, index) in bars"
          v-show="index / labelStride === 0 || index === bars.length - 1"
          :key="`label-${bar.label}`"
          :x="bar.labelX"
          :y="height - 10"
          text-anchor="middle"
          class="fill-slate-400 text-[10px]"
        >{{ bar.label }}</text>
      </g>
    </svg>
  </div>
</template>
