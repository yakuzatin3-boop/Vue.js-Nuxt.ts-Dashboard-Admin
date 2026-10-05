<script setup lang="ts">
/**
 * Responsive area + line chart drawn as plain SVG.
 *
 * Drawn by hand rather than pulled from a charting library: the data is a single
 * pre-aggregated series, and a library would add far more weight than these few
 * paths require.
 *
 * Sizing: the SVG is rendered at the container's real pixel size (viewBox is
 * synced to it) instead of scaling a fixed viewBox. A fixed viewBox needs
 * `preserveAspectRatio="none"` to fill a fluid container, and that stretches the
 * axis labels horizontally on wide screens. Measuring once via ResizeObserver
 * keeps every glyph and stroke width at its true size.
 */
import { useElementSize } from '~/composables/useElementSize'
import type { ChartPoint } from '~/types/chart'

const props = withDefaults(
  defineProps<{
    points: ChartPoint[]
    color?: string
    /** Rendered height in CSS pixels. */
    height?: number
    valueFormatter?: (value: number) => string
  }>(),
  {
    color: 'var(--chart-1)',
    height: 260,
    valueFormatter: (value: number) => String(value),
  },
)

const { element: containerRef, width } = useElementSize<HTMLDivElement>()

// Gutters are in real pixels, so labels never sit outside the plot area.
const PAD_TOP = 12
const PAD_BOTTOM = 28
const PAD_LEFT = 8
const PAD_RIGHT = 8

const plotWidth = computed(() => Math.max(1, width.value - PAD_LEFT - PAD_RIGHT))
const plotHeight = computed(() => Math.max(1, props.height - PAD_TOP - PAD_BOTTOM))

const gradientId = `fill-${useId().replace(/[^a-z0-9]/gi, '')}`

const maxValue = computed(() => {
  const max = Math.max(0, ...props.points.map(point => point.value))
  return max || 1
})

/** A rounded upper bound, so the top gridline is a readable number. */
const axisMax = computed(() => {
  const raw = maxValue.value
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  return Math.ceil(raw / magnitude) * magnitude
})

const step = computed(() => axisMax.value / 4)

const coords = computed(() => {
  const count = props.points.length
  if (count === 0 || width.value === 0)
    return []

  // A single point has no x-neighbour to divide by, so it is centred.
  const xStep = count > 1 ? plotWidth.value / (count - 1) : 0

  return props.points.map((point, index) => ({
    ...point,
    x: PAD_LEFT + (count > 1 ? index * xStep : plotWidth.value / 2),
    y: PAD_TOP + (1 - point.value / axisMax.value) * plotHeight.value,
  }))
})

const linePath = computed(() =>
  coords.value
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' '),
)

const areaPath = computed(() => {
  const points = coords.value
  if (points.length === 0)
    return ''

  const first = points[0]!
  const last = points[points.length - 1]!
  const baseline = PAD_TOP + plotHeight.value

  return `${linePath.value} L${last.x.toFixed(2)} ${baseline.toFixed(2)} L${first.x.toFixed(2)} ${baseline.toFixed(2)} Z`
})

const gridLines = computed(() =>
  Array.from({ length: 5 }, (_, index) => ({
    value: axisMax.value - index * step.value,
    y: PAD_TOP + (index / 4) * plotHeight.value,
  })),
)

/** Thins the axis labels on narrow screens so they do not overlap. */
const labelStride = computed(() => {
  const available = Math.max(1, Math.floor(plotWidth.value / 64))
  return Math.max(1, Math.ceil(coords.value.length / available))
})

const hoveredIndex = ref<number | null>(null)

const onPointerMove = (event: PointerEvent) => {
  const points = coords.value
  if (points.length === 0)
    return

  const target = event.currentTarget as SVGElement
  const rect = target.getBoundingClientRect()
  if (rect.width === 0)
    return

  // viewBox matches the rendered size, so this is a 1:1 mapping.
  const x = event.clientX - rect.left

  let nearest = 0
  let nearestDistance = Infinity

  for (const [index, point] of points.entries()) {
    const distance = Math.abs(point.x - x)
    if (distance < nearestDistance) {
      nearest = index
      nearestDistance = distance
    }
  }

  hoveredIndex.value = nearest
}

const clearHover = () => {
  hoveredIndex.value = null
}

const active = computed(() =>
  hoveredIndex.value === null ? null : (coords.value[hoveredIndex.value] ?? null),
)

/** Tooltip placement, flipped when it would overflow the right edge. */
const tooltipStyle = computed(() => {
  const point = active.value
  if (!point || width.value === 0)
    return {}

  const percent = point.x / width.value
  const flip = percent > 0.72

  return {
    left: `${percent * 100}%`,
    transform: flip ? 'translate(-100%, 0)' : 'translate(0, 0)',
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative"
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
      :viewBox="`0 0 ${width || 1} ${height}`"
      :width="width || undefined"
      :height="height"
      class="block w-full touch-none"
      role="img"
      :aria-label="`Trend chart with ${points.length} points`"
      @pointermove="onPointerMove"
      @pointerleave="clearHover"
    >
      <defs>
        <linearGradient
          :id="gradientId"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            :stop-color="color"
            stop-opacity="0.26"
          />
          <stop
            offset="100%"
            :stop-color="color"
            stop-opacity="0.02"
          />
        </linearGradient>
      </defs>

      <line
        v-for="line in gridLines"
        :key="line.y"
        :x1="PAD_LEFT"
        :x2="width - PAD_RIGHT"
        :y1="line.y"
        :y2="line.y"
        stroke="currentColor"
        class="text-slate-300"
        stroke-width="1"
      />

      <path
        :d="areaPath"
        :fill="`url(#${gradientId})`"
      />

      <path
        :d="linePath"
        fill="none"
        :stroke="color"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <g v-if="active">
        <line
          :x1="active.x"
          :x2="active.x"
          :y1="PAD_TOP"
          :y2="PAD_TOP + plotHeight"
          :stroke="color"
          stroke-width="1"
          stroke-dasharray="4 4"
        />
        <circle
          :cx="active.x"
          :cy="active.y"
          r="5"
          fill="oklch(20.8% 0.042 265.755)"
          :stroke="color"
          stroke-width="2.5"
        />
      </g>

      <text
        v-for="(point, index) in coords"
        v-show="index / labelStride === 0 || index === coords.length - 1"
        :key="point.label"
        :x="point.x"
        :y="height - 8"
        text-anchor="middle"
        class="fill-slate-400 text-[11px]"
      >{{ point.label }}</text>
    </svg>

    <div
      v-if="active"
      class="pointer-events-none absolute top-2 z-10 min-w-max rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 shadow-raised"
      :style="tooltipStyle"
    >
      <p class="text-[11px] font-medium text-slate-400">
        {{ active.label }}
      </p>
      <p class="nums text-sm font-semibold text-slate-100">
        {{ valueFormatter(active.value) }}
      </p>
    </div>
  </div>
</template>
