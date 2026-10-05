<script setup lang="ts">
import {
  CircleCheck,
  CircleX,
  Clock,
  CreditCard,
  Loader,
  Truck,
  Undo2,
  Wallet,
} from '@lucide/vue'
import type { Component } from 'vue'

interface StatusStyle {
  chip: string
  icon: Component
}

// Icon and colour per status. Both are carried together so a new status cannot
// be added with a chip style but no icon, which would fall through to the dash.
const STATUS_STYLES: Record<string, StatusStyle> = {
  PENDING: { chip: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', icon: Clock },
  PAID: { chip: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', icon: Wallet },
  PROCESSING: { chip: 'bg-sky-500/10 text-sky-400 ring-sky-500/20', icon: Loader },
  SHIPPED: { chip: 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20', icon: Truck },
  DELIVERED: { chip: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', icon: CircleCheck },
  CANCELLED: { chip: 'bg-rose-500/10 text-rose-400 ring-rose-500/20', icon: CircleX },
  FAILED: { chip: 'bg-rose-500/10 text-rose-400 ring-rose-500/20', icon: CircleX },
  REFUNDED: { chip: 'bg-slate-500/10 text-slate-400 ring-slate-500/20', icon: Undo2 },
  ACTIVE: { chip: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', icon: CircleCheck },
  INACTIVE: { chip: 'bg-slate-500/10 text-slate-400 ring-slate-500/20', icon: CircleX },
  COD: { chip: 'bg-violet-500/10 text-violet-400 ring-violet-500/20', icon: CreditCard },
}

const props = withDefaults(
  defineProps<{
    value: string | null | undefined
    /** Hides the icon where space is tight, e.g. inside a chart legend. */
    iconless?: boolean
  }>(),
  { iconless: false },
)

const entry = computed(() => STATUS_STYLES[props.value ?? ''])

const chip = computed(
  () => entry.value?.chip ?? 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
)

const label = computed(() => props.value ?? '—')
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
      chip,
    ]"
  >
    <component
      :is="entry?.icon"
      v-if="entry && !iconless"
      class="h-3 w-3 shrink-0"
    />
    {{ label }}
  </span>
</template>
