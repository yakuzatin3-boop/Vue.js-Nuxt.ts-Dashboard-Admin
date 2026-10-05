<script setup lang="ts">
import {
  Bell,
  ChevronDown,
  Download,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  User,
} from '@lucide/vue'
import type { Component } from 'vue'

import type { AdminStats } from '~/types/api'
import { navigation } from '~/utils/navigation'
import { initials } from '~/utils/format'

const { isCollapsed, toggleCollapsed, openMobile } = useSidebar()
const { user, logout, fetchProfile } = useAuth()
const route = useRoute()

const isProfileOpen = ref(false)
const isLoggingOut = ref(false)
const profileRef = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const searchTerm = ref('')

/*
 * Breadcrumb. Derived from the same table the sidebar renders, so a new page
 * cannot appear in one and be missing from the other.
 */
const currentItem = computed(() =>
  navigation
    .flatMap(section => section.items)
    .find(item => item.to === route.path || route.path.startsWith(`${item.to}/`)))

/*
 * Primary action. The brief calls for a create control on catalog pages and an
 * export trigger elsewhere; deriving it from the route keeps every page from
 * having to declare one.
 */
interface HeaderAction {
  label: string
  icon: Component
  to?: string
}

const CREATE_ACTIONS: Record<string, string> = {
  '/products': 'Add Product',
  '/categories': 'Add Category',
  '/brands': 'Add Brand',
  '/inventory': 'Add Stock',
  '/customers': 'Add Customer',
  '/users': 'Add User',
}

const action = computed<HeaderAction>(() => {
  const create = CREATE_ACTIONS[route.path]

  return create
    ? { label: create, icon: Plus, to: `${route.path}?create=1` }
    : { label: 'Export', icon: Download }
})

/*
 * Bell badge. Reuses the dashboard's `admin-stats` payload rather than issuing
 * a second request: `useAsyncData` keys its result, so both components read the
 * same fetch. Anything actionable to the operator shows up here.
 */
const { data: stats } = useAsyncData<AdminStats>('admin-stats', () => useApiClient().get('/admin/stats').then(r => r.data), {
  // The header is chrome: a failure here must not take the page down with it.
  default: () => undefined,
})

const alertCount = computed(() => {
  const pending = stats.value?.pendingOrders ?? 0
  const lowStock = stats.value?.lowStockCount ?? 0

  return pending + lowStock
})

const submitSearch = () => {
  const term = searchTerm.value.trim()

  void navigateTo(term ? { path: '/products', query: { q: term } } : '/products')
}

// Cmd/Ctrl+K focuses the box from anywhere in the app, which is what the badge
// in the field promises. Suppressed while typing in another field so it does not
// steal the caret mid-sentence.
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape')
    isProfileOpen.value = false

  if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    searchInput.value?.focus()
    searchInput.value?.select()
  }
}

const onClickOutside = (event: MouseEvent) => {
  if (profileRef.value && !profileRef.value.contains(event.target as Node))
    isProfileOpen.value = false
}

// The login response is enough to render the header, so this is a silent
// refresh: if the token is stale the interceptor already redirects to /login.
onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)

  if (user.value)
    void fetchProfile().catch(() => {})
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})

const signOut = async () => {
  isLoggingOut.value = true
  try {
    await logout()
  }
  finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <header class="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-slate-800/80 bg-slate-950/80 px-4 backdrop-blur-md sm:px-6">
    <button
      type="button"
      class="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-slate-100 lg:hidden"
      aria-label="Open navigation"
      @click="openMobile"
    >
      <Menu class="h-5 w-5" />
    </button>

    <button
      type="button"
      class="hidden rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-slate-100 lg:inline-flex"
      :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="toggleCollapsed"
    >
      <PanelLeftOpen
        v-if="isCollapsed"
        class="h-5 w-5"
      />
      <PanelLeftClose
        v-else
        class="h-5 w-5"
      />
    </button>

    <nav
      aria-label="Breadcrumb"
      class="hidden min-w-0 items-center gap-2 md:flex"
    >
      <span class="shrink-0 text-xs font-medium text-slate-500">Ecommerce</span>
      <span class="text-xs text-slate-700">/</span>
      <span class="truncate text-xs font-semibold text-slate-100">
        {{ currentItem?.label ?? 'Dashboard' }}
      </span>
    </nav>

    <form
      class="relative ml-auto hidden w-full max-w-xs md:block"
      role="search"
      @submit.prevent="submitSearch"
    >
      <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        ref="searchInput"
        v-model="searchTerm"
        type="search"
        placeholder="Search products…"
        aria-label="Search products"
        class="w-full rounded-lg border border-slate-800 bg-slate-900/60 py-2 pr-16 pl-9 text-xs text-slate-100 transition-colors placeholder:text-slate-500 hover:border-slate-700/80 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
      >
      <kbd class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">
        ⌘ K
      </kbd>
    </form>

    <div class="ml-auto flex items-center gap-1 md:ml-3 sm:gap-2">
      <button
        type="button"
        class="hidden shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700 sm:inline-flex"
        @click="action.to ? navigateTo(action.to) : undefined"
      >
        <component
          :is="action.icon"
          class="h-4 w-4"
        />
        {{ action.label }}
      </button>

      <button
        type="button"
        class="relative rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-slate-100"
        aria-label="Notifications"
      >
        <Bell class="h-5 w-5" />
        <span
          v-if="alertCount > 0"
          class="nums absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[10px] font-semibold text-white ring-2 ring-slate-950"
        >{{ alertCount > 99 ? '99+' : alertCount }}</span>
        <span
          v-else
          class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-slate-500 ring-2 ring-slate-950"
        />
      </button>

      <div
        ref="profileRef"
        class="relative"
      >
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg p-1.5 text-sm transition-colors hover:bg-slate-800/30"
          :aria-expanded="isProfileOpen"
          aria-haspopup="menu"
          @click="isProfileOpen = !isProfileOpen"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {{ initials(user?.name, user?.email?.[0]?.toUpperCase() ?? 'A') }}
          </span>
          <span
            v-if="user"
            class="hidden text-left sm:block"
          >
            <span class="block max-w-[10rem] truncate text-sm font-medium leading-tight text-slate-100">
              {{ user.name ?? user.email }}
            </span>
            <span class="block text-[11px] leading-tight text-slate-500">
              {{ user.role }}
            </span>
          </span>
          <ChevronDown class="hidden h-4 w-4 text-slate-500 sm:block" />
        </button>

        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="isProfileOpen"
            role="menu"
            class="absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-xl border border-slate-800 bg-slate-900 py-1 shadow-raised"
          >
            <div class="border-b border-slate-800 px-4 py-2.5">
              <p class="truncate text-sm font-medium text-slate-100">
                {{ user?.name ?? '—' }}
              </p>
              <p class="truncate text-[11px] text-slate-500">
                {{ user?.email }}
              </p>
            </div>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800/30 hover:text-slate-100"
              @click="isProfileOpen = false"
            >
              <User class="h-4 w-4" /> Profile
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-60"
              :disabled="isLoggingOut"
              @click="signOut"
            >
              <LoaderCircle
                v-if="isLoggingOut"
                class="h-4 w-4 animate-spin"
              />
              <LogOut
                v-else
                class="h-4 w-4"
              />
              {{ isLoggingOut ? 'Signing out…' : 'Sign out' }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
