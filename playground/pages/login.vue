<script setup lang="ts">
import { LoaderCircle, Lock, Mail, Store } from '@lucide/vue'

definePageMeta({ layout: false })

useHead({ title: 'Sign in' })

const { login } = useAuth()

const email = ref('')
const password = ref('')
const pending = ref(false)
const errorMessage = ref<string | null>(null)

const submit = async () => {
  errorMessage.value = null
  pending.value = true

  try {
    await login(email.value, password.value)
    await navigateTo('/')
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Sign in failed'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-7 text-center">
        <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-card">
          <Store class="h-6 w-6" />
        </span>
        <h1 class="mt-4 text-xl font-bold tracking-tight text-slate-100">
          Ecommerce Admin
        </h1>
        <p class="mt-1 text-sm text-slate-400">
          Sign in to manage your store
        </p>
      </div>

      <form
        class="space-y-4 rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md"
        @submit.prevent="submit"
      >
        <div>
          <label
            for="email"
            class="block text-xs font-semibold tracking-wide text-slate-300"
          >Email</label>
          <div class="relative mt-1.5">
            <Mail class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="admin@store.com"
              class="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pr-3 pl-9 text-sm text-slate-100 transition-colors placeholder:text-slate-500 hover:border-slate-700/80 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
          </div>
        </div>

        <div>
          <label
            for="password"
            class="block text-xs font-semibold tracking-wide text-slate-300"
          >Password</label>
          <div class="relative mt-1.5">
            <Lock class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="Your password"
              class="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pr-3 pl-9 text-sm text-slate-100 transition-colors placeholder:text-slate-500 hover:border-slate-700/80 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
          </div>
        </div>

        <p
          v-if="errorMessage"
          class="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
          role="alert"
        >
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          :disabled="pending"
          class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LoaderCircle
            v-if="pending"
            class="h-4 w-4 animate-spin"
          />
          {{ pending ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="mt-4 text-center text-[11px] text-slate-500">
        Only ADMIN accounts can reach the dashboard.
      </p>
    </div>
  </div>
</template>
