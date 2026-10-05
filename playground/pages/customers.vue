<script setup lang="ts">
import { Info, Pencil, Plus, RefreshCw, Trash2, Users } from '@lucide/vue'

import type { Customer, User } from '~/types/api'
import type { ClientColumn } from '~/composables/useClientTable'
import { formatDate, initials } from '~/utils/format'

useHead({ title: 'Customers' })

const api = useApiClient()

const { data: customers, pending, error, refresh } = await useAsyncData<Customer[]>('customers', () =>
  api.get<Customer[]>('/customers').then(r => r.data),
)
const { data: users } = await useAsyncData<User[]>('customer-user-options', () =>
  api.get<User[]>('/users').then(r => r.data),
)

const GENDERS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
]

/** The API creates a customer for an existing user, so only unclaimed users are offered. */
const claimedUserIds = computed(
  () => new Set((customers.value ?? []).map(customer => customer.userId)),
)

const unclaimedUsers = computed(() =>
  (users.value ?? []).filter(user => !claimedUserIds.value.has(user.id)),
)

const unclaimedOptions = computed(() => [
  { value: null, label: 'Select a user…' },
  ...unclaimedUsers.value.map(user => ({
    value: user.id,
    label: `${user.name ?? user.email} · ${user.email}`,
  })),
])

const COLUMNS: ClientColumn<Customer>[] = [
  { key: 'customer', label: 'Customer', sort: row => row.user?.name ?? row.user?.email ?? '' },
  { key: 'location', label: 'Location', sort: row => [row.city, row.country].filter(Boolean).join(', ') },
  { key: 'phone', label: 'Phone', sort: row => row.phone ?? '' },
  { key: 'address', label: 'Address' },
  { key: 'joined', label: 'Joined', sort: row => row.createdAt },
  { key: 'account', label: 'Account' },
]

const {
  search,
  items,
  total,
  pages,
  page,
  sortState,
  toggleSort,
} = useClientTable(customers, COLUMNS, {
  pageSize: 15,
  searchKeys: row => [
    row.user?.name,
    row.user?.email,
    row.city,
    row.country,
    row.phone,
    row.address,
  ],
})

const { saving, error: saveError, clearError, create, update, remove } = useCrud('Customer', refresh)

const blankForm = () => ({
  userId: '',
  phone: '',
  address: '',
  city: '',
  country: '',
  gender: '',
  dateOfBirth: '',
})

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const form = reactive(blankForm())
const errors = ref<Record<string, string>>({})
const removalTarget = ref<Customer | null>(null)
const removing = ref(false)
const removeError = ref<string | null>(null)

const isEditing = computed(() => editingId.value !== null)

/** Shown as the modal subtitle so it is clear which profile is being edited. */
const editingCustomer = computed(() =>
  (customers.value ?? []).find(customer => customer.id === editingId.value),
)

const openCreate = () => {
  editingId.value = null
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

const openEdit = (customer: Customer) => {
  editingId.value = customer.id
  Object.assign(form, {
    // Not editable through the API, and only offered when creating.
    userId: '',
    phone: customer.phone ?? '',
    address: customer.address ?? '',
    city: customer.city ?? '',
    country: customer.country ?? '',
    gender: customer.gender ?? '',
    dateOfBirth: customer.dateOfBirth ?? '',
  })
  errors.value = {}
  clearError()
  formOpen.value = true
}

const validate = () => {
  errors.value = {}

  if (!isEditing.value && !form.userId)
    errors.value.userId = 'Choose the user this profile belongs to.'

  if (form.dateOfBirth) {
    const date = new Date(form.dateOfBirth)

    if (Number.isNaN(date.getTime()))
      errors.value.dateOfBirth = 'Enter a valid date.'
    else if (date > new Date())
      errors.value.dateOfBirth = 'Date of birth cannot be in the future.'
  }

  return Object.keys(errors.value).length === 0
}

const payload = () => {
  const body: Record<string, string | number> = {}

  // Only sent when creating: the profile keeps the user it was created for.
  if (!isEditing.value)
    body.userId = Number(form.userId)

  if (form.phone.trim())
    body.phone = form.phone.trim()
  if (form.address.trim())
    body.address = form.address.trim()
  if (form.city.trim())
    body.city = form.city.trim()
  if (form.country.trim())
    body.country = form.country.trim()
  if (form.gender)
    body.gender = form.gender
  if (form.dateOfBirth)
    body.dateOfBirth = form.dateOfBirth

  return body
}

const submit = async () => {
  if (!validate())
    return

  const body = payload()

  const saved = isEditing.value
    ? await update(() =>
        api.patch<Customer>(`/customers/${editingId.value}`, body).then(r => r.data),
      )
    : await create(() => api.post<Customer>('/customers', body).then(r => r.data))

  if (saved)
    formOpen.value = false
}

const confirmRemove = async () => {
  const target = removalTarget.value

  if (!target)
    return

  removing.value = true
  removeError.value = null

  const ok = await remove(
    () => api.delete(`/customers/${target.id}`),
    `Profile for ${target.user?.email ?? `#${target.userId}`} deleted.`,
  )

  removing.value = false

  if (ok)
    removalTarget.value = null
  else
    removeError.value = saveError.value
}
</script>

<template>
  <PageHeader
    title="Customers"
    description="Manage customer profiles and their contact details."
    :icon="Users"
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
        :disabled="unclaimedUsers.length === 0"
        :title="unclaimedUsers.length === 0 ? 'Every user already has a customer profile.' : undefined"
        @click="openCreate"
      >
        New customer
      </Button>
    </template>

    <div class="space-y-4">
      <div class="flex items-start gap-2 rounded-xl border border-slate-800/80 bg-indigo-500/10 px-3.5 py-2.5 text-sm text-slate-300">
        <Info class="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
        <p>
          A profile belongs to an existing user account, so the user can only be chosen when
          creating. Changing the attached user is not supported by the API, and
          <code class="rounded bg-white/60 px-1 py-0.5 text-xs">POST /customers</code>
          has no counterpart to delete a user.
        </p>
      </div>

      <input
        v-model="search"
        type="search"
        placeholder="Filter by name, email, city or phone…"
        class="w-full max-w-xs rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
      >

      <DataState
        :pending="pending"
        :error="error"
        :empty="total === 0"
        :empty-text="search ? 'No customers match your filter.' : 'No customers yet.'"
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
                    :align="column.align"
                    @sort="toggleSort(column.key)"
                  />
                  <th class="px-4 py-3" />
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/80">
                <tr
                  v-for="customer in items"
                  :key="customer.id"
                  class="hover:bg-slate-800/30"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">
                        {{ initials(customer.user?.name, customer.user?.email?.[0]?.toUpperCase() ?? 'U') }}
                      </span>
                      <div class="min-w-0">
                        <p class="font-medium text-slate-100">
                          {{ customer.user?.name ?? '—' }}
                        </p>
                        <p class="truncate text-xs text-slate-400">
                          {{ customer.user?.email }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    <span v-if="customer.city || customer.country">
                      {{ [customer.city, customer.country].filter(Boolean).join(', ') }}
                    </span>
                    <span v-else>—</span>
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ customer.phone ?? '—' }}
                  </td>
                  <td class="max-w-xs truncate px-4 py-3 text-slate-300">
                    {{ customer.address ?? '—' }}
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ formatDate(customer.createdAt) }}
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge :value="customer.user?.isActive ? 'ACTIVE' : 'INACTIVE'" />
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end">
                      <button
                        type="button"
                        :aria-label="`Edit profile for ${customer.user?.email ?? customer.userId}`"
                        class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-indigo-400"
                        @click="openEdit(customer)"
                      >
                        <Pencil class="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        :aria-label="`Delete profile for ${customer.user?.email ?? customer.userId}`"
                        class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                        @click="removalTarget = customer"
                      >
                        <Trash2 class="h-3.5 w-3.5" />
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
            unit="customers"
            @previous="page -= 1"
            @next="page += 1"
          />
        </div>
      </DataState>
    </div>

    <Modal
      :open="formOpen"
      size="md"
      :title="isEditing ? 'Edit customer' : 'New customer'"
      :description="isEditing ? editingCustomer?.user?.email : 'Attach a profile to an existing user account.'"
      :busy="saving"
      @close="formOpen = false"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          v-if="!isEditing"
          label="User"
          required
          full
          :error="errors.userId"
        >
          <SelectInput
            v-model="form.userId"
            :options="unclaimedOptions"
            placeholder="Select a user…"
            :invalid="Boolean(errors.userId)"
          />
        </FormField>

        <FormField label="Phone">
          <TextInput
            v-model="form.phone"
            type="tel"
            placeholder="+1 555 0100"
          />
        </FormField>

        <FormField label="City">
          <TextInput
            v-model="form.city"
            placeholder="Springfield"
          />
        </FormField>

        <FormField label="Country">
          <TextInput
            v-model="form.country"
            placeholder="United States"
          />
        </FormField>

        <FormField label="Gender">
          <SelectInput
            v-model="form.gender"
            :options="GENDERS"
            placeholder="Prefer not to say"
          />
        </FormField>

        <FormField
          label="Date of birth"
          :error="errors.dateOfBirth"
        >
          <TextInput
            v-model="form.dateOfBirth"
            type="date"
            :max="new Date().toISOString().slice(0, 10)"
            :invalid="Boolean(errors.dateOfBirth)"
          />
        </FormField>

        <FormField
          label="Address"
          full
        >
          <TextareaInput
            v-model="form.address"
            :rows="2"
            placeholder="12 Example Street"
          />
        </FormField>
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
          {{ isEditing ? 'Save changes' : 'Create customer' }}
        </Button>
      </template>
    </Modal>

    <ConfirmDialog
      :open="removalTarget !== null"
      title="Delete customer profile"
      :message="`The profile for ${removalTarget?.user?.email ?? 'this customer'} will be deleted. Their user account, orders and reviews are untouched. This cannot be undone.`"
      :busy="removing"
      :error="removeError"
      confirm-label="Delete profile"
      @confirm="confirmRemove"
      @close="removalTarget = null"
    />
  </PageHeader>
</template>
