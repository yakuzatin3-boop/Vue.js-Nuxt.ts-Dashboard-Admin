<script setup lang="ts">
import { RefreshCw, TriangleAlert } from '@lucide/vue'

defineProps<{
  pending?: boolean
  error?: Error | null
  empty?: boolean
  emptyText?: string
  /** Keeps the panel frame visible while loading, instead of swapping it out. */
  skeleton?: boolean
}>()

defineEmits<{ refresh: [] }>()
</script>

<template>
  <div
    v-if="error"
    class="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-6 py-12 text-center"
  >
    <TriangleAlert class="h-6 w-6 text-rose-400" />
    <p class="text-sm font-medium text-rose-400">
      {{ error.message }}
    </p>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-600"
      @click="$emit('refresh')"
    >
      <RefreshCw class="h-4 w-4" /> Retry
    </button>
  </div>

  <div
    v-else-if="pending && skeleton"
    class="space-y-3"
    aria-busy="true"
  >
    <div
      v-for="row in 3"
      :key="row"
      class="flex items-center gap-3"
    >
      <div class="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-800" />
      <div class="min-w-0 flex-1 space-y-2">
        <div class="h-2.5 w-1/3 animate-pulse rounded-full bg-slate-800" />
        <div class="h-2.5 w-1/4 animate-pulse rounded-full bg-slate-800" />
      </div>
    </div>
  </div>

  <div
    v-else-if="pending"
    class="flex items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-16 text-sm text-slate-400"
    aria-busy="true"
  >
    <RefreshCw class="h-4 w-4 animate-spin" /> Loading…
  </div>

  <div
    v-else-if="empty"
    class="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center"
  >
    <p class="text-sm text-slate-300">
      {{ emptyText ?? 'Nothing here yet.' }}
    </p>
  </div>

  <slot v-else />
</template>
