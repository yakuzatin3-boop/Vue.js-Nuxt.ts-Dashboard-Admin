<script setup lang="ts">
import type { AdminStats } from '~/types/api'
import type { ChartPoint, ChartSlice } from '~/types/chart'
import { chartColor } from '~/types/chart'
import {
  Banknote,
  CircleCheck,
  Clock,
  CreditCard,
  Package,
  RefreshCw,
  ShoppingBag,
  Star,
  TriangleAlert,
  TrendingUp,
  Users,
  Warehouse,
} from '@lucide/vue'
import {
  formatCompactCurrency,
  formatCurrency,
  formatMonth,
  formatNumber,
  formatRelative,
  humanize,
} from '~/utils/format'
import { lastMonths } from '~/utils/months'

useHead({ title: 'Dashboard' })

const api = useApiClient()

const STATS_MONTHS = 6

// Pinned so a status reads as the same colour on the dashboard and analytics.
const STATUS_TONES: Record<string, number> = {
  PENDING: 3,
  PAID: 2,
  PROCESSING: 1,
  SHIPPED: 0,
  DELIVERED: 2,
  CANCELLED: 4,
}

const { data: stats, pending, error, refresh }
  = await useAsyncData<AdminStats>('admin-stats', () => api.get('/admin/stats').then(r => r.data))

// Drawn from the dashboard payload rather than a second request: the chart and
// the cards must never disagree, and two fetches could land on different data.
/**
 * Fixed trailing window rather than the data's own range: the panel promises
 * "the last six months", so a month with no orders has to be a visible zero
 * instead of a shorter chart.
 */
const monthAxis = computed<string[]>(() => lastMonths(STATS_MONTHS))

const revenueByMonth = computed(
  () => new Map((stats.value?.revenueByMonth ?? []).map(row => [row.month, row])),
)

const revenueSeries = computed<ChartPoint[]>(() =>
  monthAxis.value.map(month => ({
    label: formatMonth(month),
    value: Number(revenueByMonth.value.get(month)?.total ?? 0),
  })),
)

const orderSeries = computed<ChartPoint[]>(() =>
  monthAxis.value.map(month => ({
    label: formatMonth(month),
    value: revenueByMonth.value.get(month)?.orders ?? 0,
  })),
)

const statusSlices = computed<ChartSlice[]>(
  () =>
    stats.value?.orderStatusBreakdown.map((row, index) => ({
      label: humanize(row.status),
      value: row.count,
      // Offset by status so the same status keeps the same colour everywhere.
      tone: STATUS_TONES[row.status] ?? index,
    })) ?? [],
)

const maxTopRevenue = computed(() => {
  const rows = stats.value?.topProducts ?? []

  return rows.reduce((max, row) => Math.max(max, Number(row.revenue)), 0) || 1
})

const cards = computed(() => {
  if (!stats.value)
    return []

  const s = stats.value

  return [
    {
      label: 'Total revenue',
      value: formatCurrency(s.totalRevenue),
      hint: `${formatNumber(s.fulfilledOrders)} fulfilled orders`,
      icon: Banknote,
      tone: 0,
      points: revenueSeries.value.map(point => point.value),
    },
    {
      label: 'Orders',
      value: formatNumber(s.totalOrders),
      hint: `${formatNumber(s.pendingOrders)} awaiting fulfilment · ${formatNumber(s.cancelledOrders)} cancelled`,
      icon: ShoppingBag,
      tone: 1,
      points: orderSeries.value.map(point => point.value),
    },
    {
      label: 'Products',
      value: formatNumber(s.totalProducts),
      hint: `${formatNumber(s.activeProducts)} active`,
      icon: Package,
      tone: 2,
      points: [],
    },
    {
      label: 'Customers',
      value: formatNumber(s.totalCustomers),
      hint: `${formatNumber(s.totalUsers)} registered users`,
      icon: Users,
      tone: 5,
      points: [],
    },
    {
      label: 'Stock units',
      value: formatNumber(s.totalInventoryUnits),
      hint: `${formatNumber(s.lowStockCount)} low stock`,
      icon: Warehouse,
      tone: 3,
      points: [],
    },
    {
      label: 'Reviews',
      value: formatNumber(s.totalReviews),
      hint: s.averageRating ? `${s.averageRating} average rating` : 'Not yet rated',
      icon: Star,
      tone: 4,
      points: [],
    },
  ]
})

const catalogueActivePercent = computed(() => {
  if (!stats.value?.totalProducts)
    return 0

  return Math.round((stats.value.activeProducts / stats.value.totalProducts) * 100)
})

/**
 * Denominator is every order except the cancelled ones. Cancelling is not a
 * fulfilment failure, so including them here would understate the rate and make
 * a healthy store look broken.
 */
const fulfilmentRate = computed(() => {
  const s = stats.value

  if (!s?.totalOrders)
    return 0

  const eligible = s.totalOrders - s.cancelledOrders

  if (eligible <= 0)
    return 0

  return Math.round((s.fulfilledOrders / eligible) * 100)
})

/**
 * Refunds count against the rate: that money came back, so treating a refunded
 * payment as a success would overstate how much was actually kept.
 */
const paymentSuccessRate = computed(() => {
  const s = stats.value

  if (!s?.totalPayments)
    return 0

  return Math.round((s.paidPayments / s.totalPayments) * 100)
})
</script>

<template>
  <PageHeader
    title="Dashboard"
    description="Store performance at a glance."
    :icon="TrendingUp"
  >
    <template #actions>
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
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              v-for="card in cards"
              :key="card.label"
              :label="card.label"
              :value="card.value"
              :hint="card.hint"
              :icon="card.icon"
              :tone="card.tone"
              :points="card.points"
            />
          </div>

          <div
            v-if="stats && stats.lowStockCount > 0"
            class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3"
          >
            <TriangleAlert class="h-5 w-5 shrink-0 text-amber-400" />
            <p class="min-w-0 flex-1 text-sm text-amber-300">
              <span class="font-semibold">{{ formatNumber(stats.lowStockCount) }}</span>
              {{ stats.lowStockCount === 1 ? 'product is' : 'products are' }} at or below
              the low stock threshold.
            </p>
            <NuxtLink
              to="/inventory"
              class="shrink-0 text-sm font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-400"
            >
              Review inventory
            </NuxtLink>
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel
              title="Revenue"
              description="Realised sales over the last six months, excluding cancelled orders."
              :icon="Banknote"
              class="lg:col-span-2"
            >
              <template #actions>
                <NuxtLink
                  to="/analytics"
                  class="text-xs font-medium text-indigo-400 hover:underline"
                >
                  Analytics
                </NuxtLink>
              </template>

              <TrendChart
                :points="revenueSeries"
                :value-formatter="formatCompactCurrency"
              />
            </Panel>

            <Panel
              title="Order pipeline"
              description="Every order by current status."
              :icon="ShoppingBag"
            >
              <DonutChart
                :slices="statusSlices"
                :value-formatter="formatNumber"
              />
            </Panel>
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel
              title="Recent orders"
              description="The five most recent checkouts."
              :icon="Clock"
              class="lg:col-span-2"
              flush
            >
              <template #actions>
                <NuxtLink
                  to="/orders"
                  class="text-xs font-medium text-indigo-400 hover:underline"
                >
                  View all
                </NuxtLink>
              </template>

              <ul
                v-if="stats?.recentOrders.length"
                class="divide-y divide-slate-800/80"
              >
                <li
                  v-for="order in stats.recentOrders"
                  :key="order.id"
                  class="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-800/30"
                >
                  <span class="nums flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-semibold text-slate-300">
                    #{{ order.id }}
                  </span>

                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-slate-100">
                      {{ order.user?.name || order.user?.email || 'Guest' }}
                    </p>
                    <p class="truncate text-xs text-slate-400">
                      {{ formatRelative(order.createdAt) }}
                    </p>
                  </div>

                  <div class="hidden shrink-0 sm:block">
                    <StatusBadge :value="order.status" />
                  </div>

                  <span class="nums shrink-0 text-sm font-semibold text-slate-100">
                    {{ formatCurrency(order.total) }}
                  </span>
                </li>
              </ul>

              <EmptyState
                v-else
                :icon="ShoppingBag"
                compact
                title="No orders yet"
                description="Orders will appear here as soon as the first checkout completes."
              />
            </Panel>

            <Panel
              title="Store health"
              :icon="CircleCheck"
            >
              <div class="space-y-5">
                <ProgressRow
                  label="Catalogue active"
                  :detail="`${catalogueActivePercent}/`"
                  :value="catalogueActivePercent"
                  :color="chartColor(2)"
                />
                <ProgressRow
                  label="Orders fulfilled"
                  :detail="`${formatNumber(stats?.fulfilledOrders)} / ${formatNumber((stats?.totalOrders ?? 0) - (stats?.cancelledOrders ?? 0))}`"
                  :value="fulfilmentRate"
                  :color="chartColor(1)"
                />
                <ProgressRow
                  label="Payments collected"
                  :detail="`${formatNumber(stats?.paidPayments)} of ${formatNumber(stats?.totalPayments)} · ${formatNumber(stats?.failedPayments)} failed`"
                  :value="paymentSuccessRate"
                  :color="chartColor(3)"
                />
                <ProgressRow
                  label="Average rating"
                  :detail="stats?.averageRating ? `${stats.averageRating} / 5` : 'No reviews yet'"
                  :value="stats?.averageRating ?? 0"
                  :color="chartColor(4)"
                />

                <dl class="grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-4">
                  <div>
                    <dt class="text-xs text-slate-400">
                      Categories
                    </dt>
                    <dd class="nums mt-0.5 text-lg font-semibold text-slate-100">
                      {{ formatNumber(stats?.totalCategories) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-400">
                      Brands
                    </dt>
                    <dd class="nums mt-0.5 text-lg font-semibold text-slate-100">
                      {{ formatNumber(stats?.totalBrands) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-400">
                      Users
                    </dt>
                    <dd class="nums mt-0.5 text-lg font-semibold text-slate-100">
                      {{ formatNumber(stats?.totalUsers) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-400">
                      Payments
                    </dt>
                    <dd class="nums mt-0.5 text-lg font-semibold text-slate-100">
                      {{ formatNumber(stats?.totalPayments) }}
                    </dd>
                  </div>
                </dl>
              </div>
            </Panel>
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Top selling products"
              description="Best sellers by all-time revenue."
              :icon="TrendingUp"
            >
              <ol
                v-if="stats?.topProducts.length"
                class="space-y-4"
              >
                <li
                  v-for="(product, index) in stats.topProducts"
                  :key="product.productId"
                >
                  <div class="mb-1.5 flex items-baseline gap-3">
                    <span class="nums flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 text-[11px] font-semibold text-slate-300">
                      {{ index + 1 }}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-sm text-slate-100">
                      {{ product.name }}
                    </span>
                    <span class="nums shrink-0 text-sm font-medium text-slate-100">
                      {{ formatCurrency(product.revenue) }}
                    </span>
                  </div>

                  <div class="pl-8">
                    <ProgressRow
                      :value="Number(product.revenue)"
                      :max="maxTopRevenue"
                      :detail="`${formatNumber(product.unitsSold)} units`"
                      :color="chartColor(index)"
                    />
                  </div>
                </li>
              </ol>

              <EmptyState
                v-else
                :icon="Package"
                compact
                title="No sales yet"
                description="Your best sellers will be ranked here once orders start coming in."
              />
            </Panel>

            <Panel
              title="Orders per month"
              description="Volume behind the revenue trend."
              :icon="ShoppingBag"
            >
              <ColumnChart
                :points="orderSeries"
                :value-formatter="formatNumber"
                :height="230"
              />
            </Panel>
          </div>

          <Panel
            title="Quick reference"
            description="Jump straight into the area that needs attention."
            :icon="CreditCard"
          >
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <NuxtLink
                v-for="link in [
                  { to: '/orders', label: 'Orders', icon: ShoppingBag },
                  { to: '/payments', label: 'Payments', icon: CreditCard },
                  { to: '/inventory', label: 'Inventory', icon: Warehouse },
                  { to: '/products', label: 'Products', icon: Package },
                  { to: '/customers', label: 'Customers', icon: Users },
                  { to: '/reviews', label: 'Reviews', icon: Star },
                ]"
                :key="link.to"
                :to="link.to"
                class="group flex items-center gap-2.5 rounded-lg border border-slate-800/80 px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-indigo-500/30/40 hover:bg-indigo-500/10 hover:text-indigo-400"
              >
                <component
                  :is="link.icon"
                  class="h-4 w-4 shrink-0"
                />
                <span class="truncate">{{ link.label }}</span>
              </NuxtLink>
            </div>
          </Panel>
        </div>
      </DataState>
    </div>
  </PageHeader>
</template>
