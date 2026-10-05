<script setup lang="ts">
/**
 * Bare text control. Styling lives here so every form in the dashboard looks
 * the same; wrap it in `FormField` for the label and validation message.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | number | null
    type?: string
    placeholder?: string
    min?: string | number
    max?: string | number
    step?: string | number
    required?: boolean
    disabled?: boolean
    invalid?: boolean
    /** Text aligned to the right, for prices and quantities. */
    align?: 'left' | 'right'
    autocomplete?: string
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    min: undefined,
    max: undefined,
    step: undefined,
    required: false,
    disabled: false,
    invalid: false,
    align: 'left',
    autocomplete: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <input
    :type="props.type"
    :value="props.modelValue ?? ''"
    :placeholder="props.placeholder"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :required="props.required"
    :disabled="props.disabled"
    :autocomplete="props.autocomplete"
    :aria-invalid="props.invalid || undefined"
    :class="[
      'w-full rounded-lg border bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500',
      'focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-950/60 disabled:text-slate-400',
      props.align === 'right' ? 'nums text-right' : '',
      props.invalid
        ? 'border-rose-500/20 focus:border-rose-500/30 focus:ring-rose-500/20'
        : 'border-slate-800 hover:border-slate-700/80 focus:border-indigo-500/40 focus:ring-indigo-500/20',
    ]"
    @input="onInput"
  >
</template>
