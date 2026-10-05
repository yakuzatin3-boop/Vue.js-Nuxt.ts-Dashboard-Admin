<script setup lang="ts">
import { ArrowDownAZ } from '@lucide/vue'

/**
 * Sort control for card layouts, where there are no table headers to click.
 * Only columns that declare a `sort` accessor are offered.
 */
defineProps<{
  modelValue: string | null
  direction: 'asc' | 'desc'
  options: { value: string, label: string }[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | null], 'update:direction': [value: 'asc' | 'desc'] }>()
</script>

<template>
  <div class="flex items-center gap-2">
    <label
      class="sr-only"
      for="sort-by"
    >Sort by</label>
    <select
      id="sort-by"
      :value="modelValue ?? ''"
      class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 outline-none transition-colors hover:bg-slate-800/30 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">
        Sort…
      </option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>

    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/30 hover:text-slate-100 disabled:opacity-40"
      :disabled="!modelValue"
      @click="emit('update:direction', direction === 'asc' ? 'desc' : 'asc')"
    >
      <ArrowDownAZ class="h-4 w-4" />
      {{ direction === 'asc' ? 'A–Z' : 'Z–A' }}
    </button>
  </div>
</template>
