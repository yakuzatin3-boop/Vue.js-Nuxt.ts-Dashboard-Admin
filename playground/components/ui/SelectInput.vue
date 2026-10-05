<script setup lang="ts">
export interface SelectOption {
  value: string | number | null
  label: string
}

withDefaults(
  defineProps<{
    modelValue: string | number | null
    options: SelectOption[]
    placeholder?: string
    required?: boolean
    disabled?: boolean
    invalid?: boolean
  }>(),
  { placeholder: 'Select…', required: false, disabled: false, invalid: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const onChange = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <select
    :value="modelValue ?? ''"
    :required="required"
    :disabled="disabled"
    :aria-invalid="invalid || undefined"
    :class="[
      'w-full rounded-lg border bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition-colors',
      'focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-950/60 disabled:text-slate-400',
      invalid
        ? 'border-rose-500/20 focus:border-rose-500/30 focus:ring-rose-500/20'
        : 'border-slate-800 hover:border-slate-700/80 focus:border-indigo-500/40 focus:ring-indigo-500/20',
    ]"
    @change="onChange"
  >
    <option
      v-if="placeholder"
      value=""
    >
      {{ placeholder }}
    </option>
    <option
      v-for="option in options"
      :key="option.value ?? '__none__'"
      :value="option.value ?? ''"
    >
      {{ option.label }}
    </option>
  </select>
</template>
