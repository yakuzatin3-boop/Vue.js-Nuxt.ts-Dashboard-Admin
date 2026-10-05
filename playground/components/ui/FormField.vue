<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    error?: string | null
    hint?: string
    required?: boolean
    /** Spans the full form width on the two-column form grid. */
    full?: boolean
  }>(),
  { error: null, hint: undefined, required: false, full: false },
)
</script>

<template>
  <div
    :class="full ? 'sm:col-span-2' : ''"
  >
    <span class="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-100">
      {{ label }}
      <span
        v-if="required"
        class="text-rose-400"
        aria-hidden="true"
      >*</span>
    </span>

    <slot />

    <p
      v-if="error"
      class="mt-1.5 text-xs font-medium text-rose-400"
    >
      {{ error }}
    </p>
    <p
      v-else-if="hint"
      class="mt-1.5 text-xs text-slate-400"
    >
      {{ hint }}
    </p>
  </div>
</template>
