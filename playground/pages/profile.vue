<script setup lang="ts">
import { Lock, Save, User, UserCircle } from '@lucide/vue'

useHead({ title: 'Profile' })

const api = useApiClient()
const auth = useAuth()
const { user } = auth
const toast = useToast()

const profileForm = reactive({
  name: user.value?.name ?? '',
  email: user.value?.email ?? '',
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const savingProfile = ref(false)
const savingPassword = ref(false)
const profileError = ref<string | null>(null)
const passwordError = ref<string | null>(null)

const resetPasswordForm = () => {
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordError.value = null
}

const updateProfile = async () => {
  profileError.value = null
  savingProfile.value = true
  try {
    await api.patch('/users/me', {
      name: profileForm.name.trim(),
      email: profileForm.email.trim(),
    })
    await auth.fetchProfile()
    toast.success('Profile updated')
  }
  catch (error) {
    profileError.value = error instanceof Error ? error.message : 'Failed to update profile'
  }
  finally {
    savingProfile.value = false
  }
}

const changePassword = async () => {
  passwordError.value = null

  if (passwordForm.newPassword.length < 8) {
    passwordError.value = 'New password must be at least 8 characters'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Passwords do not match'
    return
  }

  savingPassword.value = true
  try {
    await api.post('/auth/change-password', {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
    resetPasswordForm()
    toast.success('Password changed')
  }
  catch (error) {
    passwordError.value = error instanceof Error ? error.message : 'Failed to change password'
  }
  finally {
    savingPassword.value = false
  }
}

onMounted(async () => {
  if (!user.value) {
    await auth.fetchProfile()
  }
  profileForm.name = user.value?.name ?? ''
  profileForm.email = user.value?.email ?? ''
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Admin Profile"
      description="Manage your account details and security."
      :icon="UserCircle"
    />

    <div class="space-y-4 sm:space-y-5">
      <!-- Profile Info -->
      <Panel
        title="Profile Information"
        description="Update your display name and email address."
        :icon="User"
      >
        <form
          class="space-y-4"
          @submit.prevent="updateProfile"
        >
          <div>
            <label
              for="name"
              class="block text-sm font-medium text-slate-100"
            >Full Name</label>
            <input
              id="name"
              v-model="profileForm.name"
              type="text"
              placeholder="John Doe"
              class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
          </div>

          <div>
            <label
              for="email"
              class="block text-sm font-medium text-slate-100"
            >Email Address</label>
            <input
              id="email"
              v-model="profileForm.email"
              type="email"
              required
              placeholder="admin@store.com"
              class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
          </div>

          <p
            v-if="profileError"
            class="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
          >
            {{ profileError }}
          </p>

          <div class="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              :icon="Save"
              :loading="savingProfile"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Panel>

      <!-- Change Password -->
      <Panel
        title="Change Password"
        description="Update your password to keep your account secure."
        :icon="Lock"
      >
        <form
          class="space-y-4"
          @submit.prevent="changePassword"
        >
          <div>
            <label
              for="currentPassword"
              class="block text-sm font-medium text-slate-100"
            >Current Password</label>
            <input
              id="currentPassword"
              v-model="passwordForm.currentPassword"
              type="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                for="newPassword"
                class="block text-sm font-medium text-slate-100"
              >New Password</label>
              <input
                id="newPassword"
                v-model="passwordForm.newPassword"
                type="password"
                required
                autocomplete="new-password"
                placeholder="••••••••"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              >
            </div>

            <div>
              <label
                for="confirmPassword"
                class="block text-sm font-medium text-slate-100"
              >Confirm New Password</label>
              <input
                id="confirmPassword"
                v-model="passwordForm.confirmPassword"
                type="password"
                required
                autocomplete="new-password"
                placeholder="••••••••"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              >
            </div>
          </div>

          <p
            v-if="passwordError"
            class="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
          >
            {{ passwordError }}
          </p>

          <div class="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              :icon="Lock"
              :loading="savingPassword"
            >
              Change Password
            </Button>
          </div>
        </form>
      </Panel>

      <!-- Account Info -->
      <Panel
        title="Account Information"
        description="Your current account details."
      >
        <dl class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-slate-300">
              User ID
            </dt>
            <dd class="mt-1 text-sm font-mono text-slate-100">
              #{{ user?.id }}
            </dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-300">
              Role
            </dt>
            <dd class="mt-1 text-sm text-slate-100">
              <StatusBadge :value="user?.role ?? 'ADMIN'" />
            </dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-300">
              Status
            </dt>
            <dd class="mt-1 text-sm text-slate-100">
              <StatusBadge :value="user?.isActive ? 'ACTIVE' : 'INACTIVE'" />
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  </div>
</template>
