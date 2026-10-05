<script setup lang="ts">
import { Layers, Plus, RefreshCw } from '@lucide/vue'

import type { Brand } from '~/types/api'
import type { ClientColumn } from '~/composables/useClientTable'
import { formatDate, formatRelative } from '~/utils/format'

useHead({ title: 'Brands' })

const api = useApiClient()

const { data: brands, pending, error, refresh } = await useAsyncData<Brand[]>('brands', () =>
  api.get<Brand[]>('/brands').then(r => r.data),
)

const COLUMNS: ClientColumn<Brand>[] = [
  { key: 'name', label: 'Brand', sort: row => row.name },
  { key: 'description', label: 'Description', sort: row => row.description ?? '' },
  { key: 'status', label: 'Status' },
  { key: 'updated', label: 'Updated', sort: row => row.updatedAt },
  { key: 'actions', label: '', align: 'right' },
]

const { search, items, total, pages, page, pageSize, sortKey, sortDirection } = useClientTable(
  brands,
  COLUMNS,
  { pageSize: 12, searchKeys: row => [row.name, row.description] },
)

const sortOptions = computed(() =>
  COLUMNS.filter(column => column.sort).map(column => ({ value: column.key, label: column.label })),
)

const { saving, error: saveError, clearError, create, update, remove } = useCrud('Brand', refresh)

const blankForm = () => ({ name: '', description: '', logo: '', isActive: true })

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const form = reactive(blankForm())
const errors = ref<Record<string, string>>({})
const removalTarget = ref<Brand | null>(null)
const removing = ref(false)
const removeError = ref<string | null>(null)

const isEditing = computed(() => editingId.value !== null)

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

const openEdit = (brand: Brand) => {
  editingId.value = brand.id
  Object.assign(form, {
    name: brand.name,
    description: brand.description ?? '',
    logo: brand.logo ?? '',
    isActive: brand.isActive,
  })
  errors.value = {}
  clearError()
  formOpen.value = true
}

const validate = () => {
  errors.value = {}

  if (!form.name.trim())
    errors.value.name = 'Name is required.'

  if (form.logo.trim() && !/^https?:\/\//i.test(form.logo.trim()))
    errors.value.logo = 'Logo must be a full URL starting with http(s)://'

  return Object.keys(errors.value).length === 0
}

const payload = () => {
  const body: Record<string, string | boolean> = { name: form.name.trim() }

  if (form.description.trim())
    body.description = form.description.trim()
  if (form.logo.trim())
    body.logo = form.logo.trim()

  body.isActive = form.isActive

  return body
}

const submit = async () => {
  if (!validate())
    return

  const body = payload()

  const saved = isEditing.value
    ? await update(() => api.patch<Brand>(`/brands/${editingId.value}`, body).then(r => r.data))
    : await create(() => api.post<Brand>('/brands', body).then(r => r.data))

  if (saved)
    formOpen.value = false
}

const confirmRemove = async () => {
  const target = removalTarget.value

  if (!target)
    return

  removing.value = true
  removeError.value = null

  const ok = await remove(() => api.delete(`/brands/${target.id}`), `“${target.name}” deleted.`)

  removing.value = false

  if (ok)
    removalTarget.value = null
  else
    removeError.value = saveError.value
}
</script>

<template>
  <PageHeader
    title="Brands"
    description="Manage the brands your products are grouped under."
    :icon="Layers"
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
        New brand
      </Button>
    </template>

    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <input
          v-model="search"
          type="search"
          placeholder="Filter brands…"
          class="w-full max-w-xs rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
        >

        <SortSelect
          v-model:model-value="sortKey"
          v-model:direction="sortDirection"
          :options="sortOptions"
        />
      </div>

      <DataState
        :pending="pending"
        :error="error"
        :empty="total === 0"
        :empty-text="search ? 'No brands match your filter.' : 'No brands yet.'"
        @refresh="refresh"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="brand in items"
            :key="brand.id"
            class="flex flex-col rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-card"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <img
                  v-if="brand.logo"
                  :src="brand.logo"
                  :alt="brand.name"
                  class="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-800"
                >
                <div class="min-w-0">
                  <p class="truncate font-semibold text-slate-100">
                    {{ brand.name }}
                  </p>
                  <p class="text-xs text-slate-400">
                    Created {{ formatDate(brand.createdAt) }}
                  </p>
                </div>
              </div>
              <StatusBadge :value="brand.isActive ? 'ACTIVE' : 'INACTIVE'" />
            </div>

            <p class="mt-3 line-clamp-3 flex-1 text-sm text-slate-300">
              {{ brand.description ?? 'No description' }}
            </p>

            <div class="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
              <span
                class="text-xs text-slate-400"
                :title="formatDate(brand.updatedAt)"
              >Updated {{ formatRelative(brand.updatedAt) }}</span>
              <RowActions
                :edit-label="`Edit ${brand.name}`"
                :delete-label="`Delete ${brand.name}`"
                @edit="openEdit(brand)"
                @remove="removalTarget = brand"
              />
            </div>
          </article>
        </div>

        <div
          v-if="total > pageSize"
          class="mt-4 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-card"
        >
          <TablePagination
            :page="page"
            :pages="pages"
            :total="total"
            unit="brands"
            @previous="page -= 1"
            @next="page += 1"
          />
        </div>
      </DataState>
    </div>

    <Modal
      :open="formOpen"
      :title="isEditing ? 'Edit brand' : 'New brand'"
      :description="isEditing ? `Updating brand #${editingId}.` : 'Brands group related products.'"
      :busy="saving"
      @close="formOpen = false"
    >
      <div class="space-y-4">
        <FormField
          label="Name"
          required
          :error="errors.name"
        >
          <TextInput
            v-model="form.name"
            :invalid="Boolean(errors.name)"
            placeholder="Aurora Audio"
          />
        </FormField>

        <FormField
          label="Logo URL"
          :error="errors.logo"
          hint="External link — the API has no upload endpoint."
        >
          <TextInput
            v-model="form.logo"
            placeholder="https://…"
            :invalid="Boolean(errors.logo)"
          />
        </FormField>

        <FormField label="Description">
          <TextareaInput
            v-model="form.description"
            :rows="4"
            :maxlength="2000"
            counter
            placeholder="What this brand is known for."
          />
        </FormField>

        <ToggleSwitch
          v-model="form.isActive"
          label="Active"
          description="Inactive brands are hidden from the storefront."
        />
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
          {{ isEditing ? 'Save changes' : 'Create brand' }}
        </Button>
      </template>
    </Modal>

    <ConfirmDialog
      :open="removalTarget !== null"
      title="Delete brand"
      :message="`“${removalTarget?.name}” will be deleted. Products referencing it keep their record but lose the link. This cannot be undone.`"
      :busy="removing"
      :error="removeError"
      confirm-label="Delete brand"
      @confirm="confirmRemove"
      @close="removalTarget = null"
    />
  </PageHeader>
</template>
