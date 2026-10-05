<script setup lang="ts">
import { X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    /** Tailwind max-width class for the panel. */
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Blocks backdrop/Escape dismissal while a request is in flight. */
    busy?: boolean
  }>(),
  { size: 'md', busy: false, description: undefined },
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)

const SIZES: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

/** Focus returns to whatever opened the dialog, so keyboard users are not dumped at the top of the page. */
let trigger: HTMLElement | null = null

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !props.busy)
    emit('close')
}

watch(
  () => props.open,
  (isOpen, wasOpen) => {
    if (import.meta.client) {
      if (isOpen && !wasOpen) {
        trigger = document.activeElement as HTMLElement | null
        document.addEventListener('keydown', onKeydown)
        document.body.style.overflow = 'hidden'
        // Wait for the panel to exist before moving focus, otherwise the call
        // lands on the still-hidden element and is dropped.
        void nextTick(() => panel.value?.querySelector<HTMLElement>('input, select, textarea, button')?.focus())
      }
      else if (!isOpen && wasOpen) {
        document.removeEventListener('keydown', onKeydown)
        document.body.style.overflow = ''
        trigger?.focus()
        trigger = null
      }
    }
  },
)

onBeforeUnmount(() => {
  if (!import.meta.client)
    return

  document.removeEventListener('keydown', onKeydown)
  // The dialog can be torn down while open (route change, parent v-if), which
  // would otherwise leave the page permanently unscrollable.
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-[oklch(24/_0.028_265_/_0.45)] p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
        @click.self="!busy && emit('close')"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          :class="[
            'flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-slate-900 shadow-raised sm:rounded-2xl',
            SIZES[size],
          ]"
        >
          <header class="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-slate-100">
                {{ title }}
              </h2>
              <p
                v-if="description"
                class="mt-0.5 text-sm text-slate-300"
              >
                {{ description }}
              </p>
            </div>
            <button
              type="button"
              class="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-slate-100 disabled:opacity-40"
              :disabled="busy"
              aria-label="Close dialog"
              @click="emit('close')"
            >
              <X class="h-4 w-4" />
            </button>
          </header>

          <div class="scrollbar-slim flex-1 overflow-y-auto px-5 py-4">
            <slot />
          </div>

          <footer
            v-if="$slots.footer"
            class="flex items-center justify-end gap-2 border-t border-slate-800/80 bg-slate-950/50 px-5 py-3"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
