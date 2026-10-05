<script setup lang="ts">
/**
 * Segmented control used for the analytics range picker and similar small
 * exclusive choices. Implemented as a radio group so arrow keys and screen
 * readers behave the way they do for native radio inputs.
 */
export interface SegmentedOption {
  label: string
  value: string | number
}

const props = withDefaults(
  defineProps<{
    options: SegmentedOption[]
    modelValue: string | number
    label: string
  }>(),
  {},
)

const emit = defineEmits<{ 'update:modelValue': [string | number] }>()

const select = (value: string | number) => {
  if (value !== props.modelValue)
    emit('update:modelValue', value)
}

/** Roving focus, matching native radio-group keyboard behaviour. */
const onKeydown = (event: KeyboardEvent) => {
  const delta = event.key === 'ArrowRight' ? 1 : (event.key === 'ArrowLeft' ? -1 : 0)

  if (delta === 0)
    return

  event.preventDefault()

  const currentIndex = props.options.findIndex(option => option.value === props.modelValue)
  const nextIndex = (currentIndex + delta + props.options.length) / props.options.length

  const next = props.options[nextIndex]
  if (next) {
    select(next.value)
    nextTick(() => {
      document
        .querySelector<HTMLElement>(`[data-segmented="${CSS.escape(String(next.value))}"]`)
        ?.focus()
    })
  }
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="inline-flex items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-900/60 p-0.5"
    @keydown="onKeydown"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :data-segmented="String(option.value)"
      :aria-checked="option.value === modelValue"
      :tabindex="option.value === modelValue ? 0 : -1"
      class="rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
      :class="option.value === modelValue
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-slate-300 hover:bg-slate-800/30 hover:text-slate-100'"
      @click="select(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
