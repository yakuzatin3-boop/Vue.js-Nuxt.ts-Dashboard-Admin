<script setup lang="ts">
/**
 * Floating launcher for the insights assistant, mounted once from the layout.
 * Only admins see it — the panel and all its routes are admin-only server-side,
 * so the button doubling as a gate would just produce confusing 403s.
 */
import { Sparkles, X } from '@lucide/vue'

const { open, toggle } = useAiInsights()
const { isAdmin } = useAuth()
</script>

<template>
  <div v-if="isAdmin">
    <button
      type="button"
      :aria-label="open ? 'Close assistant' : 'Open assistant'"
      :title="open ? 'Close assistant' : 'Open assistant'"
      class="fixed right-5 bottom-5 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-[var(--shadow-raised)] transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-110"
      @click="toggle"
    >
      <component
        :is="open ? X : Sparkles"
        class="h-5 w-5"
      />
      <span class="hidden sm:inline">
        {{ open ? 'Close' : 'Ask AI' }}
      </span>
    </button>

    <AiInsightsPanel />
  </div>
</template>
