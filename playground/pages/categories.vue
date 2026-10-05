<script setup lang="ts">
import { Plus, RefreshCw, Tags } from '@lucide/vue'

import type { Category } from '~/types/api'
import type { ClientColumn } from '~/composables/useClientTable'
import { formatRelative } from '~/utils/format'

useHead({ title: 'Categories' })

const api = useApiClient()

const { data: categories, pending, error, refresh } = await useAsyncData<Category[]>(
  'categories',
  () => api.get<Category[]>('/categories').then(r => r.data),
)

const COLUMNS: ClientColumn<Category>[] = [
  { key: 'name', label: 'Name', sort: row => row.name },
  { key: 'description', label: 'Description', sort: row => row.description ?? '' },
  { key: 'status', label: 'Status' },
  { key: 'updated', label: 'Updated', sort: row => row.updatedAt },
]

const {
  search,
  items,
  total,
  pages,
  page,
  sortState,
  toggleSort,
} = useClientTable(categories, COLUMNS, {
  pageSize: 15,
  searchKeys: row => [row.name, row.description],
})

const { saving, error: saveError, clearError, create, update, remove } = useCrud('Category', refresh)

const blankForm = () => ({ name: '', description: '', image: '', isActive: true })

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const form = reactive(blankForm())
const errors = ref<Record<string, string>>({})
const removalTarget = ref<Category | null>(null)
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

const openEdit = (category: Category) => {
  editingId.value = category.id
  Object.assign(form, {
    name: category.name,
    description: category.description ?? '',
    image: category.image ?? '',
    isActive: category.isActive,
  })
  errors.value = {}
  clearError()
  formOpen.value = true
}

const validate = () => {
  errors.value = {}

  if (!form.name.trim())
    errors.value.name = 'Name is required.'

  if (form.image.trim() && !/^https?:\/\//i.test(form.image.trim()))
    errors.value.image = 'Image must be a full URL starting with http(s)://'

  return Object.keys(errors.value).length === 0
}

const payload = () => {
  const body: Record<string, string | boolean> = { name: form.name.trim() }

  if (form.description.trim())
    body.description = form.description.trim()
  if (form.image.trim())
    body.image = form.image.trim()

  body.isActive = form.isActive

  return body
}

const submit = async () => {
  if (!validate())
    return

  const body = payload()

  const saved = isEditing.value
    ? await update(() => api.patch<Category>(`/categories/${editingId.value}`, body).then(r => r.data))
    : await create(() => api.post<Category>('/categories', body).then(r => r.data))

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
    () => api.delete(`/categories/${target.id}`),
    `“${target.name}” deleted.`,
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
    title="Categories"
    description="Organize products into categories."
    :icon="Tags"
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
        New category
      </Button>
    </template>

    <div class="space-y-4">
      <input
        v-model="search"
        type="search"
        placeholder="Filter categories…"
        class="w-full max-w-xs rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
      >

      <DataState
        :pending="pending"
        :error="error"
        :empty="total === 0"
        :empty-text="search ? 'No categories match your filter.' : 'No categories yet.'"
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
                  v-for="category in items"
                  :key="category.id"
                  class="hover:bg-slate-800/30"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <img
                        v-if="category.image"
                        :src="category.image"
                        :alt="category.name"
                        class="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-slate-800"
                      >
                      <span class="font-medium text-slate-100">{{ category.name }}</span>
                    </div>
                  </td>
                  <td class="max-w-md px-4 py-3 text-slate-300">
                    {{ category.description ?? '—' }}
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge :value="category.isActive ? 'ACTIVE' : 'INACTIVE'" />
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ formatRelative(category.updatedAt) }}
                  </td>
                  <td class="px-4 py-3">
                    <RowActions
                      :edit-label="`Edit ${category.name}`"
                      :delete-label="`Delete ${category.name}`"
                      @edit="openEdit(category)"
                      @remove="removalTarget = category"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <TablePagination
            :page="page"
            :pages="pages"
            :total="total"
            unit="categories"
            @previous="page -= 1"
            @next="page += 1"
          />
        </div>
      </DataState>
    </div>

    <Modal
      :open="formOpen"
      size="md"
      :title="isEditing ? 'Edit category' : 'New category'"
      :description="isEditing ? `Updating category #${editingId}.` : 'Categories drive the storefront navigation.'"
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
            placeholder="Audio"
          />
        </FormField>

        <FormField
          label="Image URL"
          :error="errors.image"
          hint="External link — the API has no upload endpoint."
        >
          <TextInput
            v-model="form.image"
            placeholder="https://…"
            :invalid="Boolean(errors.image)"
          />
        </FormField>

        <FormField label="Description">
          <TextareaInput
            v-model="form.description"
            :rows="4"
            :maxlength="2000"
            counter
            placeholder="What belongs in this category."
          />
        </FormField>

        <ToggleSwitch
          v-model="form.isActive"
          label="Active"
          description="Inactive categories are hidden from the storefront."
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
          {{ isEditing ? 'Save changes' : 'Create category' }}
        </Button>
      </template>
    </Modal>

    <ConfirmDialog
      :open="removalTarget !== null"
      title="Delete category"
      :message="`“${removalTarget?.name}” will be deleted. Products in it keep their record but lose the link. This cannot be undone.`"
      :busy="removing"
      :error="removeError"
      confirm-label="Delete category"
      @confirm="confirmRemove"
      @close="removalTarget = null"
    />
  </PageHeader>
</template>
