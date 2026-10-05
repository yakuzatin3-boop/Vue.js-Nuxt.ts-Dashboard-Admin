<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  busy?: boolean
  error?: string | null
  tone?: 'danger' | 'brand'
}>()

const emit = defineEmits<{ confirm: [], close: [] }>()
</script>

<template>
  <Modal
    :open="open"
    size="sm"
    :title="title"
    :busy="busy"
    @close="emit('close')"
  >
    <div class="flex gap-3">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        :class="tone === 'brand' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'"
      >
        <TriangleAlert class="h-4 w-4" />
      </span>

      <div class="min-w-0 flex-1">
        <p class="text-sm text-slate-300">
          {{ message }}
        </p>
        <p
          v-if="error"
          class="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
        >
          {{ error }}
        </p>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/30 disabled:opacity-40"
        :disabled="busy"
        @click="emit('close')"
      >
        Cancel
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
        :class="tone === 'brand' ? 'bg-indigo-600 hover:brightness-110' : 'bg-rose-600 hover:bg-rose-600'"
        :disabled="busy"
        @click="emit('confirm')"
      >
        {{ busy ? 'Working…' : (confirmLabel ?? 'Delete') }}
      </button>
    </template>
  </Modal>
</template>
