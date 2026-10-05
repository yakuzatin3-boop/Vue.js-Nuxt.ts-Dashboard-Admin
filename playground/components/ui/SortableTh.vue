<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronsUpDown } from '@lucide/vue'

defineProps<{
  label: string
  /** Key this header sorts by; omit for a static column. */
  sortKey?: string | null
  state?: 'none' | 'ascending' | 'descending'
  align?: 'left' | 'right'
}>()

const emit = defineEmits<{ sort: [] }>()
</script>

<template>
  <th
    :scope="'col'"
    :class="[
      'px-4 py-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase',
      align === 'right' ? 'text-right' : 'text-left',
    ]"
  >
    <button
      v-if="sortKey"
      type="button"
      :aria-sort="state === 'none' ? 'none' : state"
      class="group inline-flex items-center gap-1 transition-colors hover:text-slate-100"
      @click="emit('sort')"
    >
      {{ label }}
      <ArrowUp
        v-if="state === 'ascending'"
        class="h-3 w-3"
      />
      <ArrowDown
        v-else-if="state === 'descending'"
        class="h-3 w-3"
      />
      <ChevronsUpDown
        v-else
        class="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50"
      />
    </button>
    <span v-else>{{ label }}</span>
  </th>
</template>
