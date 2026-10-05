<script setup lang="ts">
import { Minus, Plus, RefreshCw, Trash2, Warehouse } from '@lucide/vue'

import type { Inventory, Product } from '~/types/api'
import type { ClientColumn } from '~/composables/useClientTable'
import { formatNumber, formatRelative } from '~/utils/format'

useHead({ title: 'Inventory' })

const api = useApiClient()

const { data: inventory, pending, error, refresh } = await useAsyncData<Inventory[]>('inventory', () =>
  api.get<Inventory[]>('/inventory').then(r => r.data),
)
const { data: products } = await useAsyncData<Product[]>('inventory-product-options', () =>
  api.get<Product[]>('/products').then(r => r.data),
)

const isLowStock = (row: Inventory) => row.quantity <= row.lowStockThreshold

const lowStockCount = computed(() => (inventory.value ?? []).filter(isLowStock).length)
const totalUnits = computed(() =>
  (inventory.value ?? []).reduce((sum, row) => sum + row.quantity, 0),
)

const COLUMNS: ClientColumn<Inventory>[] = [
  { key: 'product', label: 'Product', sort: row => row.product?.name ?? '' },
  { key: 'quantity', label: 'On hand', align: 'right', sort: row => row.quantity },
  { key: 'reserved', label: 'Reserved', align: 'right', sort: row => row.reserved },
  { key: 'available', label: 'Available', align: 'right', sort: row => row.quantity - row.reserved },
  { key: 'threshold', label: 'Threshold', align: 'right', sort: row => row.lowStockThreshold },
  { key: 'state', label: 'State' },
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
} = useClientTable(inventory, COLUMNS, {
  pageSize: 15,
  searchKeys: row => [row.product?.name, row.product?.sku],
})

const { saving, error: saveError, clearError, create, update, remove } = useCrud(
  'Stock record',
  refresh,
)

const toast = useToast()

/** Only untracked products are offered: the API allows one row per product. */
const untrackedProducts = computed(() => {
  const tracked = new Set((inventory.value ?? []).map(row => row.productId))

  return (products.value ?? []).filter(product => !tracked.has(product.id))
})

const untrackedOptions = computed(() => [
  { value: null, label: 'Select a product…' },
  ...untrackedProducts.value.map(product => ({
    value: product.id,
    label: `${product.name}${product.sku ? ` · ${product.sku}` : ''}`,
  })),
])

// ── Create ────────────────────────────────────────────────────────────────────
const createOpen = ref(false)
const createForm = reactive({ productId: '', quantity: '0', reserved: '0', lowStockThreshold: '5' })
const createErrors = ref<Record<string, string>>({})

const openCreate = () => {
  Object.assign(createForm, { productId: '', quantity: '0', reserved: '0', lowStockThreshold: '5' })
  createErrors.value = {}
  clearError()
  createOpen.value = true
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

const submitCreate = async () => {
  createErrors.value = {}

  if (!createForm.productId)
    createErrors.value.productId = 'Pick a product.'
  if (!Number.isInteger(Number(createForm.quantity)) || Number(createForm.quantity) < 0)
    createErrors.value.quantity = 'Enter a whole number of units.'

  if (Object.keys(createErrors.value).length > 0)
    return

  const saved = await create(() =>
    api.post<Inventory>('/inventory', {
      productId: Number(createForm.productId),
      quantity: Number(createForm.quantity),
      reserved: Number(createForm.reserved || 0),
      lowStockThreshold: Number(createForm.lowStockThreshold || 0),
    }).then(r => r.data),
  )

  if (saved)
    createOpen.value = false
}

// ── Adjust ────────────────────────────────────────────────────────────────────
type AdjustMode = 'add' | 'remove'

const adjustOpen = ref(false)
const adjustTarget = ref<Inventory | null>(null)
const adjustMode = ref<AdjustMode>('add')
const adjustForm = reactive({ quantity: '1', reserved: '0', lowStockThreshold: '5' })
const adjustErrors = ref<Record<string, string>>({})

const openAdjust = (row: Inventory, mode: AdjustMode) => {
  adjustTarget.value = row
  adjustMode.value = mode
  Object.assign(adjustForm, {
    quantity: '1',
    reserved: String(row.reserved),
    lowStockThreshold: String(row.lowStockThreshold),
  })
  adjustErrors.value = {}
  clearError()
  adjustOpen.value = true
}

/** Relative value shown as "12 → 15" so the effect of the change is obvious. */
const projectedQuantity = computed(() => {
  const row = adjustTarget.value
  const amount = Number(adjustForm.quantity || 0)

  if (!row || !Number.isFinite(amount))
    return null

  return adjustMode.value === 'add' ? row.quantity + amount : row.quantity - amount
})

const submitAdjust = async () => {
  const row = adjustTarget.value

  if (!row)
    return

  adjustErrors.value = {}

  const amount = Number(adjustForm.quantity)

  // The API requires at least 1 unit on both the add and the remove route.
  if (!Number.isInteger(amount) || amount < 1)
    adjustErrors.value.quantity = 'Enter a whole number of at least 1.'
  else if (adjustMode.value === 'remove' && amount > row.quantity)
    adjustErrors.value.quantity = `Only ${formatNumber(row.quantity)} units are on hand.`

  if (Object.keys(adjustErrors.value).length > 0)
    return

  const body = { quantity: amount, reserved: Number(adjustForm.reserved || 0) }

  const saved = adjustMode.value === 'add'
    ? await update(
        () =>
          api
            .patch<Inventory>(`/inventory/product/${row.productId}/add`, {
              ...body,
              lowStockThreshold: Number(adjustForm.lowStockThreshold || 0),
            })
            .then(r => r.data),
        `${formatNumber(amount)} units added to ${row.product?.name ?? 'the product'}.`,
      )
    : await update(
        () =>
          api
            .patch<Inventory>(`/inventory/product/${row.productId}/remove`, body)
            .then(r => r.data),
        `${formatNumber(amount)} units removed from ${row.product?.name ?? 'the product'}.`,
      )

  if (saved)
    adjustOpen.value = false
}

// ── Delete ────────────────────────────────────────────────────────────────────
const removalTarget = ref<Inventory | null>(null)
const removing = ref(false)
const removeError = ref<string | null>(null)

const confirmRemove = async () => {
  const target = removalTarget.value

  if (!target)
    return

  removing.value = true
  removeError.value = null

  const ok = await remove(
    () => api.delete(`/inventory/${target.id}`),
    `Stock record for ${target.product?.name ?? `#${target.productId}`} deleted.`,
  )

  removing.value = false

  if (ok) {
    removalTarget.value = null
    toast.info('The product itself was not deleted.')
  }
  else {
    removeError.value = saveError.value
  }
}
</script>

<template>
  <PageHeader
    title="Inventory"
    description="Track and adjust stock levels across products."
    :icon="Warehouse"
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
        :disabled="untrackedProducts.length === 0"
        :title="untrackedProducts.length === 0 ? 'Every product already has a stock record.' : undefined"
        @click="openCreate"
      >
        Add stock record
      </Button>
    </template>

    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 shadow-card">
          <p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Tracked products
          </p>
          <p class="nums mt-1 text-xl font-semibold text-slate-100">
            {{ total }}
          </p>
        </div>
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 shadow-card">
          <p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Units on hand
          </p>
          <p class="nums mt-1 text-xl font-semibold text-slate-100">
            {{ formatNumber(totalUnits) }}
          </p>
        </div>
        <div
          class="rounded-xl border px-4 py-3 shadow-card"
          :class="lowStockCount ? 'border-amber-500/20 bg-amber-500/10' : 'border-slate-800/80 bg-slate-900/60'"
        >
          <p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Low or out of stock
          </p>
          <p
            class="nums mt-1 text-xl font-semibold"
            :class="lowStockCount ? 'text-amber-400' : 'text-slate-100'"
          >
            {{ lowStockCount }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <input
          v-model="search"
          type="search"
          placeholder="Filter by product name or SKU…"
          class="w-full max-w-xs rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
        >

        <p
          v-if="untrackedProducts.length"
          class="text-xs text-slate-400"
        >
          {{ untrackedProducts.length }} product(s) not yet tracked
        </p>
      </div>

      <DataState
        :pending="pending"
        :error="error"
        :empty="total === 0"
        :empty-text="search ? 'No stock records match your filter.' : 'No stock records yet.'"
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
                  v-for="row in items"
                  :key="row.id"
                  class="hover:bg-slate-800/30"
                  :class="isLowStock(row) ? 'bg-amber-500/10' : ''"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <img
                        v-if="row.product?.image"
                        :src="row.product.image"
                        :alt="row.product.name"
                        class="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-slate-800"
                      >
                      <div class="min-w-0">
                        <p class="font-medium text-slate-100">
                          {{ row.product?.name ?? `#${row.productId}` }}
                        </p>
                        <p class="text-xs text-slate-400">
                          {{ row.product?.sku ?? 'No SKU' }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="nums px-4 py-3 text-right font-medium text-slate-100">
                    {{ formatNumber(row.quantity) }}
                  </td>
                  <td class="nums px-4 py-3 text-right text-slate-300">
                    {{ formatNumber(row.reserved) }}
                  </td>
                  <td class="nums px-4 py-3 text-right font-medium text-slate-100">
                    {{ formatNumber(row.quantity - row.reserved) }}
                  </td>
                  <td class="nums px-4 py-3 text-right text-slate-300">
                    {{ formatNumber(row.lowStockThreshold) }}
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge :value="isLowStock(row) ? 'PENDING' : 'ACTIVE'" />
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ formatRelative(row.updatedAt) }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        :aria-label="`Add stock to ${row.product?.name ?? row.productId}`"
                        title="Add stock"
                        class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                        @click="openAdjust(row, 'add')"
                      >
                        <Plus class="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        :aria-label="`Remove stock from ${row.product?.name ?? row.productId}`"
                        title="Remove stock"
                        :disabled="row.quantity === 0"
                        class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
                        @click="openAdjust(row, 'remove')"
                      >
                        <Minus class="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        :aria-label="`Delete stock record for ${row.product?.name ?? row.productId}`"
                        title="Delete record"
                        class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                        @click="removalTarget = row"
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
            unit="stock records"
            @previous="page -= 1"
            @next="page += 1"
          />
        </div>
      </DataState>
    </div>

    <!-- Create -->
    <Modal
      :open="createOpen"
      size="md"
      title="Add stock record"
      description="Start tracking a product that has no inventory row yet."
      :busy="saving"
      @close="createOpen = false"
    >
      <div class="space-y-4">
        <FormField
          label="Product"
          required
          :error="createErrors.productId"
        >
          <SelectInput
            v-model="createForm.productId"
            :options="untrackedOptions"
            placeholder="Select a product…"
            :invalid="Boolean(createErrors.productId)"
          />
        </FormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label="Quantity"
            required
            :error="createErrors.quantity"
          >
            <TextInput
              v-model="createForm.quantity"
              type="number"
              min="0"
              step="1"
              align="right"
              :invalid="Boolean(createErrors.quantity)"
            />
          </FormField>

          <FormField label="Reserved">
            <TextInput
              v-model="createForm.reserved"
              type="number"
              min="0"
              step="1"
              align="right"
            />
          </FormField>

          <FormField label="Low stock threshold">
            <TextInput
              v-model="createForm.lowStockThreshold"
              type="number"
              min="0"
              step="1"
              align="right"
            />
          </FormField>
        </div>
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
          @click="createOpen = false"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          @click="submitCreate"
        >
          Create record
        </Button>
      </template>
    </Modal>

    <!-- Adjust -->
    <Modal
      :open="adjustOpen"
      size="sm"
      :title="adjustMode === 'add' ? 'Add stock' : 'Remove stock'"
      :description="adjustTarget?.product?.name"
      :busy="saving"
      @close="adjustOpen = false"
    >
      <div class="space-y-4">
        <div class="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2.5 text-sm">
          <span class="text-slate-300">Currently on hand</span>
          <span class="nums font-semibold text-slate-100">
            {{ formatNumber(adjustTarget?.quantity ?? 0) }} units
          </span>
        </div>

        <FormField
          label="Units"
          required
          :error="adjustErrors.quantity"
        >
          <TextInput
            v-model="adjustForm.quantity"
            type="number"
            min="1"
            step="1"
            align="right"
            :invalid="Boolean(adjustErrors.quantity)"
          />
        </FormField>

        <FormField label="Reserved">
          <TextInput
            v-model="adjustForm.reserved"
            type="number"
            min="0"
            step="1"
            align="right"
          />
        </FormField>

        <FormField
          v-if="adjustMode === 'add'"
          label="Low stock threshold"
          hint="Only settable when adding stock; the remove route ignores it."
        >
          <TextInput
            v-model="adjustForm.lowStockThreshold"
            type="number"
            min="0"
            step="1"
            align="right"
          />
        </FormField>

        <div
          v-if="projectedQuantity !== null && projectedQuantity >= 0"
          class="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2.5 text-sm"
        >
          <span class="text-slate-300">After this change</span>
          <span
            class="nums font-semibold"
            :class="projectedQuantity <= (adjustTarget?.lowStockThreshold ?? 0) ? 'text-amber-400' : 'text-slate-100'"
          >
            {{ formatNumber(projectedQuantity) }} units
          </span>
        </div>
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
          @click="adjustOpen = false"
        >
          Cancel
        </Button>
        <Button
          :variant="adjustMode === 'add' ? 'primary' : 'danger'"
          :loading="saving"
          @click="submitAdjust"
        >
          {{ adjustMode === 'add' ? 'Add stock' : 'Remove stock' }}
        </Button>
      </template>
    </Modal>

    <ConfirmDialog
      :open="removalTarget !== null"
      title="Delete stock record"
      :message="`Stop tracking ${removalTarget?.product?.name ?? 'this product'}? The product stays in the catalog but loses its quantity, reserved count and threshold.`"
      :busy="removing"
      :error="removeError"
      confirm-label="Delete record"
      @confirm="confirmRemove"
      @close="removalTarget = null"
    />
  </PageHeader>
</template>
