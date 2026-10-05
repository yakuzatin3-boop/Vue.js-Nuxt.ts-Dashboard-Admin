<script setup lang="ts">
import { RefreshCw, ShoppingBag } from '@lucide/vue'

import type { Order } from '~/types/api'
import type { ClientColumn } from '~/composables/useClientTable'
import { formatCurrency, formatDate, initials } from '~/utils/format'

useHead({ title: 'Orders' })

const api = useApiClient()

const { data: orders, pending, error, refresh } = await useAsyncData<Order[]>(
  'orders',
  () => api.get<Order[]>('/admin/orders').then(r => r.data),
)

const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const

const COLUMNS: ClientColumn<Order>[] = [
  { key: 'id', label: '#', sort: row => row.id },
  { key: 'customer', label: 'Customer', sort: row => row.user?.name ?? row.user?.email ?? '' },
  { key: 'status', label: 'Status', sort: row => row.status },
  { key: 'items', label: 'Items', align: 'right', sort: row => row.items.length },
  { key: 'total', label: 'Total', align: 'right', sort: row => Number(row.total) },
  { key: 'created', label: 'Placed', sort: row => row.createdAt },
]

const { search, items, total, pages, page, sortState, toggleSort } = useClientTable(
  orders,
  COLUMNS,
  {
    pageSize: 15,
    searchKeys: row => [
      String(row.id),
      row.user?.name,
      row.user?.email,
      row.status,
      row.shippingAddress,
    ],
  },
)

const updatingStatus = ref(false)
const updateError = ref<string | null>(null)

const updateOrderStatus = async (orderId: number, status: string) => {
  updatingStatus.value = true
  updateError.value = null
  try {
    await api.patch(`/orders/${orderId}/status`, { status })
    await refresh()
    useToast().success('Order status updated')
  }
  catch (error) {
    updateError.value = error instanceof Error ? error.message : 'Failed to update status'
  }
  finally {
    updatingStatus.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Orders"
      description="Track and manage customer orders."
      :icon="ShoppingBag"
    >
      <template #actions>
        <Button
          :icon="RefreshCw"
          :loading="pending"
          @click="refresh()"
        >
          Refresh
        </Button>
      </template>
    </PageHeader>
    <div class="space-y-4">
      <input
        v-model="search"
        type="search"
        placeholder="Filter by order #, customer, status or address…"
        class="w-full max-w-xs rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
      >

      <p
        v-if="updateError"
        class="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
      >
        {{ updateError }}
      </p>

      <DataState
        :pending="pending"
        :error="error"
        :empty="total === 0"
        :empty-text="search ? 'No orders match your filter.' : 'No orders yet.'"
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
                  <td class="px-4 py-3 font-mono text-sm text-slate-300">
                    #{{ row.id }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">
                        {{ initials(row.user?.name, row.user?.email?.[0]?.toUpperCase() ?? 'C') }}
                      </span>
                      <div>
                        <p class="font-medium text-slate-100">
                          {{ row.user?.name ?? '—' }}
                        </p>
                        <p class="text-xs text-slate-400">
                          {{ row.user?.email }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <select
                      v-model="row.status"
                      :disabled="updatingStatus"
                      class="rounded-lg border border-slate-800/80 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:opacity-50"
                      @change="updateOrderStatus(row.id, row.status)"
                    >
                      <option
                        v-for="status in ORDER_STATUSES"
                        :key="status"
                        :value="status"
                      >
                        {{ status }}
                      </option>
                    </select>
                  </td>
                  <td class="nums px-4 py-3 text-right text-slate-300">
                    {{ row.items.length }}
                  </td>
                  <td class="nums px-4 py-3 text-right font-medium text-slate-100">
                    {{ formatCurrency(row.total) }}
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ formatDate(row.createdAt) }}
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
    </div>
  </div>
</template>
