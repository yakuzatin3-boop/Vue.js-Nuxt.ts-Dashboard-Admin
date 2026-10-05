<script setup lang="ts">
import { Loader } from '@lucide/vue'
import type { Component } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
    size?: 'sm' | 'md'
    type?: 'button' | 'submit'
    icon?: Component
    /** Renders after the label, e.g. a count badge. */
    trailingIcon?: Component
    loading?: boolean
    disabled?: boolean
    /** Full-width, for modal footers. */
    block?: boolean
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    icon: undefined,
    trailingIcon: undefined,
    loading: false,
    disabled: false,
    block: false,
  },
)

const VARIANTS: Record<string, string> = {
  primary: 'bg-indigo-600 text-white hover:brightness-110 disabled:hover:brightness-100',
  secondary: 'border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800/30 hover:text-slate-100',
  ghost: 'text-slate-300 hover:bg-slate-800/30 hover:text-slate-100',
  subtle: 'bg-indigo-500/10 text-indigo-400 hover:brightness-95',
  danger: 'bg-rose-600 text-white hover:bg-rose-600',
}

const SIZES: Record<string, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3 py-2 text-sm gap-2',
}

const iconSize = computed(() => (props.size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'))
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'inline-flex items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
      VARIANTS[variant],
      SIZES[size],
      block ? 'w-full' : '',
    ]"
  >
    <Loader
      v-if="loading"
      :class="['animate-spin', iconSize]"
    />
    <component
      :is="icon"
      v-else-if="icon"
      :class="iconSize"
    />
    <slot />
    <component
      :is="trailingIcon"
      v-if="trailingIcon && !loading"
      :class="iconSize"
    />
  </button>
</template>
