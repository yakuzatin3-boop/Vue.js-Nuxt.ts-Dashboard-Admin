<script setup lang="ts">
import { Info, Pencil, Plus, RefreshCw, UserCog } from '@lucide/vue'

import type { User } from '~/types/api'
import type { ClientColumn } from '~/composables/useClientTable'
import { formatDate, initials } from '~/utils/format'

useHead({ title: 'Users' })

const api = useApiClient()
const { user: currentUser } = useAuth()

const { data: users, pending, error, refresh } = await useAsyncData<User[]>('users', () =>
  api.get<User[]>('/users').then(r => r.data),
)

const COLUMNS: ClientColumn<User>[] = [
  { key: 'name', label: 'User', sort: row => row.name ?? row.email },
  { key: 'email', label: 'Email', sort: row => row.email },
  { key: 'role', label: 'Role', sort: row => row.role },
  { key: 'status', label: 'Status' },
  { key: 'created', label: 'Created', sort: row => row.createdAt },
]

const {
  search,
  items,
  total,
  pages,
  page,
  sortState,
  toggleSort,
} = useClientTable(users, COLUMNS, {
  pageSize: 15,
  searchKeys: row => [row.name, row.email, row.role],
})

const { saving, error: saveError, clearError, create, update } = useCrud('User', refresh)

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'CUSTOMER', label: 'Customer' },
]

const blankForm = () => ({ name: '', email: '', password: '', role: 'ADMIN', isActive: true })

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const editingSelf = ref(false)
const form = reactive(blankForm())
const errors = ref<Record<string, string>>({})

const isEditing = computed(() => editingId.value !== null)

const openCreate = () => {
  editingId.value = null
  editingSelf.value = false
  Object.assign(form, blankForm())
  errors.value = {}
  clearError()
  formOpen.value = true
}

/*
 * The header's primary action deep-links here as `?create=1`. Watching the
 * query rather than a shared store keeps the trigger in the URL, so the modal
 * survives a refresh and the button works from a cold load.
 */
watch(() => useRoute().query.create, (value) => {
  if (value === '1')
    openCreate()
}, { immediate: true })

const openEdit = (row: User) => {
  editingId.value = row.id
  editingSelf.value = row.id === currentUser.value?.id
  Object.assign(form, {
    name: row.name ?? '',
    email: row.email,
    // Blank means "leave the current password alone"; the API treats an absent
    // password as no change.
    password: '',
    role: row.role,
    isActive: row.isActive,
  })
  errors.value = {}
  clearError()
  formOpen.value = true
}

const validate = () => {
  errors.value = {}

  if (!form.email.trim())
    errors.value.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(form.email.trim()))
    errors.value.email = 'Enter a valid email address.'

  // The API enforces the same 8-character minimum.
  if (isEditing.value) {
    if (form.password && form.password.length < 8)
      errors.value.password = 'Use at least 8 characters.'
  }
  else if (form.password.length < 8) {
    errors.value.password = 'A password of at least 8 characters is required.'
  }

  // Deactivating your own account locks you out of the dashboard.
  if (editingSelf.value && !form.isActive)
    errors.value.isActive = 'You cannot deactivate your own account.'

  return Object.keys(errors.value).length === 0
}

const payload = () => {
  const body: Record<string, string | boolean> = {
    email: form.email.trim(),
    role: form.role,
    isActive: form.isActive,
  }

  if (form.name.trim())
    body.name = form.name.trim()
  if (form.password)
    body.password = form.password

  return body
}

const submit = async () => {
  if (!validate())
    return

  const body = payload()

  const saved = isEditing.value
    ? await update(() => api.patch<User>(`/users/${editingId.value}`, body).then(r => r.data))
    : await create(() => api.post<User>('/users', body).then(r => r.data))

  if (saved) {
    formOpen.value = false

    // Editing your own account changes the profile the header renders from.
    if (editingSelf.value)
      await useAuth().fetchProfile()
  }
}
</script>

<template>
  <PageHeader
    title="Users"
    description="Manage admin and staff accounts."
    :icon="UserCog"
  >
    <template #actions>
      <Button
        :icon="RefreshCw"
        :loading="pending"
        @click="refresh()"
      >
        Refresh
      </Button>
      <Button
        variant="primary"
        :icon="Plus"
        @click="openCreate"
      >
        New user
      </Button>
    </template>

    <div class="space-y-4">
      <div class="flex items-start gap-2 rounded-xl border border-slate-800/80 bg-indigo-500/10 px-3.5 py-2.5 text-sm text-slate-300">
        <Info class="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
        <p>
          Customers created here are active immediately and skip the email verification that
          <code class="rounded bg-white/60 px-1 py-0.5 text-xs">POST /auth/register</code> requires.
          There is no delete endpoint, so accounts are deactivated instead.
        </p>
      </div>

      <input
        v-model="search"
        type="search"
        placeholder="Filter by name, email or role…"
        class="w-full max-w-xs rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
      >

      <DataState
        :pending="pending"
        :error="error"
        :empty="total === 0"
        :empty-text="search ? 'No users match your filter.' : 'No users yet.'"
        @refresh="refresh"
      >
        <div class="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-card">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-800/80 bg-slate-950/50 text-[11px] tracking-wider text-slate-400 uppercase">
                <tr>
                  <SortableTh
                    v-for="column in COLUMNS"
                    :key="column.key"
                    :label="column.label"
                    :sort-key="column.sort ? column.key : null"
                    :state="sortState(column.key)"
                    @sort="toggleSort(column.key)"
                  />
                  <th class="px-4 py-3" />
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/80">
                <tr
                  v-for="row in items"
                  :key="row.id"
                  class="hover:bg-slate-800/30"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">
                        {{ initials(row.name, row.email[0]?.toUpperCase() ?? 'U') }}
                      </span>
                      <p class="font-medium text-slate-100">
                        {{ row.name ?? '—' }}
                        <span
                          v-if="row.id === currentUser?.id"
                          class="ml-1 text-xs font-normal text-indigo-400"
                        >(you)</span>
                      </p>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ row.email }}
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    <StatusBadge
                      :value="row.role"
                      iconless
                    />
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge :value="row.isActive ? 'ACTIVE' : 'INACTIVE'" />
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ formatDate(row.createdAt) }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end">
                      <button
                        type="button"
                        :aria-label="`Edit ${row.email}`"
                        class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-indigo-400"
                        @click="openEdit(row)"
                      >
                        <Pencil class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <TablePagination
            :page="page"
            :pages="pages"
            :total="total"
            unit="users"
            @previous="page -= 1"
            @next="page += 1"
          />
        </div>
      </DataState>
    </div>

    <Modal
      :open="formOpen"
      size="sm"
      :title="isEditing ? 'Edit user' : 'New user'"
      :description="isEditing ? form.email : 'Accounts created here are active immediately.'"
      :busy="saving"
      @close="formOpen = false"
    >
      <div class="space-y-4">
        <FormField
          label="Name"
          hint="Optional. Leave blank to keep the account without a display name."
        >
          <TextInput
            v-model="form.name"
            placeholder="Store Admin"
          />
        </FormField>

        <FormField
          label="Email"
          required
          :error="errors.email"
        >
          <TextInput
            v-model="form.email"
            type="email"
            autocomplete="off"
            :invalid="Boolean(errors.email)"
          />
        </FormField>

        <FormField
          label="Password"
          :required="!isEditing"
          :hint="isEditing ? 'Leave blank to keep the current password.' : undefined"
          :error="errors.password"
        >
          <TextInput
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            :placeholder="isEditing ? '••••••••' : 'At least 8 characters'"
            :invalid="Boolean(errors.password)"
          />
        </FormField>

        <FormField
          label="Role"
          hint="Admins can reach every section of the dashboard and the admin API."
        >
          <SelectInput
            v-model="form.role"
            :options="ROLES"
            :placeholder="undefined"
          />
        </FormField>

        <ToggleSwitch
          v-model="form.isActive"
          label="Active"
          description="An inactive account cannot sign in."
        />
        <p
          v-if="errors.isActive"
          class="-mt-2 text-sm text-rose-400"
        >
          {{ errors.isActive }}
        </p>
      </div>

      <p
        v-if="saveError"
        class="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
      >
        {{ saveError }}
      </p>

      <template #footer>
        <Button
          :disabled="saving"
          @click="formOpen = false"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          @click="submit"
        >
          {{ isEditing ? 'Save changes' : 'Create user' }}
        </Button>
      </template>
    </Modal>
  </PageHeader>
</template>
