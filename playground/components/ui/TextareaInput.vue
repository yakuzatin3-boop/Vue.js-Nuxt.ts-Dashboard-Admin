<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    rows?: number
    placeholder?: string
    maxlength?: number
    required?: boolean
    disabled?: boolean
    invalid?: boolean
    /** Renders a live character count under the field. */
    counter?: boolean
  }>(),
  {
    rows: 4,
    placeholder: undefined,
    maxlength: undefined,
    required: false,
    disabled: false,
    invalid: false,
    counter: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div>
    <textarea
      :value="props.modelValue"
      :rows="props.rows"
      :placeholder="props.placeholder"
      :maxlength="props.maxlength"
      :required="props.required"
      :disabled="props.disabled"
      :aria-invalid="props.invalid || undefined"
      :class="[
        'w-full resize-y rounded-lg border bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500',
        'focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-950/60 disabled:text-slate-400',
        invalid
          ? 'border-rose-500/20 focus:border-rose-500/30 focus:ring-rose-500/20'
          : 'border-slate-800 hover:border-slate-700/80 focus:border-indigo-500/40 focus:ring-indigo-500/20',
      ]"
      @input="onInput"
    />

    <p
      v-if="props.counter && props.maxlength"
      class="nums mt-1 text-right text-xs text-slate-400"
    >
      {{ props.modelValue.length }} / {{ props.maxlength }}
    </p>
  </div>
</template>
