<script setup lang="ts">
import {
  Bell,
  Check,
  Copy,
  KeyRound,
  Link2,
  RefreshCw,
  Server,
  Send,
  Settings,
  Trash2,
} from '@lucide/vue'

import type { TelegramConnectLink, TelegramStatus } from '~/types/api'
import { formatDateTime } from '~/utils/format'

useHead({ title: 'Settings' })

const api = useApiClient()
const { user } = useAuth()
const config = useRuntimeConfig()
const toast = useToast()

const copy = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  }
  catch {
    toast.error('The clipboard is unavailable in this browser.')
  }
}

// ── Password ──────────────────────────────────────────────────────────────────
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordErrors = ref<Record<string, string>>({})
const changingPassword = ref(false)
const passwordError = ref<string | null>(null)

const submitPassword = async () => {
  passwordErrors.value = {}
  passwordError.value = null

  if (!passwordForm.currentPassword)
    passwordErrors.value.currentPassword = 'Enter your current password.'
  if (passwordForm.newPassword.length < 6)
    passwordErrors.value.newPassword = 'Use at least 6 characters.'
  else if (passwordForm.newPassword === passwordForm.currentPassword)
    passwordErrors.value.newPassword = 'The new password must be different.'
  if (passwordForm.newPassword !== passwordForm.confirmPassword)
    passwordErrors.value.confirmPassword = 'Passwords do not match.'

  if (Object.keys(passwordErrors.value).length > 0)
    return

  changingPassword.value = true

  try {
    await api.post('/auth/change-password', {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })

    Object.assign(passwordForm, { currentPassword: '', newPassword: '', confirmPassword: '' })
    toast.success('Password changed.')
  }
  catch (caught) {
    passwordError.value = (caught as Error).message
  }
  finally {
    changingPassword.value = false
  }
}

// ── Telegram ──────────────────────────────────────────────────────────────────
const { data: telegram, refresh: refreshTelegram, pending: telegramPending } = await useAsyncData<TelegramStatus>(
  'telegram-status',
  () => api.get<TelegramStatus>('/telegram/status').then(r => r.data),
)

const link = ref<TelegramConnectLink | null>(null)
const requestingLink = ref(false)
const disconnecting = ref(false)
const disconnectError = ref<string | null>(null)

const requestLink = async () => {
  requestingLink.value = true

  try {
    link.value = (await api.post<TelegramConnectLink>('/telegram/connect-link')).data
    toast.success('Connect link created. It expires shortly.')
  }
  catch (caught) {
    toast.error((caught as Error).message)
  }
  finally {
    requestingLink.value = false
  }
}

const confirmDisconnect = async () => {
  disconnecting.value = true
  disconnectError.value = null

  try {
    await api.delete('/telegram/link')
    await refreshTelegram()
    link.value = null
    toast.success('Telegram disconnected.')
  }
  catch (caught) {
    disconnectError.value = (caught as Error).message
  }
  finally {
    disconnecting.value = false
  }
}
</script>

<template>
  <PageHeader
    title="Settings"
    description="Your account, notifications and the API connection."
    :icon="Settings"
  >
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- Account -->
      <section class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-card">
        <div class="flex items-center gap-2">
          <KeyRound class="h-4 w-4 text-indigo-400" />
          <h2 class="text-sm font-semibold text-slate-100">
            Account
          </h2>
        </div>

        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-slate-300">
              Signed in as
            </dt>
            <dd class="truncate font-medium text-slate-100">
              {{ user?.email ?? '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-slate-300">
              Name
            </dt>
            <dd class="font-medium text-slate-100">
              {{ user?.name ?? '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-slate-300">
              Role
            </dt>
            <dd>
              <StatusBadge
                :value="user?.role ?? ''"
                iconless
              />
            </dd>
          </div>
        </dl>

        <p class="mt-4 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
          Edit your name, email or active flag on the
          <NuxtLink
            to="/users"
            class="font-medium text-indigo-400 hover:underline"
          >Users</NuxtLink>
          page.
        </p>
      </section>

      <!-- API connection -->
      <section class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-card">
        <div class="flex items-center gap-2">
          <Server class="h-4 w-4 text-indigo-400" />
          <h2 class="text-sm font-semibold text-slate-100">
            API connection
          </h2>
        </div>

        <p class="mt-3 text-sm text-slate-300">
          The dashboard reads and writes through the Nest API. These values come from the
          runtime config, so they change with the deployment rather than the code.
        </p>

        <div class="mt-4 space-y-2">
          <div
            v-for="entry in [
              { label: 'Browser (client)', value: config.public.apiBase },
              { label: 'Server (SSR)', value: config.apiBaseServer || config.public.apiBase },
            ]"
            :key="entry.label"
            class="flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-3 py-2"
          >
            <div class="min-w-0">
              <p class="text-xs text-slate-400">
                {{ entry.label }}
              </p>
              <p class="truncate font-mono text-xs text-slate-100">
                {{ entry.value }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-900/60 hover:text-indigo-400"
              :aria-label="`Copy ${entry.label}`"
              @click="copy(String(entry.value), entry.label)"
            >
              <Copy class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      <!-- Password -->
      <section class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-card">
        <div class="flex items-center gap-2">
          <KeyRound class="h-4 w-4 text-indigo-400" />
          <h2 class="text-sm font-semibold text-slate-100">
            Change password
          </h2>
        </div>

        <form
          class="mt-4 space-y-4"
          @submit.prevent="submitPassword"
        >
          <FormField
            label="Current password"
            required
            :error="passwordErrors.currentPassword"
          >
            <TextInput
              v-model="passwordForm.currentPassword"
              type="password"
              autocomplete="current-password"
              :invalid="Boolean(passwordErrors.currentPassword)"
            />
          </FormField>

          <FormField
            label="New password"
            required
            :error="passwordErrors.newPassword"
            hint="At least 6 characters."
          >
            <TextInput
              v-model="passwordForm.newPassword"
              type="password"
              autocomplete="new-password"
              :invalid="Boolean(passwordErrors.newPassword)"
            />
          </FormField>

          <FormField
            label="Confirm new password"
            required
            :error="passwordErrors.confirmPassword"
          >
            <TextInput
              v-model="passwordForm.confirmPassword"
              type="password"
              autocomplete="new-password"
              :invalid="Boolean(passwordErrors.confirmPassword)"
            />
          </FormField>

          <p
            v-if="passwordError"
            class="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
          >
            {{ passwordError }}
          </p>

          <Button
            variant="primary"
            type="submit"
            :loading="changingPassword"
          >
            Update password
          </Button>
        </form>
      </section>

      <!-- Telegram -->
      <section class="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-card">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Bell class="h-4 w-4 text-indigo-400" />
            <h2 class="text-sm font-semibold text-slate-100">
              Telegram notifications
            </h2>
          </div>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-slate-100"
            aria-label="Refresh Telegram status"
            @click="refreshTelegram()"
          >
            <RefreshCw
              class="h-3.5 w-3.5"
              :class="telegramPending ? 'animate-spin' : ''"
            />
          </button>
        </div>

        <p class="mt-3 text-sm text-slate-300">
          Connect your Telegram account to receive order, payment and low-stock alerts.
        </p>

        <div
          v-if="telegram?.connected"
          class="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-3 py-2.5"
        >
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-sm font-medium text-slate-100">
              <Check class="h-3.5 w-3.5 text-emerald-400" />
              Connected
            </p>
            <p class="truncate text-xs text-slate-400">
              @{{ telegram.username ?? 'unknown' }}
              <span v-if="telegram.linkedAt"> · since {{ formatDateTime(telegram.linkedAt) }}</span>
            </p>
          </div>
          <Button
            size="sm"
            variant="danger"
            :icon="Trash2"
            :loading="disconnecting"
            @click="confirmDisconnect"
          >
            Disconnect
          </Button>
        </div>

        <template v-else>
          <Button
            v-if="!link"
            variant="primary"
            class="mt-4"
            :icon="Send"
            :loading="requestingLink"
            @click="requestLink"
          >
            Generate connect link
          </Button>

          <div
            v-else
            class="mt-4 space-y-3 rounded-lg border border-slate-800/80 bg-slate-950 p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="flex items-center gap-1.5 text-sm font-medium text-slate-100">
                <Link2 class="h-3.5 w-3.5 text-indigo-400" />
                Open in Telegram
              </p>
              <button
                type="button"
                class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-900/60 hover:text-indigo-400"
                aria-label="Copy connect link"
                @click="copy(link.url, 'Connect link')"
              >
                <Copy class="h-3.5 w-3.5" />
              </button>
            </div>

            <p class="break-all font-mono text-xs text-slate-300">
              {{ link.url }}
            </p>

            <p class="text-xs text-slate-400">
              Expires {{ formatDateTime(link.expiresAt) }}. Starting the bot with this link pairs
              it with your account.
            </p>

            <div class="flex gap-2">
              <a
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="sm"
                  variant="primary"
                  :icon="Send"
                >
                  Open Telegram
                </Button>
              </a>
              <Button
                size="sm"
                @click="link = null"
              >
                Cancel
              </Button>
            </div>
          </div>
        </template>

        <p
          v-if="disconnectError"
          class="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
        >
          {{ disconnectError }}
        </p>
      </section>
    </div>
  </PageHeader>
</template>
