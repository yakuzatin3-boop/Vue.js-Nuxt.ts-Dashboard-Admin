<script setup lang="ts">
import type { Component } from 'vue'

/**
 * Placeholder for a panel that loaded successfully but has nothing to show.
 * An empty chart or list reads as broken, so every "no data" path routes here.
 */
withDefaults(
  defineProps<{
    icon?: Component
    title?: string
    description?: string
    compact?: boolean
  }>(),
  {
    icon: undefined,
    title: 'Nothing here yet',
    description: undefined,
    compact: false,
  },
)
</script>

<template>
  <div
    :class="[
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8' : 'py-14',
    ]"
  >
    <span
      v-if="icon"
      class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-400"
    >
      <component
        :is="icon"
        class="h-5 w-5"
      />
    </span>

    <p class="text-sm font-medium text-slate-100">
      {{ title }}
    </p>

    <p
      v-if="description"
      class="mt-1 max-w-xs text-sm text-slate-400"
    >
      {{ description }}
    </p>

    <slot />
  </div>
</template>
