<script setup lang="ts">
import type { Analytics, AnalyticsRange } from '~/types/api'
import type { ChartPoint, ChartSlice } from '~/types/chart'
import { chartColor } from '~/types/chart'
import {
  Banknote,
  Boxes,
  CircleCheck,
  CreditCard,
  Package,
  RefreshCw,
  ShoppingBag,
  Tags,
  TrendingUp,
  TriangleAlert,
  Users,
} from '@lucide/vue'
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatMonth,
  formatNumber,
  humanize,
} from '~/utils/format'
import { expandMonths, lastMonths } from '~/utils/months'

useHead({ title: 'Analytics' })

const api = useApiClient()

// The range is part of the cache key, otherwise switching it would keep
// showing the previously loaded window.
const months = ref<AnalyticsRange>(6)

const { data, pending, error, refresh } = await useAsyncData<Analytics>(
  'admin-analytics',
  () => api.get('/admin/analytics', { params: { months: months.value } }).then(r => r.data),
  { watch: [months] },
)

const RANGE_OPTIONS = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
]

// The API already returns a gap-free series, but the axis is rebuilt from the
// keys here too: charts read the series positionally, so a single dropped month
// would shift every later point one slot to the left. Union of the three series
// because a month can hold signups but no orders.
const monthAxis = computed<string[]>(() => {
  const monthsSeen = [
    ...(data.value?.revenueByMonth ?? []).map(row => row.month),
    ...(data.value?.customersByMonth ?? []).map(row => row.month),
    ...(data.value?.unitsByMonth ?? []).map(row => row.month),
  ]

  // No data yet: fall back to the selected window so the axis is not empty and
  // the empty-state message is the only thing on screen.
  return monthsSeen.length ? expandMonths(monthsSeen) : lastMonths(months.value)
})

const revenueByMonth = computed(() =>
  Object.fromEntries((data.value?.revenueByMonth ?? []).map(row => [row.month, row])),
)

const customersByMonth = computed(() =>
  Object.fromEntries((data.value?.customersByMonth ?? []).map(row => [row.month, row.count])),
)

const unitsByMonth = computed(() =>
  Object.fromEntries((data.value?.unitsByMonth ?? []).map(row => [row.month, row.units])),
)

const revenueSeries = computed<ChartPoint[]>(() =>
  monthAxis.value.map(month => ({
    label: formatMonth(month),
    value: Number(revenueByMonth.value[month]?.total ?? 0),
  })),
)

const customerSeries = computed<ChartPoint[]>(() =>
  monthAxis.value.map(month => ({
    label: formatMonth(month),
    value: customersByMonth.value[month] ?? 0,
  })),
)

const unitSeries = computed<ChartPoint[]>(() =>
  monthAxis.value.map(month => ({
    label: formatMonth(month),
    value: unitsByMonth.value[month] ?? 0,
  })),
)

const statusSlices = computed<ChartSlice[]>(() =>
  (data.value?.orderStatusBreakdown ?? []).map((row, index) => ({
    label: humanize(row.status),
    value: row.count,
    tone: STATUS_TONES[row.status] ?? index,
  })),
)

const STATUS_TONES: Record<string, number> = {
  PENDING: 3,
  PAID: 2,
  PROCESSING: 1,
  SHIPPED: 0,
  DELIVERED: 2,
  CANCELLED: 4,
}

const paymentSlices = computed<ChartSlice[]>(() =>
  (data.value?.paymentMethodBreakdown ?? []).map((row, index) => ({
    label: humanize(row.method),
    value: Number(row.amount),
    tone: index,
  })),
)

const totalPaymentAmount = computed(() =>
  (data.value?.paymentMethodBreakdown ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
)

const categoryRevenue = computed(() => data.value?.revenueByCategory ?? [])

const maxCategoryRevenue = computed(() =>
  categoryRevenue.value.reduce((max, row) => Math.max(max, Number(row.revenue)), 0) || 1,
)

const topProducts = computed(() => data.value?.topProducts ?? [])

const maxProductRevenue = computed(() =>
  topProducts.value.reduce((max, row) => Math.max(max, Number(row.revenue)), 0) || 1,
)

const catalogueActivePercent = computed(() => {
  const health = data.value?.catalogueHealth
  if (!health?.totalProducts)
    return 0

  return Math.round((health.activeProducts / health.totalProducts) * 100)
})

/** Units sold against orders placed, which surfaces basket size at a glance. */
const unitsPerOrder = computed(() => {
  const period = data.value?.currentPeriod
  if (!period?.orders)
    return 0

  return period.units / period.orders
})

const metrics = computed(() => {
  const period = data.value?.currentPeriod

  if (!period)
    return []

  return [
    {
      label: 'Revenue',
      value: formatCurrency(period.revenue),
      change: data.value?.changes.revenue ?? null,
      hint: `vs previous ${data.value?.months ?? 6} months`,
      icon: Banknote,
      tone: 0,
      points: revenueSeries.value.map(point => point.value),
    },
    {
      label: 'Orders',
      value: formatNumber(period.orders),
      change: data.value?.changes.orders ?? null,
      hint: `${formatNumber(period.units)} units sold`,
      icon: ShoppingBag,
      tone: 1,
      points: unitSeries.value.map(point => point.value),
    },
    {
      label: 'Average order value',
      value: formatCurrency(data.value?.averageOrderValue),
      change: data.value?.changes.averageOrderValue ?? null,
      hint: `${unitsPerOrder.value.toFixed(1)} units per order`,
      icon: TrendingUp,
      tone: 2,
      points: [],
    },
    {
      label: 'New customers',
      value: formatNumber(period.newCustomers),
      hint: 'Signed up this period',
      icon: Users,
      tone: 5,
      points: customerSeries.value.map(point => point.value),
    },
  ]
})
</script>

<template>
  <PageHeader
    title="Analytics"
    description="Revenue, volume and catalogue performance over time."
    :icon="TrendingUp"
  >
    <template #actions>
      <SegmentedControl
        v-model="months"
        :options="RANGE_OPTIONS"
        label="Reporting range"
      />
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/30 hover:text-slate-100"
        @click="refresh()"
      >
        <RefreshCw
          class="h-4 w-4"
          :class="pending ? 'animate-spin' : ''"
        />
        <span class="hidden sm:inline">Refresh</span>
      </button>
    </template>

    <div class="space-y-4 sm:space-y-5">
      <DataState
        :pending="pending"
        :error="error"
        @refresh="refresh"
      >
        <div class="space-y-4 sm:space-y-5">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              v-for="metric in metrics"
              :key="metric.label"
              :label="metric.label"
              :value="metric.value"
              :hint="metric.hint"
              :change="metric.change"
              :icon="metric.icon"
              :tone="metric.tone"
              :points="metric.points"
            />
          </div>

          <Panel
            title="Revenue trend"
            :description="`Monthly realised sales across the last ${data?.months ?? months} months.`"
            :icon="Banknote"
          >
            <template #actions>
              <div class="hidden items-center gap-4 text-xs text-slate-400 sm:flex">
                <span class="inline-flex items-center gap-1.5">
                  <span
                    class="h-2 w-2 rounded-full"
                    :style="{ backgroundColor: chartColor(0) }"
                  />
                  Revenue
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span
                    class="h-2 w-2 rounded-full"
                    :style="{ backgroundColor: chartColor(1) }"
                  />
                  Orders
                </span>
              </div>
            </template>

            <TrendChart
              :points="revenueSeries"
              :value-formatter="formatCompactCurrency"
            />
          </Panel>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Orders per month"
              description="How many orders closed each month."
              :icon="ShoppingBag"
            >
              <ColumnChart
                :points="revenueSeries.map((point, index) => ({
                  label: point.label,
                  value: revenueByMonth[monthAxis[index] ?? '']?.orders ?? 0,
                }))"
                :value-formatter="formatNumber"
                :height="240"
              />
            </Panel>

            <Panel
              title="Units per month"
              description="Total items sold, regardless of order count."
              :icon="Boxes"
            >
              <ColumnChart
                :points="unitSeries"
                :value-formatter="formatNumber"
                :color="chartColor(3)"
                :height="240"
              />
            </Panel>
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel
              title="Order status mix"
              description="Where orders sit in the pipeline."
              :icon="CircleCheck"
            >
              <DonutChart
                :slices="statusSlices"
                :value-formatter="formatNumber"
              />
            </Panel>

            <Panel
              title="Payments collected"
              description="Paid volume by method."
              :icon="CreditCard"
            >
              <DonutChart
                :slices="paymentSlices"
                :value-formatter="formatCompactCurrency"
              />

              <p class="mt-4 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                Total collected
                <span class="nums font-semibold text-slate-100">
                  {{ formatCurrency(totalPaymentAmount) }}
                </span>
              </p>
            </Panel>

            <Panel
              title="New customers"
              description="Accounts created each month."
              :icon="Users"
            >
              <ColumnChart
                :points="customerSeries"
                :value-formatter="formatNumber"
                :color="chartColor(5)"
                :height="200"
              />
            </Panel>
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Revenue by category"
              description="Where the money actually comes from."
              :icon="Tags"
            >
              <ul
                v-if="categoryRevenue.length"
                class="space-y-4"
              >
                <li
                  v-for="(row, index) in categoryRevenue"
                  :key="row.categoryId ?? 'none'"
                >
                  <ProgressRow
                    :label="row.name"
                    :value="Number(row.revenue)"
                    :max="maxCategoryRevenue"
                    :detail="`${formatCompactCurrency(row.revenue)} · ${formatNumber(row.units)} units`"
                    :color="chartColor(index)"
                  />
                </li>
              </ul>

              <EmptyState
                v-else
                :icon="Tags"
                compact
                title="No category revenue yet"
                description="Revenue appears once orders include categorised products."
              />
            </Panel>

            <Panel
              title="Top products"
              description="Best sellers by all-time revenue."
              :icon="Package"
            >
              <ul
                v-if="topProducts.length"
                class="space-y-4"
              >
                <li
                  v-for="(product, index) in topProducts"
                  :key="product.productId"
                >
                  <ProgressRow
                    :label="product.name"
                    :value="Number(product.revenue)"
                    :max="maxProductRevenue"
                    :detail="`${formatCompactCurrency(product.revenue)} · ${formatCompactNumber(product.unitsSold)} units`"
                    :color="chartColor(index)"
                  />
                </li>
              </ul>

              <EmptyState
                v-else
                :icon="Package"
                compact
                title="No products sold yet"
              />
            </Panel>
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Low stock"
              description="At or below the configured threshold."
              :icon="TriangleAlert"
              flush
            >
              <template #actions>
                <NuxtLink
                  to="/inventory"
                  class="text-xs font-medium text-indigo-400 hover:underline"
                >
                  Manage inventory
                </NuxtLink>
              </template>

              <ul
                v-if="data?.lowStockItems.length"
                class="divide-y divide-slate-800/80"
              >
                <li
                  v-for="item in data.lowStockItems"
                  :key="item.productId"
                  class="flex items-center gap-3 px-5 py-3"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    :class="item.quantity === 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'"
                  >
                    <Package class="h-4 w-4" />
                  </span>

                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-slate-100">
                      {{ item.name }}
                    </p>
                    <p class="text-xs text-slate-400">
                      Threshold {{ formatNumber(item.threshold) }} · {{ formatNumber(item.reserved) }} reserved
                    </p>
                  </div>

                  <span
                    class="nums shrink-0 text-sm font-semibold"
                    :class="item.quantity === 0 ? 'text-rose-400' : 'text-slate-100'"
                  >
                    {{ formatNumber(item.quantity) }}
                  </span>
                </li>
              </ul>

              <EmptyState
                v-else
                :icon="CircleCheck"
                compact
                title="Stock levels are healthy"
                description="Nothing is at or below its low stock threshold."
              />
            </Panel>

            <Panel
              title="Catalogue health"
              description="Active versus inactive listings."
              :icon="Package"
            >
              <div class="space-y-5">
                <div class="grid grid-cols-3 gap-3">
                  <div class="rounded-lg bg-slate-950/50 border border-slate-800/50 px-3 py-3 text-center">
                    <p class="nums text-xl font-semibold text-slate-100">
                      {{ formatCompactNumber(data?.catalogueHealth.totalProducts) }}
                    </p>
                    <p class="mt-0.5 text-xs text-slate-400">
                      Total
                    </p>
                  </div>
                  <div class="rounded-lg bg-emerald-500/10 px-3 py-3 text-center">
                    <p class="nums text-xl font-semibold text-emerald-400">
                      {{ formatCompactNumber(data?.catalogueHealth.activeProducts) }}
                    </p>
                    <p class="mt-0.5 text-xs text-emerald-400/80">
                      Active
                    </p>
                  </div>
                  <div class="rounded-lg bg-slate-950/50 border border-slate-800/50 px-3 py-3 text-center">
                    <p class="nums text-xl font-semibold text-slate-300">
                      {{ formatCompactNumber(data?.catalogueHealth.inactiveProducts) }}
                    </p>
                    <p class="mt-0.5 text-xs text-slate-400">
                      Inactive
                    </p>
                  </div>
                </div>

                <ProgressRow
                  label="Active listings"
                  :value="catalogueActivePercent"
                  :detail="`${catalogueActivePercent}/`"
                  :color="chartColor(2)"
                />

                <ProgressRow
                  label="Category coverage"
                  :value="categoryRevenue.length"
                  :max="Math.max(data?.catalogueHealth.totalProducts ?? 0, 1)"
                  :detail="`${formatNumber(categoryRevenue.length)} selling categories`"
                  :color="chartColor(1)"
                />
              </div>
            </Panel>
          </div>
        </div>
      </DataState>
    </div>
  </PageHeader>
</template>
