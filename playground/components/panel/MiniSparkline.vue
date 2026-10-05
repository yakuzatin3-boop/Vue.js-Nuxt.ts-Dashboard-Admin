<script setup lang="ts">
/**
 * Compact trend line for inline use inside a metric card. Purely decorative:
 * the real values are in the card's `value` and `label`, so this is marked
 * aria-hidden and carries no accessible text of its own.
 *
 * The viewBox is fixed while the rendered size comes from CSS, which keeps the
 * shape correct at any container width without a resize listener.
 */
const props = withDefaults(
  defineProps<{
    points: number[]
    color?: string
  }>(),
  { color: 'currentColor' },
)

const WIDTH = 100
const HEIGHT = 32
const PADDING = 2

const path = computed(() => {
  const values = props.points
  if (values.length < 2)
    return ''

  const max = Math.max(...values)
  const min = Math.min(...values)
  // A flat series would divide by zero, so treat it as sitting mid-height.
  const span = max - min || 1

  const step = (WIDTH - PADDING * 2) / (values.length - 1)

  const coords = values.map((value, index) => {
    const x = PADDING + index * step
    const y
      = PADDING
        + (1 - (value - min) / span) * (HEIGHT - PADDING * 2)

    return [x, y] as const
  })

  // Straight segments. A smoothed curve needs a spline fit that can overshoot
  // past the real minimum, which would misstate the trend on short series.
  return coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')
})

const last = computed(() => {
  const values = props.points
  if (values.length < 2)
    return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const lastValue = values[values.length - 1]!

  return {
    x: WIDTH - PADDING,
    y: PADDING + (1 - (lastValue - min) / span) * (HEIGHT - PADDING * 2),
  }
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    preserveAspectRatio="none"
    aria-hidden="true"
    class="overflow-visible"
  >
    <path
      :d="path"
      fill="none"
      :stroke="color"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
    <circle
      v-if="last"
      :cx="last.x"
      :cy="last.y"
      r="2.5"
      :fill="color"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
