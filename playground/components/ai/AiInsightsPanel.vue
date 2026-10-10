<script setup lang="ts">
/**
 * The assistant drawer. Teleported to `body` so it floats above the layout and
 * page content without inheriting a parent transform.
 *
 * The transcript auto-scrolls while a reply streams in, and the footer holds
 * the quick-action presets plus the composer. Rendering the reply uses a tiny
 * escape-first markdown renderer, so `v-html` is safe even when the model
 * quotes user-supplied text.
 */
import { AI_INSIGHTS_PRESETS } from '~/types/ai-insights'
import { formatDateTime } from '~/utils/format'
import { renderMarkdown } from '~/utils/markdown'
import {
  ArrowUp,
  Bot,
  Copy,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  TriangleAlert,
  User,
  X,
} from '@lucide/vue'

const {
  open,
  messages,
  thinking,
  chartContext,
  hasHistory,
  toggle,
  clearChartContext,
  send,
  sendPreset,
  clear,
  retry,
  copyLastAnswer,
} = useAiInsights()

const MAX = 2000

const draft = ref('')

/** Renders assistant turns at markup time so streaming does not re-run per token. */
const turns = computed(() =>
  messages.value.map(turn => ({ ...turn, html: turn.role === 'assistant' ? renderMarkdown(turn.text) : '' })),
)

const lastTurn = computed(() => turns.value.at(-1))

// An assistant turn with no text yet is the thinking state: show the dots.
const streaming = computed(
  () => thinking.value && lastTurn.value?.role === 'assistant' && lastTurn.value.text === '',
)

const remaining = computed(() => MAX - draft.value.length)
const atLimit = computed(() => remaining.value <= 0)
const canSend = computed(() => draft.value.trim().length > 0 && !thinking.value)

const scroller = ref<HTMLElement | null>(null)

const scrollToBottom = () => {
  nextTick(() => scroller.value?.scrollTo({ top: scroller.value.scrollHeight }))
}

watch(
  () => [
    messages.value.length,
    messages.value.at(-1)?.text.length,
    messages.value.at(-1)?.error,
  ],
  scrollToBottom,
)

const submit = () => {
  if (!canSend.value)
    return

  const question = draft.value

  draft.value = ''
  void send(question)
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing)
    return

  event.preventDefault()

  if (canSend.value)
    submit()
}

const onInput = (event: Event) => {
  draft.value = (event.target as HTMLTextAreaElement).value.slice(0, MAX)
}

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

const copyAnswer = async () => {
  await copyLastAnswer()
  copied.value = true

  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, 1200)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ai-backdrop">
      <div
        v-if="open"
        class="ai-backdrop"
        aria-hidden="true"
        @click="toggle"
      />
    </Transition>

    <Transition name="ai-panel">
      <aside
        v-if="open"
        role="dialog"
        aria-label="Admin insights assistant"
        class="ai-panel fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[min(26rem,100%)] flex-col border-l border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl shadow-[var(--shadow-raised)]"
      >
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 px-4 py-4 sm:px-5">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Sparkles class="h-[18px] w-[18px]" />
            </span>

            <div class="min-w-0">
              <h2 class="truncate text-[15px] leading-6 font-semibold text-slate-900 dark:text-slate-100">
                Assistant
              </h2>
              <p class="truncate text-xs text-slate-500">
                Gemini · reads the same data as your charts
              </p>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              :disabled="copied"
              :aria-label="copied ? 'Answer copied' : 'Copy last answer'"
              :title="copied ? 'Answer copied' : 'Copy last answer'"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100"
              @click="copyAnswer"
            >
              <Copy class="h-4 w-4" />
            </button>

            <button
              type="button"
              aria-label="Clear conversation"
              title="Clear conversation"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100"
              @click="clear"
            >
              <Trash2 class="h-4 w-4" />
            </button>

            <button
              type="button"
              aria-label="Close assistant"
              title="Close"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100"
              @click="toggle"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </header>

        <div
          ref="scroller"
          class="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
        >
          <div
            v-if="chartContext"
            class="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2"
          >
            <Sparkles class="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <p class="min-w-0 flex-1 truncate text-xs text-indigo-700 dark:text-indigo-300">
              Asking about
              <span class="font-semibold">{{ chartContext.chartTitle }}</span>
            </p>
            <button
              type="button"
              aria-label="Clear chart context"
              class="shrink-0 text-indigo-500 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200"
              @click="clearChartContext"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>

          <article
            v-for="turn in turns"
            :key="turn.id"
            class="flex gap-3"
            :class="turn.role === 'user' ? 'flex-row-reverse' : ''"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              :class="turn.role === 'user'
                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                : 'bg-indigo-600 text-white'"
              :aria-hidden="true"
            >
              <component
                :is="turn.role === 'user' ? User : Bot"
                class="h-4 w-4"
              />
            </span>

            <div
              class="flex min-w-0 max-w-[min(26rem,86%)] flex-col gap-1"
              :class="turn.role === 'user' ? 'items-end' : 'items-start'"
            >
              <div
                class="w-full rounded-2xl px-4 py-3"
                :class="turn.role === 'user'
                  ? 'rounded-br-md bg-indigo-600 text-white'
                  : 'rounded-bl-md border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/50'"
              >
                <p
                  v-if="turn.role === 'user'"
                  class="text-sm leading-6 whitespace-pre-wrap"
                >
                  {{ turn.text }}
                </p>

                <p
                  v-else-if="turn.error"
                  class="flex items-start gap-2 text-sm leading-6 text-rose-600 dark:text-rose-400"
                >
                  <TriangleAlert class="mt-1 h-4 w-4 shrink-0" />
                  {{ turn.text }}
                </p>

                <div
                  v-else-if="streaming && turn.text === ''"
                  class="flex h-6 items-center gap-1"
                  aria-label="Assistant is thinking"
                >
                  <span
                    v-for="index in 3"
                    :key="index"
                    class="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"
                    :style="{ animationDelay: `${(index - 1) * 0.15}s` }"
                  />
                </div>

                <!-- Rendered from an escape-first markdown pass: the rule below only exists
                     because the directive is not a sanitizer, and sanitizing already
                     happened upstream in `utils/markdown`. -->
                <!-- eslint-disable vue/no-v-html -->
                <div
                  v-else
                  class="markdown"
                  v-html="turn.html"
                />
                <!-- eslint-enable vue/no-v-html -->
              </div>

              <time
                :datetime="new Date(turn.at).toISOString()"
                class="px-1 text-[11px] text-slate-600 dark:text-slate-400"
              >
                {{ turn.role === 'user' ? 'You' : 'Assistant' }} · {{ formatDateTime(new Date(turn.at).toISOString()) }}
              </time>
            </div>
          </article>
        </div>

        <footer class="shrink-0 border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 px-4 py-3 sm:px-5">
          <div class="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button
              v-for="preset in AI_INSIGHTS_PRESETS"
              :key="preset.label"
              type="button"
              :disabled="thinking"
              :title="preset.hint"
              class="whitespace-nowrap rounded-full border border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-indigo-400"
              @click="sendPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>

          <form
            class="flex items-end gap-2"
            @submit.prevent="submit"
          >
            <div class="relative min-w-0 flex-1">
              <label
                for="ai-insights-input"
                class="sr-only"
              >
                Ask the assistant a question
              </label>

              <textarea
                id="ai-insights-input"
                :value="draft"
                rows="1"
                :maxlength="MAX"
                :disabled="thinking"
                :placeholder="chartContext ? 'Ask about this chart…' : 'Ask about revenue, orders, products or inventory…'"
                autocomplete="off"
                aria-describedby="ai-insights-hint"
                class="min-h-10 max-h-40 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/50 px-3.5 py-2.5 text-sm leading-6 text-slate-900 dark:text-slate-100 transition-colors outline-none placeholder:text-slate-500 focus:border-indigo-500/40 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:bg-slate-900"
                @input="onInput"
                @keydown="onKeydown"
              />
            </div>

            <button
              type="submit"
              :disabled="!canSend"
              :aria-label="thinking ? 'Waiting for an answer' : 'Send question'"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Square
                v-if="thinking"
                class="h-3.5 w-3.5 animate-pulse"
              />
              <ArrowUp
                v-else
                class="h-4 w-4"
              />
            </button>
          </form>

          <p
            id="ai-insights-hint"
            class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400"
          >
            <span class="flex items-center gap-3">
              <span>Enter sends · Shift+Enter adds a line</span>
              <button
                v-if="hasHistory"
                type="button"
                class="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                @click="retry"
              >
                <RotateCcw class="h-3 w-3" />
                Start over
              </button>
            </span>
            <span
              class="nums"
              :class="atLimit ? 'text-amber-700 dark:text-amber-400' : ''"
            >
              {{ remaining }} characters left
            </span>
          </p>
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ai-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: oklch(0% 0 0 / 0.4);
}

.ai-panel-enter-active,
.ai-panel-leave-active {
  transition: transform 280ms ease;
  will-change: transform;
}

.ai-panel-enter-from,
.ai-panel-leave-to {
  transform: translateX(100%);
}

.ai-backdrop-enter-active,
.ai-backdrop-leave-active {
  transition: opacity 200ms ease;
}

.ai-backdrop-enter-from,
.ai-backdrop-leave-to {
  opacity: 0;
}

.typing-dot {
  animation: ai-bounce 1s ease-in-out infinite;
}

@keyframes ai-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }

  40% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

/* The model renders into `.markdown` via v-html, and Tailwind cannot resolve
   `@apply` inside a Vue scoped block, so these styles are plain CSS written
   against the exact slate/indigo palette the rest of the admin uses. Dark mode
   is `html.dark` (class-driven), so the flip is expressed that way here too. */
:deep(.markdown) {
  font-size: 0.875rem;
  line-height: 1.5rem;
  color: #0f172a;
  overflow-wrap: break-word;
}

:deep(.markdown p) {
  margin: 0;
}

:deep(.markdown > * + *) {
  margin-top: 0.5rem;
}

:deep(.markdown h2) {
  margin-top: 1.25rem;
  margin-bottom: 0.25rem;
  font-size: 1rem;
  line-height: 1.5rem;
  font-weight: 600;
}

:deep(.markdown h3),
:deep(.markdown h4) {
  margin-top: 1rem;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  line-height: 1.5rem;
  font-weight: 600;
}

:deep(.markdown ul),
:deep(.markdown ol) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
  padding-left: 0;
}

:deep(.markdown li) {
  position: relative;
  margin-top: 0.25rem;
  padding-left: 1rem;
}

:deep(.markdown li::before) {
  content: '–';
  position: absolute;
  top: 0;
  left: 0;
  color: #94a3b8; /* slate-400 */
}

:deep(.markdown ol) {
  counter-reset: ai-insights;
}

:deep(.markdown ol > li::before) {
  counter-increment: ai-insights;
  content: counter(ai-insights) '.';
  position: absolute;
  top: 0;
  left: 0;
  font-weight: 500;
  color: #94a3b8; /* slate-400 */
}

:deep(.markdown code) {
  border-radius: 0.25rem;
  background: #f1f5f9; /* slate-100 */
  padding: 0.125rem 0.375rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem;
  line-height: 1.25rem;
  overflow-wrap: anywhere;
  color: #4f46e5; /* indigo-600 */
}

:deep(.markdown pre) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
  overflow-x: auto;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0; /* slate-200 */
  background: #0f172a; /* slate-900 */
  padding: 0.75rem 1rem;
}

:deep(.markdown pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.75rem;
  line-height: 1.25rem;
  color: #f1f5f9; /* slate-100 */
}

:deep(.markdown blockquote) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
  border-left: 2px solid rgb(99 102 241 / 0.4); /* indigo-500/40 */
  padding-left: 0.75rem;
  color: #475569; /* slate-600 */
}

:deep(.markdown a) {
  color: #4f46e5; /* indigo-600 */
  text-decoration: underline;
  text-underline-offset: 2px;
}

:deep(.markdown a:hover) {
  opacity: 0.8;
}

html.dark :deep(.markdown) {
  color: #f1f5f9; /* slate-100 */
}

html.dark :deep(.markdown code) {
  background: #1e293b; /* slate-800 */
  color: #818cf8; /* indigo-400 */
}

html.dark :deep(.markdown pre) {
  border-color: #1e293b; /* slate-800 */
  background: #020617; /* slate-950 */
}

html.dark :deep(.markdown pre code) {
  color: #f1f5f9;
}

html.dark :deep(.markdown blockquote) {
  color: #94a3b8; /* slate-400 */
}

html.dark :deep(.markdown a) {
  color: #818cf8; /* indigo-400 */
}
</style>
