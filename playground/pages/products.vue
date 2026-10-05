<script setup lang="ts">
import { Image, Package, Plus, RefreshCw } from '@lucide/vue'

import type {
  Brand,
  Category,
  Product,
  Inventory,
} from '~/types/api'
import type { ClientColumn } from '~/composables/useClientTable'
import { formatCurrency, formatNumber } from '~/utils/format'
import { toApiError } from '~/utils/api-error'

useHead({ title: 'Products' })

const api = useApiClient()

const { data: products, pending, error, refresh } = await useAsyncData<Product[]>(
  'products',
  () => api.get<Product[]>('/products').then(r => r.data),
)

const { data: brands } = await useAsyncData<Brand[]>('product-brand-options', () =>
  api.get<Brand[]>('/brands').then(r => r.data),
)

const { data: categories } = await useAsyncData<Category[]>('product-category-options', () =>
  api.get<Category[]>('/categories').then(r => r.data),
)

const brandOptions = computed(() => [
  { value: null, label: 'No brand' },
  ...(brands.value ?? []).map(brand => ({ value: brand.id, label: brand.name })),
])

const categoryOptions = computed(() => [
  { value: null, label: 'No category' },
  ...(categories.value ?? []).map(category => ({ value: category.id, label: category.name })),
])

const COLUMNS: ClientColumn<Product>[] = [
  { key: 'name', label: 'Product', sort: row => row.name },
  { key: 'sku', label: 'SKU', sort: row => row.sku ?? '' },
  { key: 'brand', label: 'Brand', sort: row => row.brand?.name ?? '' },
  { key: 'category', label: 'Category', sort: row => row.category?.name ?? '' },
  { key: 'price', label: 'Price', align: 'right', sort: row => Number(row.price) },
  { key: 'rating', label: 'Rating', align: 'right', sort: row => Number(row.ratingAverage) },
  { key: 'status', label: 'Status' },
]

const { search, items, total, pages, page, sortState, toggleSort } = useClientTable(
  products,
  COLUMNS,
  {
    pageSize: 10,
    // Lets the header's global search land here pre-filtered.
    initialSearch: String(useRoute().query.q ?? ''),
    searchKeys: row => [
      row.name,
      row.sku ?? '',
      row.brand?.name ?? '',
      row.category?.name ?? '',
      row.description ?? '',
    ],
  },
)

const {
  saving,
  error: saveError,
  clearError,
  create,
  update,
  remove,
} = useCrud('Product', refresh)

interface ProductForm {
  name: string
  description: string
  price: string
  sku: string
  image: string
  images: string
  brandId: string
  categoryId: string
  isActive: boolean
  isFeatured: boolean
  isBestseller: boolean
  isFlashSale: boolean
  initialStock: string
  lowStockThreshold: string
  features: string
  specifications: string
}

const blankForm = (): ProductForm => ({
  name: '',
  description: '',
  price: '',
  sku: '',
  image: '',
  images: '',
  brandId: '',
  categoryId: '',
  isActive: true,
  isFeatured: false,
  isBestseller: false,
  isFlashSale: false,
  initialStock: '0',
  lowStockThreshold: '5',
  features: '',
  specifications: '{\n  \n}',
})

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const form = reactive<ProductForm>(blankForm())
const errors = ref<Record<string, string>>({})
const removalTarget = ref<Product | null>(null)
const removing = ref(false)
const removeError = ref<string | null>(null)

const isEditing = computed(() => editingId.value !== null)

const resetForm = () => {
  Object.assign(form, blankForm())
  errors.value = {}
  clearError()
}

const openCreate = () => {
  editingId.value = null
  resetForm()
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

const openEdit = (product: Product) => {
  editingId.value = product.id
  Object.assign(form, {
    name: product.name,
    description: product.description ?? '',
    price: product.price,
    sku: product.sku ?? '',
    image: product.image ?? '',
    images: Array.isArray(product.images) ? product.images.join(', ') : '',
    brandId: product.brandId === null ? '' : String(product.brandId),
    categoryId: product.categoryId === null ? '' : String(product.categoryId),
    isActive: product.isActive,
    isFeatured: product.isFeatured ?? false,
    isBestseller: product.isBestseller ?? false,
    isFlashSale: product.isFlashSale ?? false,
    initialStock: '',
    lowStockThreshold: '5',
    features: Array.isArray(product.features) ? product.features.join('\n') : '',
    specifications: JSON.stringify(product.specifications ?? {}, null, 2),
  })
  errors.value = {}
  clearError()
  formOpen.value = true
}

const validate = () => {
  errors.value = {}

  if (!form.name.trim())
    errors.value.name = 'Name is required.'

  const price = Number(form.price)

  if (!form.price.trim())
    errors.value.price = 'Price is required.'
  else if (!Number.isFinite(price) || price < 0)
    errors.value.price = 'Enter a positive amount.'
  else if (!/^\d+(?:\.\d{1,2})?$/.test(form.price.trim()))
    errors.value.price = 'Use at most 2 decimal places.'

  if (form.image.trim() && !/^https?:\/\//i.test(form.image.trim()))
    errors.value.image = 'Image must be a full URL starting with http(s)://'

  if (form.images.trim()) {
    const urls = form.images.split(',').map(u => u.trim()).filter(Boolean)
    if (urls.some(url => !/^https?:\/\//i.test(url)))
      errors.value.images = 'All image URLs must start with http(s)://'
  }

  if (form.specifications.trim()) {
    try {
      JSON.parse(form.specifications)
    }
    catch {
      errors.value.specifications = 'Invalid JSON format'
    }
  }

  if (!isEditing.value && form.initialStock.trim() !== '') {
    const stock = Number(form.initialStock)

    if (!Number.isInteger(stock) || stock < 0)
      errors.value.initialStock = 'Enter a whole number of units.'
  }

  return Object.keys(errors.value).length === 0
}

const payload = () => {
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    price: Number(form.price),
  }

  if (form.description.trim())
    body.description = form.description.trim()
  if (form.sku.trim())
    body.sku = form.sku.trim()
  if (form.image.trim())
    body.image = form.image.trim()

  if (form.images.trim()) {
    body.images = form.images.split(',').map(u => u.trim()).filter(Boolean)
  }

  if (form.brandId !== '')
    body.brandId = Number(form.brandId)
  if (form.categoryId !== '')
    body.categoryId = Number(form.categoryId)

  body.isActive = form.isActive
  body.isFeatured = form.isFeatured
  body.isBestseller = form.isBestseller
  body.isFlashSale = form.isFlashSale

  if (form.features.trim()) {
    body.features = form.features.split('\n').map(f => f.trim()).filter(Boolean)
  }

  // validate() already parsed this string and bailed out on malformed JSON,
  // so by the time we get here it is guaranteed to be valid.
  if (form.specifications.trim())
    body.specifications = JSON.parse(form.specifications)

  return body
}

const submit = async () => {
  if (!validate())
    return

  const body = payload()

  const saved = isEditing.value
    ? await update(() => api.patch<Product>(`/products/${editingId.value}`, body).then(r => r.data))
    : await create(async () => {
        const { data } = await api.post<Product>('/products', body)

        const quantity = Number(form.initialStock || 0)

        if (quantity > 0) {
          try {
            await api.post<Inventory>('/inventory', {
              productId: data.id,
              quantity,
              lowStockThreshold: Number(form.lowStockThreshold || 5),
            })
          }
          catch (stockError) {
            const message = toApiError(stockError).message
            useToast().error(`Product created, but its stock row failed: ${message}`)
          }
        }

        return data
      })

  if (saved)
    formOpen.value = false
}

const askRemove = (product: Product) => {
  removalTarget.value = product
  removeError.value = null
}

const confirmRemove = async () => {
  const target = removalTarget.value

  if (!target)
    return

  removing.value = true
  removeError.value = null

  const ok = await remove(
    () => api.delete(`/products/${target.id}`),
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
  <div class="space-y-6">
    <PageHeader
      title="Products"
      description="Manage your product catalog."
      :icon="Package"
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
          New product
        </Button>
      </template>
    </PageHeader>

    <div class="space-y-4">
      <input
        v-model="search"
        type="search"
        placeholder="Filter by name, SKU, brand or category…"
        class="w-full max-w-xs rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
      >

      <DataState
        :pending="pending"
        :error="error"
        :empty="total === 0"
        :empty-text="search ? 'No products match your filter.' : 'No products yet.'"
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
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 border border-slate-800/80">
                        <img
                          v-if="row.image"
                          :src="row.image"
                          :alt="row.name"
                          class="h-10 w-10 object-cover rounded-lg"
                        >
                        <Image
                          v-else
                          class="h-5 w-5 text-slate-400"
                        />
                      </div>
                      <div>
                        <p class="font-medium text-slate-100">
                          {{ row.name }}
                        </p>
                        <div
                          v-if="row.isFeatured || row.isBestseller"
                          class="mt-0.5 flex gap-1.5"
                        >
                          <span
                            v-if="row.isFeatured"
                            class="inline-flex items-center rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400"
                          >Featured</span>
                          <span
                            v-if="row.isBestseller"
                            class="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400"
                          >Bestseller</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ row.sku ?? '—' }}
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ row.brand?.name ?? '—' }}
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ row.category?.name ?? '—' }}
                  </td>
                  <td class="nums px-4 py-3 text-right font-medium text-slate-100">
                    {{ formatCurrency(row.price) }}
                  </td>
                  <td class="nums px-4 py-3 text-right text-slate-300">
                    {{ Number(row.ratingAverage).toFixed(1) }}
                    <span class="text-xs text-slate-400">({{ formatNumber(row.ratingCount) }})</span>
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge :value="row.isActive ? 'ACTIVE' : 'INACTIVE'" />
                  </td>
                  <td class="px-4 py-3">
                    <RowActions
                      :edit-label="`Edit ${row.name}`"
                      :delete-label="`Delete ${row.name}`"
                      @edit="openEdit(row)"
                      @remove="askRemove(row)"
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
            @update:page="page = $event"
          />
        </div>
      </DataState>

      <Modal
        v-model:open="formOpen"
        :title="isEditing ? `Edit ${form.name || 'product'}` : 'New product'"
        size="xl"
        @close="resetForm"
      >
        <form
          class="space-y-6"
          @submit.prevent="submit"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label
                for="name"
                class="block text-sm font-medium text-slate-100"
              >Name</label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                required
                placeholder="e.g. Wireless Headphones"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                :class="errors.name ? 'border-rose-500/20 focus:border-rose-500/20 focus:ring-rose-500/20' : ''"
              >
              <p
                v-if="errors.name"
                class="mt-1 text-xs text-rose-400"
              >
                {{ errors.name }}
              </p>
            </div>

            <div class="sm:col-span-2">
              <label
                for="description"
                class="block text-sm font-medium text-slate-100"
              >Description</label>
              <textarea
                id="description"
                v-model="form.description"
                rows="3"
                placeholder="Product description..."
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label
                for="sku"
                class="block text-sm font-medium text-slate-100"
              >SKU</label>
              <input
                id="sku"
                v-model="form.sku"
                type="text"
                placeholder="PROD-0001"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              >
            </div>

            <div>
              <label
                for="price"
                class="block text-sm font-medium text-slate-100"
              >Price</label>
              <input
                id="price"
                v-model="form.price"
                type="text"
                required
                placeholder="0.00"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                :class="errors.price ? 'border-rose-500/20 focus:border-rose-500/20 focus:ring-rose-500/20' : ''"
              >
              <p
                v-if="errors.price"
                class="mt-1 text-xs text-rose-400"
              >
                {{ errors.price }}
              </p>
            </div>

            <div class="sm:col-span-2">
              <label
                for="image"
                class="block text-sm font-medium text-slate-100"
              >Main Image URL</label>
              <input
                id="image"
                v-model="form.image"
                type="url"
                placeholder="https://example.com/image.jpg"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                :class="errors.image ? 'border-rose-500/20 focus:border-rose-500/20 focus:ring-rose-500/20' : ''"
              >
              <p
                v-if="errors.image"
                class="mt-1 text-xs text-rose-400"
              >
                {{ errors.image }}
              </p>
            </div>

            <div class="sm:col-span-2">
              <label
                for="images"
                class="block text-sm font-medium text-slate-100"
              >Image Gallery (comma-separated URLs)</label>
              <input
                id="images"
                v-model="form.images"
                type="text"
                placeholder="https://example.com/1.jpg, https://example.com/2.jpg"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                :class="errors.images ? 'border-rose-500/20 focus:border-rose-500/20 focus:ring-rose-500/20' : ''"
              >
              <p
                v-if="errors.images"
                class="mt-1 text-xs text-rose-400"
              >
                {{ errors.images }}
              </p>
            </div>

            <div>
              <label
                for="brandId"
                class="block text-sm font-medium text-slate-100"
              >Brand</label>
              <select
                id="brandId"
                v-model="form.brandId"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              >
                <option
                  v-for="option in brandOptions"
                  :key="option.value === null ? 'null' : option.value"
                  :value="option.value === null ? '' : option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div>
              <label
                for="categoryId"
                class="block text-sm font-medium text-slate-100"
              >Category</label>
              <select
                id="categoryId"
                v-model="form.categoryId"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              >
                <option
                  v-for="option in categoryOptions"
                  :key="option.value === null ? 'null' : option.value"
                  :value="option.value === null ? '' : option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div v-if="!isEditing">
              <label
                for="initialStock"
                class="block text-sm font-medium text-slate-100"
              >Initial Stock</label>
              <input
                id="initialStock"
                v-model="form.initialStock"
                type="number"
                min="0"
                placeholder="0"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                :class="errors.initialStock ? 'border-rose-500/20 focus:border-rose-500/20 focus:ring-rose-500/20' : ''"
              >
              <p
                v-if="errors.initialStock"
                class="mt-1 text-xs text-rose-400"
              >
                {{ errors.initialStock }}
              </p>
            </div>

            <div v-if="!isEditing">
              <label
                for="lowStockThreshold"
                class="block text-sm font-medium text-slate-100"
              >Low Stock Threshold</label>
              <input
                id="lowStockThreshold"
                v-model="form.lowStockThreshold"
                type="number"
                min="0"
                placeholder="5"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              >
            </div>

            <div class="sm:col-span-2">
              <label
                for="features"
                class="block text-sm font-medium text-slate-100"
              >Features (one per line)</label>
              <textarea
                id="features"
                v-model="form.features"
                rows="4"
                placeholder="Waterproof&#10;Noise Cancelling&#10;Long Battery Life"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                for="specifications"
                class="block text-sm font-medium text-slate-100"
              >Specifications (JSON)</label>
              <textarea
                id="specifications"
                v-model="form.specifications"
                rows="5"
                placeholder="{&quot;Brand&quot;: &quot;Sony&quot;, &quot;Color&quot;: &quot;Black&quot;}"
                class="mt-1.5 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm font-mono text-slate-100 transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                :class="errors.specifications ? 'border-rose-500/20 focus:border-rose-500/20 focus:ring-rose-500/20' : ''"
              />
              <p
                v-if="errors.specifications"
                class="mt-1 text-xs text-rose-400"
              >
                {{ errors.specifications }}
              </p>
            </div>

            <div class="sm:col-span-2">
              <div class="flex flex-wrap gap-6">
                <label class="flex items-center gap-2 text-sm text-slate-100">
                  <input
                    v-model="form.isActive"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-800/80 text-indigo-400 focus:ring-indigo-500/30"
                  >
                  Active
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-100">
                  <input
                    v-model="form.isFeatured"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-800/80 text-indigo-400 focus:ring-indigo-500/30"
                  >
                  Featured
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-100">
                  <input
                    v-model="form.isBestseller"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-800/80 text-indigo-400 focus:ring-indigo-500/30"
                  >
                  Bestseller
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-100">
                  <input
                    v-model="form.isFlashSale"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-800/80 text-indigo-400 focus:ring-indigo-500/30"
                  >
                  Flash Sale
                </label>
              </div>
            </div>
          </div>

          <p
            v-if="saveError"
            class="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
          >
            {{ saveError }}
          </p>

          <div class="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              @click="formOpen = false"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              :loading="saving"
            >
              {{ isEditing ? 'Save changes' : 'Create product' }}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        :open="!!removalTarget"
        title="Delete product"
        size="sm"
        @close="removalTarget = null"
      >
        <p class="text-sm text-slate-300">
          Are you sure you want to delete
          <strong class="text-slate-100">“{{ removalTarget?.name }}”</strong>? This action cannot be undone.
        </p>

        <p
          v-if="removeError"
          class="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
        >
          {{ removeError }}
        </p>

        <div class="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            :disabled="removing"
            @click="removalTarget = null"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            :loading="removing"
            @click="confirmRemove"
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  </div>
</template>
