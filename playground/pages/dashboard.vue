<script setup lang="ts">
import type { Component } from 'vue'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  CreditCard,
  Globe,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Package,
  Search,
  Send,
  Settings,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  TriangleAlert,
  Users,
  Wallet,
} from '@lucide/vue'

// The dashboard renders its own rail and top bar, so the shared layout would
// only add a second set of them around it.
definePageMeta({ layout: false })

useHead({ title: 'Ecommerce Admin' })

type Tone = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky'

interface NavItem {
  label: string
  icon: Component
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

interface Kpi {
  id: string
  title: string
  value: string
  trend: number
  trendLabel: string
  context: string
  icon: Component
  tone: Tone
  spark: number[]
}

interface TopProduct {
  rank: number
  name: string
  sku: string
  category: string
  unitsSold: number
  revenue: string
  change: number
}

interface RevenueTrend {
  month: string
  orders: number
  change: number
}

interface LowStockItem {
  name: string
  sku: string
  remaining: number
  threshold: number
}

interface PaymentMethod {
  id: string
  label: string
  share: number
  amount: string
  icon: Component
  tone: Tone
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard },
      { label: 'Analytics', icon: ChartNoAxesCombined, badge: 'New' },
      { label: 'Activity Log', icon: Activity },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { label: 'Orders', icon: ShoppingBag, badge: '24' },
      { label: 'Products', icon: Package },
      { label: 'Inventory', icon: Package },
      { label: 'Customers', icon: Users },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Payments', icon: CreditCard },
      { label: 'Settings', icon: Settings },
    ],
  },
]

const KPIS: Kpi[] = [
  {
    id: 'revenue',
    title: 'Total Revenue',
    value: '$45,231.89',
    trend: 18.5,
    trendLabel: 'vs. last month',
    context: 'Net sales after refunds and discounts',
    icon: Wallet,
    tone: 'emerald',
    spark: [22, 34, 28, 46, 41, 58, 52, 67, 63, 78, 74, 91],
  },
  {
    id: 'subscriptions',
    title: 'Subscriptions',
    value: '2,847',
    trend: 7.2,
    trendLabel: 'net new this month',
    context: '1.4/ churn over trailing 30 days',
    icon: CreditCard,
    tone: 'indigo',
    spark: [48, 44, 52, 49, 58, 61, 57, 66, 70, 68, 74, 79],
  },
  {
    id: 'active-now',
    title: 'Active Now',
    value: '1,204',
    trend: -4.6,
    trendLabel: 'last 60 minutes',
    context: 'Peak concurrency was 1,688 at 14:00',
    icon: Activity,
    tone: 'sky',
    spark: [64, 71, 58, 66, 49, 55, 61, 47, 52, 44, 49, 41],
  },
  {
    id: 'conversion',
    title: 'Conversion Rate',
    value: '3.68/',
    trend: 0.9,
    trendLabel: 'above 30-day average',
    context: '32,910 sessions across 3 storefronts',
    icon: ArrowUpRight,
    tone: 'amber',
    spark: [30, 34, 29, 38, 42, 39, 45, 43, 51, 48, 56, 60],
  },
]

const TOP_PRODUCTS: TopProduct[] = [
  {
    rank: 1,
    name: 'Aurora Wireless Headset',
    sku: 'AUR-4410-BLK',
    category: 'Audio',
    unitsSold: 1284,
    revenue: '$96,300.00',
    change: 24.1,
  },
  {
    rank: 2,
    name: 'Nimbus 27" 4K Monitor',
    sku: 'NIM-27U-4K',
    category: 'Displays',
    unitsSold: 862,
    revenue: '$78,442.00',
    change: 11.8,
  },
  {
    rank: 3,
    name: 'Vertex Mechanical Keyboard',
    sku: 'VTX-87-RGB',
    category: 'Peripherals',
    unitsSold: 741,
    revenue: '$52,011.00',
    change: -3.4,
  },
  {
    rank: 4,
    name: 'Helios Desk Lamp Pro',
    sku: 'HEL-DLP-02',
    category: 'Workspace',
    unitsSold: 613,
    revenue: '$24,520.00',
    change: 6.2,
  },
  {
    rank: 5,
    name: 'Cobalt Mechanical Watch',
    sku: 'CBT-MW-STEEL',
    category: 'Accessories',
    unitsSold: 429,
    revenue: '$21,450.00',
    change: -12.7,
  },
  {
    rank: 6,
    name: 'Lumen 4K Action Camera',
    sku: 'LMN-AC-4K',
    category: 'Cameras',
    unitsSold: 318,
    revenue: '$19,080.00',
    change: 2.9,
  },
]

const REVENUE_TREND: RevenueTrend[] = [
  { month: 'February', orders: 312, change: 4.2 },
  { month: 'March', orders: 428, change: 9.8 },
  { month: 'April', orders: 386, change: -1.4 },
  { month: 'May', orders: 517, change: 14.6 },
  { month: 'June', orders: 604, change: 8.1 },
  { month: 'July', orders: 742, change: 12.4 },
]

const LOW_STOCK_ITEMS: LowStockItem[] = [
  { name: 'Cobalt Mechanical Watch', sku: 'CBT-MW-STEEL', remaining: 0, threshold: 25 },
  { name: 'Helios Desk Lamp Pro', sku: 'HEL-DLP-02', remaining: 1, threshold: 25 },
  { name: 'Vertex Mechanical Keyboard', sku: 'VTX-87-RGB', remaining: 3, threshold: 25 },
  { name: 'Nimbus USB-C Hub', sku: 'NIM-HUB-9P', remaining: 6, threshold: 25 },
]

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'card', label: 'Card', share: 62, amount: '$28,043.77', icon: CreditCard, tone: 'indigo' },
  { id: 'wallet', label: 'Wallet', share: 21, amount: '$9,498.70', icon: Wallet, tone: 'emerald' },
  { id: 'bnpl', label: 'BNPL', share: 11, amount: '$4,975.51', icon: Smartphone, tone: 'amber' },
  { id: 'other', label: 'Other', share: 6, amount: '$2,713.91', icon: Globe, tone: 'sky' },
]

const TONE_CLASS: Record<Tone, { text: string, chip: string, dot: string }> = {
  indigo: {
    text: 'text-indigo-400',
    chip: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    dot: 'bg-indigo-400',
  },
  emerald: {
    text: 'text-emerald-400',
    chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  amber: {
    text: 'text-amber-400',
    chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  rose: {
    text: 'text-rose-400',
    chip: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    dot: 'bg-rose-400',
  },
  sky: {
    text: 'text-sky-400',
    chip: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    dot: 'bg-sky-400',
  },
}

const isCollapsed = ref(false)
const activeNav = ref('Dashboard')
const paletteOpen = ref(false)
const paletteQuery = ref('')
const prompt = ref('')
const sending = ref(false)

const maxOrders = computed(() =>
  Math.max(...REVENUE_TREND.map(row => row.orders)),
)

const sparkPoints = (points: number[]): string => {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1

  return points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100
      const y = 30 - ((value - min) / span) * 26 - 2

      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

const filteredNav = computed<NavSection[]>(() => {
  const query = paletteQuery.value.trim().toLowerCase()

  if (!query)
    return NAV_SECTIONS

  return NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.label.toLowerCase().includes(query)),
    }))
    .filter(section => section.items.length > 0)
})

const stockTone = (item: LowStockItem): Tone => (item.remaining === 0 ? 'rose' : 'amber')

const stockLabel = (item: LowStockItem): string =>
  item.remaining === 0 ? 'Out of stock' : `${item.remaining} left`

function selectNav(label: string): void {
  activeNav.value = label
  paletteOpen.value = false
  paletteQuery.value = ''
}

function sendPrompt(): void {
  const value = prompt.value.trim()

  if (!value || sending.value)
    return

  sending.value = true
  prompt.value = ''

  window.setTimeout(() => {
    sending.value = false
  }, 900)
}
</script>

<template>
  <div class="flex min-h-screen bg-slate-950 text-slate-100 antialiased">
    <!-- Ambient wash so the near-black canvas does not read as flat. -->
    <div
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(60rem_40rem_at_15%_-10%,rgba(79,70,229,0.16),transparent_60%),radial-gradient(50rem_35rem_at_100%_0%,rgba(16,185,129,0.10),transparent_60%)]"
    />

    <!-- Left rail -->
    <aside
      :class="[
        'sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md transition-[width] duration-300 ease-out',
        isCollapsed ? 'w-[72px]' : 'w-64',
      ]"
    >
      <div class="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800/80 px-4">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
          <Store class="h-5 w-5" />
        </span>
        <template v-if="!isCollapsed">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold tracking-tight text-slate-100">
              Ecommerce Admin
            </p>
            <p class="text-[11px] text-slate-500">
              Commerce OS
            </p>
          </div>
          <span class="shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
            v2.4
          </span>
        </template>
      </div>

      <nav class="scrollbar-slim flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div
          v-for="section in NAV_SECTIONS"
          :key="section.title"
          class="space-y-1"
        >
          <p
            v-if="!isCollapsed"
            class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
          >
            {{ section.title }}
          </p>
          <div
            v-else
            class="mx-3 mb-2 border-t border-slate-800/80"
          />
          <button
            v-for="item in section.items"
            :key="item.label"
            type="button"
            :title="isCollapsed ? item.label : undefined"
            :aria-current="activeNav === item.label ? 'page' : undefined"
            :class="[
              'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
              activeNav === item.label
                ? 'border border-indigo-500/20 bg-indigo-600/10 text-indigo-400'
                : 'border border-transparent text-slate-400 hover:border-slate-700/80 hover:bg-slate-800/40 hover:text-slate-100',
            ]"
            @click="selectNav(item.label)"
          >
            <span
              v-if="activeNav === item.label"
              aria-hidden="true"
              class="absolute top-1/2 -left-3 h-5 w-0.5 -translate-y-1/2 rounded-r bg-indigo-400"
            />
            <component
              :is="item.icon"
              class="h-4 w-4 shrink-0"
            />
            <span
              v-if="!isCollapsed"
              class="flex-1 truncate text-left"
            >{{ item.label }}</span>
            <span
              v-if="item.badge && !isCollapsed"
              :class="[
                'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                item.badge === 'New'
                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'border border-slate-700/80 bg-slate-800/60 text-slate-400',
              ]"
            >
              {{ item.badge }}
            </span>
          </button>
        </div>
      </nav>

      <div class="shrink-0 border-t border-slate-800/80 p-3">
        <div class="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-2 transition-all hover:border-slate-700/80">
          <span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-xs font-bold text-white">
            YK
            <span class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
          </span>
          <template v-if="!isCollapsed">
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-semibold text-slate-100">
                Yakuza Tin
              </p>
              <p class="truncate text-[11px] text-slate-500">
                owner@ecommerce.io
              </p>
            </div>
            <button
              type="button"
              title="Sign out"
              class="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </template>
        </div>
      </div>

      <button
        type="button"
        :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        class="absolute top-[72px] -right-3 z-40 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900 text-slate-400 transition-colors hover:border-indigo-500/40 hover:text-indigo-400 lg:flex"
        @click="isCollapsed = !isCollapsed"
      >
        <component
          :is="isCollapsed ? ChevronRight : ChevronLeft"
          class="h-3.5 w-3.5"
        />
      </button>
    </aside>

    <!-- Content column -->
    <div class="relative z-10 flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-slate-800/80 bg-slate-950/80 px-4 backdrop-blur-md sm:px-6">
        <div class="min-w-0 flex-1">
          <nav
            aria-label="Breadcrumb"
            class="flex items-center gap-1.5 text-xs font-medium text-slate-500"
          >
            <span class="truncate">Ecommerce</span>
            <ChevronRight class="h-3 w-3 shrink-0 text-slate-300" />
            <span class="truncate text-slate-400">Chart Bot</span>
            <ChevronRight class="h-3 w-3 shrink-0 text-slate-300" />
            <span
              aria-current="page"
              class="truncate text-slate-100"
            >Analytics</span>
          </nav>
          <p class="hidden text-[11px] text-slate-500 sm:block">
            Storefront and warehouse data, refreshed continuously.
          </p>
        </div>

        <button
          type="button"
          class="group flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 text-left transition-all hover:border-slate-700/80 focus:border-indigo-500/40 focus:outline-none"
          @click="paletteOpen = true"
        >
          <Search class="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-indigo-400" />
          <span class="flex-1 truncate text-xs text-slate-500 sm:text-sm">
            Search orders, products, customers…
          </span>
          <span class="hidden shrink-0 items-center gap-1 rounded-md border border-slate-700/80 bg-slate-800/60 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 sm:flex">
            <Command class="h-3 w-3" />
            K
          </span>
        </button>

        <span class="hidden shrink-0 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 md:flex">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Live store data
        </span>

        <button
          type="button"
          class="relative hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800/80 bg-slate-900/60 text-slate-400 transition-all hover:border-slate-700/80 hover:text-slate-100 sm:flex"
        >
          <Package class="h-4 w-4" />
          <span class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            4
          </span>
        </button>
      </header>

      <main class="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <!-- Critical inventory alert -->
        <section
          aria-label="Low stock alert"
          class="rounded-xl border border-amber-500/20 bg-slate-900/60 p-4 backdrop-blur-md transition-all hover:border-amber-500/30 sm:p-5"
        >
          <div class="flex flex-wrap items-center gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <TriangleAlert class="h-5 w-5" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-bold tracking-tight text-slate-100">
                4 products are at or below their reorder threshold
              </p>
              <p class="text-[11px] text-slate-500">
                Fulfilment pauses on these SKUs once stock reaches zero.
              </p>
            </div>
            <button
              type="button"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
            >
              Restock all
              <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article
              v-for="item in LOW_STOCK_ITEMS"
              :key="item.sku"
              class="flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2.5 transition-all hover:border-slate-700/80"
            >
              <span
                :class="[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold',
                  TONE_CLASS[stockTone(item)].chip,
                ]"
              >
                {{ item.remaining }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-slate-100">
                  {{ item.name }}
                </p>
                <p class="truncate text-[11px] text-slate-500">
                  {{ item.sku }} · threshold {{ item.threshold }}
                </p>
              </div>
              <span
                :class="[
                  'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
                  TONE_CLASS[stockTone(item)].chip,
                ]"
              >
                {{ stockLabel(item) }}
              </span>
            </article>
          </div>
        </section>

        <!-- KPI row -->
        <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="kpi in KPIS"
            :key="kpi.id"
            class="group relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-700/80 hover:shadow-xl hover:shadow-indigo-950/40"
          >
            <div
              aria-hidden="true"
              class="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-indigo-500/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
            />
            <div class="flex items-start justify-between gap-3">
              <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {{ kpi.title }}
              </p>
              <component
                :is="kpi.icon"
                :class="['h-4 w-4 shrink-0', TONE_CLASS[kpi.tone].text]"
              />
            </div>

            <p class="nums mt-3 font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {{ kpi.value }}
            </p>

            <div class="mt-3 flex items-center gap-2">
              <span
                :class="[
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
                  kpi.trend >= 0
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border-rose-500/20 bg-rose-500/10 text-rose-400',
                ]"
              >
                <component
                  :is="kpi.trend >= 0 ? ArrowUpRight : ArrowDownRight"
                  class="h-3.5 w-3.5"
                />
                {{ kpi.trend >= 0 ? '+' : '' }}{{ kpi.trend }}%
              </span>
              <span class="truncate text-[11px] text-slate-500">
                {{ kpi.trendLabel }}
              </span>
            </div>

            <svg
              viewBox="0 0 100 32"
              preserveAspectRatio="none"
              class="mt-4 h-8 w-full"
            >
              <polyline
                :points="sparkPoints(kpi.spark)"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
                :class="TONE_CLASS[kpi.tone].text"
              />
            </svg>

            <p class="mt-3 text-[11px] text-slate-500">
              {{ kpi.context }}
            </p>
          </article>
        </section>

        <!-- Analytics grid -->
        <section class="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div class="lg:col-span-8">
            <article class="h-full rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md transition-all hover:border-slate-700/80">
              <header class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
                <div>
                  <h2 class="text-sm font-bold tracking-tight text-slate-100">
                    Top Selling Products
                  </h2>
                  <p class="text-[11px] text-slate-500">
                    Ranked by units sold in the trailing 30 days
                  </p>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-400 transition-all hover:border-slate-700/80 hover:text-slate-100"
                >
                  All products
                  <ChevronDown class="h-3.5 w-3.5" />
                </button>
              </header>

              <div class="hidden grid-cols-12 gap-3 border-b border-slate-800/80 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:grid">
                <span class="col-span-1">#</span>
                <span class="col-span-5">Product</span>
                <span class="col-span-2 text-right">Units</span>
                <span class="col-span-2 text-right">Revenue</span>
                <span class="col-span-2 text-right">Trend</span>
              </div>

              <ol class="divide-y divide-slate-800/60">
                <li
                  v-for="product in TOP_PRODUCTS"
                  :key="product.sku"
                  class="grid grid-cols-12 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-800/30"
                >
                  <span class="col-span-1 flex h-6 w-6 items-center justify-center rounded-md border border-slate-800/80 bg-slate-950/60 text-[11px] font-bold text-slate-400 tabular-nums">
                    {{ product.rank }}
                  </span>

                  <div class="col-span-11 flex min-w-0 items-center gap-3 sm:col-span-5">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800/80 bg-slate-800/50 text-slate-400">
                      <Package class="h-4 w-4" />
                    </span>
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-slate-100">
                        {{ product.name }}
                      </p>
                      <p class="truncate text-[11px] text-slate-500">
                        {{ product.sku }} · {{ product.category }}
                      </p>
                    </div>
                  </div>

                  <p class="col-span-5 hidden text-right text-sm text-slate-400 tabular-nums sm:col-span-2 sm:block">
                    {{ product.unitsSold.toLocaleString('en-US') }}
                  </p>
                  <p class="col-span-4 text-right text-sm font-semibold text-slate-100 tabular-nums sm:col-span-2">
                    {{ product.revenue }}
                  </p>

                  <p class="col-span-2 text-right">
                    <span
                      :class="[
                        'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                        product.change >= 0
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : 'border-rose-500/20 bg-rose-500/10 text-rose-400',
                      ]"
                    >
                      <component
                        :is="product.change >= 0 ? ArrowUpRight : ArrowDownRight"
                        class="h-3 w-3"
                      />
                      {{ Math.abs(product.change) }}%
                    </span>
                  </p>
                </li>
              </ol>
            </article>
          </div>

          <div class="lg:col-span-4">
            <article class="h-full rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md transition-all hover:border-slate-700/80">
              <header class="border-b border-slate-800/80 px-5 py-4">
                <h2 class="text-sm font-bold tracking-tight text-slate-100">
                  Revenue Trend
                </h2>
                <p class="text-[11px] text-slate-500">
                  Order volume by month, last six months
                </p>
              </header>

              <div class="space-y-4 px-5 py-5">
                <div
                  v-for="row in REVENUE_TREND"
                  :key="row.month"
                  class="group space-y-1.5"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-medium text-slate-400">{{ row.month }}</span>
                    <span class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-slate-100 tabular-nums">
                        {{ row.orders.toLocaleString('en-US') }}
                      </span>
                      <span
                        :class="[
                          'text-[11px] font-semibold tabular-nums',
                          row.change >= 0 ? 'text-emerald-400' : 'text-rose-400',
                        ]"
                      >
                        {{ row.change >= 0 ? '+' : '' }}{{ row.change }}%
                      </span>
                    </span>
                  </div>
                  <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/60">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-[width] duration-500"
                      :style="{ width: `${Math.round((row.orders / maxOrders) * 100)}%` }"
                    />
                  </div>
                </div>

                <div class="border-t border-slate-800/80 pt-4">
                  <p class="pb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Payment Methods
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="method in PAYMENT_METHODS"
                      :key="method.id"
                      :class="[
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-125',
                        TONE_CLASS[method.tone].chip,
                      ]"
                      :title="`${method.amount} · ${method.share}% of revenue`"
                    >
                      <component
                        :is="method.icon"
                        class="h-3.5 w-3.5"
                      />
                      {{ method.label }}
                      <span class="tabular-nums opacity-70">{{ method.share }}%</span>
                    </span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      <!-- Floating assistant -->
      <div class="pointer-events-none sticky bottom-0 z-20 px-4 pb-4 sm:px-6 sm:pb-6">
        <form
          class="pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-2 rounded-xl border border-indigo-500/40 bg-slate-900/80 p-2 shadow-2xl shadow-indigo-950/60 backdrop-blur-md transition-colors focus-within:border-indigo-500"
          @submit.prevent="sendPrompt"
        >
          <Sparkles class="ml-1 h-4 w-4 shrink-0 text-indigo-400" />
          <input
            v-model="prompt"
            type="text"
            placeholder="Ask the Chart Bot anything about revenue, stock or customers…"
            class="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          >
          <button
            type="submit"
            :disabled="!prompt.trim() || sending"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:from-indigo-500 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LoaderCircle
              v-if="sending"
              class="h-3.5 w-3.5 animate-spin"
            />
            <Send
              v-else
              class="h-3.5 w-3.5"
            />
            Send
          </button>
        </form>
      </div>
    </div>

    <!-- Command palette -->
    <div
      v-if="paletteOpen"
      class="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      @click.self="paletteOpen = false"
    >
      <div class="w-full max-w-lg overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-md">
        <div class="flex items-center gap-3 border-b border-slate-800/80 px-4 py-3">
          <Search class="h-4 w-4 shrink-0 text-slate-500" />
          <input
            v-model="paletteQuery"
            type="text"
            placeholder="Jump to a section…"
            autofocus
            class="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            @keydown.esc="paletteOpen = false"
          >
          <button
            type="button"
            class="shrink-0 rounded-md border border-slate-700/80 bg-slate-800/60 px-1.5 py-0.5 text-[11px] font-medium text-slate-400"
            @click="paletteOpen = false"
          >
            Esc
          </button>
        </div>

        <div class="scrollbar-slim max-h-80 overflow-y-auto p-2">
          <div
            v-for="section in filteredNav"
            :key="section.title"
            class="mb-1"
          >
            <p class="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {{ section.title }}
            </p>
            <button
              v-for="item in section.items"
              :key="item.label"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-indigo-600/10 hover:text-indigo-400"
              @click="selectNav(item.label)"
            >
              <component
                :is="item.icon"
                class="h-4 w-4 shrink-0 text-slate-500"
              />
              <span class="flex-1 text-left">{{ item.label }}</span>
              <ChevronRight class="h-3.5 w-3.5 shrink-0 text-slate-300" />
            </button>
          </div>
          <p
            v-if="filteredNav.length === 0"
            class="px-3 py-6 text-center text-xs text-slate-500"
          >
            No matches for “{{ paletteQuery }}”.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
