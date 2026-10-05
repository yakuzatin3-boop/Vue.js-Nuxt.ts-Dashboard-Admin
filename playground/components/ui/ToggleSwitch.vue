<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  label?: string
  description?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const toggle = () => {
  if (!props.disabled)
    emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/30 disabled:cursor-not-allowed disabled:opacity-60"
    @click="toggle"
  >
    <span class="min-w-0">
      <span class="block text-sm font-medium text-slate-100">{{ label }}</span>
      <span
        v-if="description"
        class="mt-0.5 block text-xs text-slate-400"
      >{{ description }}</span>
    </span>

    <span
      :class="[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        modelValue ? 'bg-indigo-600' : 'bg-slate-700',
      ]"
    >
      <span
        :class="[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
          modelValue ? 'translate-x-4.5' : 'translate-x-0.5',
        ]"
      />
    </span>
  </button>
</template>
