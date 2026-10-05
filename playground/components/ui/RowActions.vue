<script setup lang="ts">
import { Pencil, Trash2 } from '@lucide/vue'

/** Icon action pair for a table row, so row-level controls stay visually identical on every page. */
defineProps<{
  editLabel?: string
  deleteLabel?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ edit: [], remove: [] }>()
</script>

<template>
  <div class="flex items-center justify-end gap-1">
    <button
      type="button"
      :aria-label="editLabel ?? 'Edit'"
      :title="editLabel ?? 'Edit'"
      :disabled="disabled"
      class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
      @click="emit('edit')"
    >
      <Pencil class="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      :aria-label="deleteLabel ?? 'Delete'"
      :title="deleteLabel ?? 'Delete'"
      :disabled="disabled"
      class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
      @click="emit('remove')"
    >
      <Trash2 class="h-3.5 w-3.5" />
    </button>
  </div>
</template>
