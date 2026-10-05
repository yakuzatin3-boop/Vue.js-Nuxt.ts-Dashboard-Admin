<script setup lang="ts">
import { CreditCard, RefreshCw } from '@lucide/vue'

import type { Payment } from '~/types/api'
import { PAYMENT_STATUSES } from '~/types/api'
import type { ClientColumn } from '~/composables/useClientTable'
import { formatCurrency, formatDate, formatDateTime, humanize } from '~/utils/format'

useHead({ title: 'Payments' })

const api = useApiClient()

const { data: payments, pending, error, refresh } = await useAllPages<Payment>(
  'admin-payments',
  '/admin/payments',
)

const STATUS_OPTIONS = PAYMENT_STATUSES.map(status => ({ value: status, label: humanize(status) }))

const statusFilter = ref('')

const statusCounts = computed(() => {
  const counts = new Map<string, number>()

  for (const payment of payments.value ?? [])
    counts.set(payment.status, (counts.get(payment.status) ?? 0) + 1)

  return counts
})

const scopedPayments = computed(() => {
  const all = payments.value ?? []

  return statusFilter.value ? all.filter(payment => payment.status === statusFilter.value) : all
})

const COLUMNS: ClientColumn<Payment>[] = [
  { key: 'id', label: '#', sort: row => row.id },
  { key: 'order', label: 'Order', sort: row => row.orderId },
  { key: 'customer', label: 'Customer', sort: row => row.order?.user?.name ?? row.order?.user?.email ?? '' },
  { key: 'method', label: 'Method', sort: row => row.method },
  { key: 'amount', label: 'Amount', align: 'right', sort: row => Number(row.amount) },
  { key: 'status', label: 'Status' },
  { key: 'transaction', label: 'Transaction ID', sort: row => row.transactionId ?? '' },
  { key: 'paidAt', label: 'Paid at', sort: row => row.paidAt ?? '' },
]

const {
  search,
  items,
  total,
  pages,
  page,
  sortState,
  toggleSort,
} = useClientTable(scopedPayments, COLUMNS, {
  pageSize: 15,
  searchKeys: row => [
    row.id,
    row.orderId,
    row.status,
    row.method,
    row.transactionId,
    row.order?.user?.name,
    row.order?.user?.email,
  ],
})

const settled = computed(() =>
  (payments.value ?? [])
    .filter(payment => payment.status === 'PAID')
    .reduce((sum, payment) => sum + Number(payment.amount), 0),
)

const { saving, error: saveError, clearError, update } = useCrud('Payment', refresh)

const statusOpen = ref(false)
const statusTarget = ref<Payment | null>(null)
const statusForm = reactive({ status: '', transactionId: '' })

const openStatus = (payment: Payment) => {
  statusTarget.value = payment
  statusForm.status = payment.status
  statusForm.transactionId = payment.transactionId ?? ''
  clearError()
  statusOpen.value = true
}

const submitStatus = async () => {
  const payment = statusTarget.value

  if (!payment)
    return

  const body: Record<string, string> = { status: statusForm.status }

  if (statusForm.transactionId.trim())
    body.transactionId = statusForm.transactionId.trim()

  const saved = await update(
    () => api.patch<Payment>(`/payments/${payment.id}/status`, body).then(r => r.data),
    `Payment #${payment.id} marked ${humanize(statusForm.status).toLowerCase()}.`,
  )

  if (saved)
    statusOpen.value = false
}
</script>

<template>
  <PageHeader
    title="Payments"
    description="Monitor transactions and payment status."
    :icon="CreditCard"
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

    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 shadow-card">
          <p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Total payments
          </p>
          <p class="nums mt-1 text-xl font-semibold text-slate-100">
            {{ total }}
          </p>
        </div>
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 shadow-card">
          <p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Settled revenue
          </p>
          <p class="nums mt-1 text-xl font-semibold text-slate-100">
            {{ formatCurrency(settled) }}
          </p>
        </div>
        <div
          class="rounded-xl border px-4 py-3 shadow-card"
          :class="(statusCounts.get('FAILED') ?? 0) > 0 ? 'border-rose-500/20 bg-rose-500/10' : 'border-slate-800/80 bg-slate-900/60'"
        >
          <p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Failed
          </p>
          <p
            class="nums mt-1 text-xl font-semibold"
            :class="(statusCounts.get('FAILED') ?? 0) > 0 ? 'text-rose-400' : 'text-slate-100'"
          >
            {{ statusCounts.get('FAILED') ?? 0 }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="statusFilter === '' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400' : 'border-slate-800/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800/30'"
            @click="statusFilter = ''"
          >
            All
            <span class="nums ml-1 text-xs opacity-70">{{ payments?.length ?? 0 }}</span>
          </button>
          <button
            v-for="status in STATUS_OPTIONS"
            :key="status.value"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="statusFilter === status.value ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400' : 'border-slate-800/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800/30'"
            @click="statusFilter = status.value"
          >
            {{ status.label }}
            <span class="nums ml-1 text-xs opacity-70">{{ statusCounts.get(status.value) ?? 0 }}</span>
          </button>
        </div>

        <input
          v-model="search"
          type="search"
          placeholder="Filter by order, transaction ID or customer…"
          class="w-full max-w-xs rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
        >
      </div>

      <DataState
        :pending="pending"
        :error="error"
        :empty="total === 0"
        :empty-text="search || statusFilter ? 'No payments match your filters.' : 'No payments yet.'"
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
                  v-for="payment in items"
                  :key="payment.id"
                  class="hover:bg-slate-800/30"
                >
                  <td class="nums px-4 py-3 font-medium text-slate-100">
                    {{ payment.id }}
                  </td>
                  <td class="nums px-4 py-3 text-slate-100">
                    #{{ payment.orderId }}
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ payment.order?.user?.name ?? payment.order?.user?.email ?? '—' }}
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ humanize(payment.method) }}
                  </td>
                  <td class="nums px-4 py-3 text-right font-medium text-slate-100">
                    {{ formatCurrency(payment.amount) }}
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge :value="payment.status" />
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ payment.transactionId ?? '—' }}
                  </td>
                  <td
                    class="px-4 py-3 text-slate-300"
                    :title="formatDateTime(payment.paidAt)"
                  >
                    {{ formatDate(payment.paidAt) }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      type="button"
                      class="rounded-md px-2 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-500/10"
                      @click="openStatus(payment)"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <TablePagination
            :page="page"
            :pages="pages"
            :total="total"
            unit="payments"
            @previous="page -= 1"
            @next="page += 1"
          />
        </div>
      </DataState>
    </div>

    <Modal
      :open="statusOpen"
      size="sm"
      :title="`Update payment #${statusTarget?.id}`"
      description="Marking a payment as paid also moves its order to Paid."
      :busy="saving"
      @close="statusOpen = false"
    >
      <div class="space-y-4">
        <div class="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2.5 text-sm">
          <span class="text-slate-300">Order #{{ statusTarget?.orderId }} · {{ humanize(statusTarget?.method) }}</span>
          <span class="nums font-semibold text-slate-100">{{ formatCurrency(statusTarget?.amount) }}</span>
        </div>

        <FormField label="Status">
          <SelectInput
            v-model="statusForm.status"
            :options="STATUS_OPTIONS"
            placeholder="Select a status"
          />
        </FormField>

        <FormField
          label="Transaction ID"
          hint="Optional. Leave blank to keep the current reference."
        >
          <TextInput
            v-model="statusForm.transactionId"
            placeholder="txn_1234567890"
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
          @click="statusOpen = false"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          @click="submitStatus"
        >
          Update payment
        </Button>
      </template>
    </Modal>
  </PageHeader>
</template>
