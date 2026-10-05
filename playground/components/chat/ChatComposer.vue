<script setup lang="ts">
/**
 * The composer sits below the transcript. Kept as its own component because the
 * page's only job is layout: it owns the message list, this owns the input.
 *
 * Two details that matter for a chat input:
 * - Enter sends, Shift+Enter inserts a newline. A question can be more than one
 *   line and there is no other way to type a multi-line question.
 * - `maxlength` plus a live counter. The engine truncates nothing, so an
 *   unbounded paste would just produce an unmatched question.
 */
import { ArrowUp, Square } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    busy?: boolean
    suggestions?: string[]
  }>(),
  { busy: false, suggestions: () => [] },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'submit': []
  'suggest': [question: string]
}>()

const MAX = 400

const input = ref<HTMLTextAreaElement | null>(null)

const remaining = computed(() => MAX - props.modelValue.length)
const atLimit = computed(() => remaining.value <= 0)
const canSend = computed(() => props.modelValue.trim().length > 0 && !props.busy)

/**
 * Grows with the content up to a cap, then scrolls. Height is explicit so the
 *  transcript above does not jump while typing.
 */
const autoGrow = () => {
  const node = input.value
  if (!node)
    return

  node.style.height = 'auto'
  node.style.height = `${Math.min(node.scrollHeight, 160)}px`
}

watch(() => props.modelValue, () => nextTick(autoGrow))

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing)
    return

  // Enter is send unless the user asked for a newline with Shift.
  event.preventDefault()

  if (canSend.value)
    emit('submit')
}

const onPaste = (event: ClipboardEvent) => {
  const pasted = event.clipboardData?.getData('text') ?? ''

  if (!pasted)
    return

  const next = (props.modelValue + pasted).slice(0, MAX)

  if (next.length < (props.modelValue + pasted).length) {
    event.preventDefault()
    emit('update:modelValue', next)
  }
}
</script>

<template>
  <div class="border-t border-slate-800/80 bg-slate-900/60 px-4 py-4 sm:px-5">
    <div
      v-if="suggestions.length"
      class="mb-3 flex flex-wrap items-center gap-2"
    >
      <button
        v-for="suggestion in suggestions"
        :key="suggestion"
        type="button"
        class="rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-400 disabled:opacity-50"
        :disabled="busy"
        @click="emit('suggest', suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>

    <form
      class="flex items-end gap-2"
      @submit.prevent="canSend && emit('submit')"
    >
      <div class="relative min-w-0 flex-1">
        <label
          for="chart-bot-input"
          class="sr-only"
        >
          Ask the Chart Bot a question about this store
        </label>

        <textarea
          id="chart-bot-input"
          ref="input"
          :value="modelValue"
          rows="1"
          :maxlength="MAX"
          :disabled="busy"
          placeholder="Ask about revenue, orders, products, stock, payments or customers…"
          autocomplete="off"
          aria-describedby="chart-bot-hint"
          class="max-h-40 w-full resize-none rounded-xl border border-slate-800/80 bg-slate-950/50 px-3.5 py-2.5 text-sm leading-6 text-slate-100 transition-colors outline-none placeholder:text-slate-500 focus:border-indigo-500/40 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          @input="onInput"
          @keydown="onKeydown"
          @paste="onPaste"
        />
      </div>

      <!-- Native button rather than Button: this one is icon-only and square, and
           the shared primitive's size classes assume a text label. -->
      <button
        type="submit"
        :disabled="!canSend"
        :aria-label="busy ? 'Waiting for an answer' : 'Send question'"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Square
          v-if="busy"
          class="h-3.5 w-3.5 animate-pulse"
        />
        <ArrowUp
          v-else
          class="h-4 w-4"
        />
      </button>
    </form>

    <p
      id="chart-bot-hint"
      class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400"
    >
      <span>Enter sends · Shift+Enter adds a line</span>
      <span
        class="nums"
        :class="atLimit ? 'text-amber-400' : ''"
      >
        {{ remaining }} characters left
      </span>
    </p>
  </div>
</template>
