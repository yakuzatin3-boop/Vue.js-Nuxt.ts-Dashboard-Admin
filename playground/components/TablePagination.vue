<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'

defineProps<{
  page: number
  pages: number
  total: number
  /** Noun for the count, e.g. "orders". */
  unit?: string
}>()

defineEmits<{ previous: [], next: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 px-4 py-3">
    <p class="nums text-sm text-slate-300">
      <span class="font-semibold text-slate-100">{{ total.toLocaleString() }}</span>
      <span v-if="unit">{{ unit }}</span>
      <span
        v-if="pages > 0"
        class="text-slate-400"
      > · page {{ page }} of {{ pages }}</span>
    </p>

    <div
      v-if="pages > 1"
      class="flex items-center gap-1"
    >
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-md border border-slate-800/80 px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/30 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page <= 1"
        @click="$emit('previous')"
      >
        <ChevronLeft class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Previous</span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-md border border-slate-800/80 px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/30 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page >= pages"
        @click="$emit('next')"
      >
        <span class="hidden sm:inline">Next</span>
        <ChevronRight class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
