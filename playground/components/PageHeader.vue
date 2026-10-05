<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  description?: string
  icon?: Component
}>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div class="flex min-w-0 items-start gap-3">
      <span
        v-if="icon"
        class="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-card sm:flex"
      >
        <component
          :is="icon"
          class="h-5 w-5"
        />
      </span>

      <div class="min-w-0">
        <h1 class="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
          {{ title }}
        </h1>
        <p
          v-if="description"
          class="mt-1 text-sm text-slate-400"
        >
          {{ description }}
        </p>
      </div>
    </div>

    <div
      v-if="$slots.actions"
      class="flex shrink-0 flex-wrap items-center gap-2"
    >
      <slot name="actions" />
    </div>
  </div>

  <!--
    The default slot carries the page body. It is rendered as a sibling of the
    title row rather than inside it, so pages can pass content without an extra
    wrapper element or margin utility.
  -->
  <slot />
</template>
