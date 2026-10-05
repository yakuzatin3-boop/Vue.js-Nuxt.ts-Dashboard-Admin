<script setup lang="ts">
import type { Component } from 'vue'

/**
 * Panel is the single card primitive for the whole admin. Every block on every
 * page is one of these, which is what keeps padding, radius and border weight
 * identical across the app.
 */
withDefaults(
  defineProps<{
    title?: string
    description?: string
    icon?: Component
    /** Removes body padding so a table or chart can sit flush against the edges. */
    flush?: boolean
    /** Stretches the panel to fill its grid row's height. */
    stretch?: boolean
  }>(),
  { flush: false, stretch: false },
)
</script>

<template>
  <section
    :class="[
      // Translucent rather than solid: panels stack over the canvas and over
      // each other in some grids, and a fixed fill would flatten that. The
      // border is what actually defines the edge, so it lifts on hover.
      'flex min-w-0 flex-col rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md transition-all hover:border-slate-700/80',
      stretch ? 'h-full' : '',
    ]"
  >
    <header
      v-if="title || $slots.header || $slots.actions"
      class="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4"
    >
      <div class="flex min-w-0 items-start gap-3">
        <span
          v-if="icon"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400"
        >
          <component
            :is="icon"
            class="h-[18px] w-[18px]"
          />
        </span>

        <div class="min-w-0">
          <slot name="header">
            <h2 class="truncate text-[15px] leading-6 font-semibold text-slate-100">
              {{ title }}
            </h2>
            <p
              v-if="description"
              class="mt-0.5 text-xs leading-5 text-slate-500"
            >
              {{ description }}
            </p>
          </slot>
        </div>
      </div>

      <div
        v-if="$slots.actions"
        class="flex shrink-0 items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </header>

    <div
      :class="[
        'min-w-0 flex-1',
        flush ? '' : 'px-5 pb-5',
        !$slots.header && !$slots.actions ? 'pt-5' : '',
      ]"
    >
      <slot />
    </div>
  </section>
</template>
