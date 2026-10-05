<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from '@lucide/vue'

const { toasts, dismiss } = useToast()

const TONES = {
  success: { chip: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300', icon: CircleCheck, iconTone: 'text-emerald-400' },
  error: { chip: 'border-rose-500/20 bg-rose-500/10 text-rose-300', icon: CircleAlert, iconTone: 'text-rose-400' },
  info: { chip: 'border-slate-800 bg-slate-900/60 text-slate-100', icon: Info, iconTone: 'text-indigo-400' },
} as const
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      role="status"
      aria-live="polite"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-y-1 opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-raised',
            TONES[toast.tone].chip,
          ]"
        >
          <component
            :is="TONES[toast.tone].icon"
            :class="['mt-0.5 h-4 w-4 shrink-0', TONES[toast.tone].iconTone]"
          />
          <p class="flex-1 text-sm font-medium">
            {{ toast.message }}
          </p>
          <button
            type="button"
            class="-mr-1 -mt-0.5 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Dismiss notification"
            @click="dismiss(toast.id)"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
