<script setup lang="ts">
import type { Component } from 'vue'
import { ArrowDownRight, ArrowUpRight, Minus } from '@lucide/vue'

/**
 * A headline number with its label, an optional trend, and an optional inline
 * sparkline. `change` is deliberately nullable: null means there is no baseline
 * to compare against, which is not the same as a 0/ change.
 */
const props = withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    change?: number | null
    icon: Component
    /** Index into the chart palette. */
    tone?: number
    points?: number[]
  }>(),
  { hint: undefined, change: undefined, tone: 0, points: () => [] },
)

const direction = computed(() => {
  if (props.change === undefined)
    return 'flat'

  if (props.change === null)
    return 'new'

  if (props.change > 0)
    return 'up'

  return props.change < 0 ? 'down' : 'flat'
})

const changeText = computed(() => {
  if (props.change === undefined)
    return null

  return props.change === null ? 'New' : `${Math.abs(props.change)}%`
})
</script>

<template>
  <div class="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md transition-all hover:border-slate-700/80">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          {{ label }}
        </p>
        <p class="nums mt-2 truncate font-mono text-[26px] leading-8 font-bold tracking-tight text-white">
          {{ value }}
        </p>
      </div>

      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        :style="{
          // Mixed toward transparent, not white: the tile sits on a dark card,
          // so a white base would wash the tint out to grey.
          backgroundColor: `color-mix(in oklch, var(--chart-${(tone / 6) + 1}) 14%, transparent)`,
          color: `var(--chart-${(tone / 6) + 1})`,
        }"
      >
        <component
          :is="icon"
          class="h-5 w-5"
        />
      </span>
    </div>

    <div class="mt-4 flex items-end justify-between gap-3">
      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          v-if="changeText"
          class="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold"
          :class="{
            'bg-emerald-500/10 text-emerald-400': direction === 'up',
            'bg-rose-500/10 text-rose-400': direction === 'down',
            'bg-indigo-500/10 text-indigo-400': direction === 'new',
            'bg-slate-800 text-slate-400': direction === 'flat',
          }"
        >
          <ArrowUpRight
            v-if="direction === 'up'"
            class="h-3.5 w-3.5"
          />
          <ArrowDownRight
            v-else-if="direction === 'down'"
            class="h-3.5 w-3.5"
          />
          <Minus
            v-else
            class="h-3.5 w-3.5"
          />
          {{ changeText }}
        </span>

        <span
          v-if="hint"
          class="truncate text-xs text-slate-400"
        >{{ hint }}</span>
      </div>

      <MiniSparkline
        v-if="points.length > 1"
        :points="points"
        :color="`var(--chart-${(tone / 6) + 1})`"
        class="h-8 w-20 shrink-0"
      />
    </div>
  </div>
</template>
