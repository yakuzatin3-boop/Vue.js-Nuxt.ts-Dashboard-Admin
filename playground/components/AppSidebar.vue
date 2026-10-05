<script setup lang="ts">
import { LogOut, Store, X } from '@lucide/vue'
import { navigation } from '~/utils/navigation'
import { initials } from '~/utils/format'

// Collapsing is driven from AppHeader, which is the only control that works in
// both states: a footer button would be hidden exactly when it is needed.
const { isCollapsed, isMobileOpen, closeMobile } = useSidebar()
const { user, logout } = useAuth()
const route = useRoute()

const isLoggingOut = ref(false)

const signOut = async () => {
  isLoggingOut.value = true
  try {
    await logout()
  }
  finally {
    isLoggingOut.value = false
  }
}

// Exact match for the dashboard so "/" does not also light up every other route.
const isActive = (to: string) => {
  if (to === '/')
    return route.path === '/'

  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-200"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isMobileOpen"
      class="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
      @click="closeMobile"
    />
  </Transition>

  <aside
    :class="[
      'fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 text-slate-100 transition-[width,transform] duration-300 ease-in-out',
      // The collapsed width is a desktop-only affordance. On mobile the rail is
      // always a full-width drawer, otherwise a user who collapsed the sidebar
      // on a wide screen would be left with a 72px panel on their phone.
      isCollapsed ? 'w-64 lg:w-[72px]' : 'w-64',
      isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <div class="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800/80 px-4">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
        <Store class="h-[18px] w-[18px] text-white" />
      </span>

      <template v-if="!isCollapsed">
        <span class="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-slate-100">
          Ecommerce
        </span>

        <span class="shrink-0 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-400">
          v2.4
        </span>
      </template>

      <button
        type="button"
        class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-slate-100 lg:hidden"
        aria-label="Close navigation"
        @click="closeMobile"
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    <nav class="scrollbar-slim flex-1 overflow-y-auto px-3 py-4">
      <!--
        `v-if`, not `v-show`: the section heading and its bottom margin both
        disappear together. `v-show` would leave the margin behind and stack four
        empty gaps down the collapsed rail.
      -->
      <div
        v-for="section in navigation"
        :key="section.title"
        class="last:mb-0"
        :class="isCollapsed ? '' : 'mb-5'"
      >
        <p
          v-if="!isCollapsed"
          class="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase"
        >
          {{ section.title }}
        </p>

        <ul class="space-y-0.5">
          <li
            v-for="item in section.items"
            :key="item.to"
          >
            <NuxtLink
              :to="item.to"
              :title="isCollapsed ? item.label : undefined"
              :class="[
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isCollapsed ? 'justify-center' : '',
                // The active item is the only place in the rail that carries an
                // indigo tint, so the current page is unmistakable without
                // relying on the label text alone.
                isActive(item.to)
                  ? 'border border-indigo-500/20 bg-indigo-600/10 text-indigo-400 shadow-sm'
                  : 'border border-transparent text-slate-400 hover:bg-slate-800/30 hover:text-slate-100',
              ]"
              @click="closeMobile"
            >
              <component
                :is="item.icon"
                class="h-[18px] w-[18px] shrink-0"
                :class="isActive(item.to) ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'"
              />

              <span
                v-if="!isCollapsed"
                class="truncate"
              >{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <!--
      The footer keeps the account context in collapsed mode, where it is the
      only place it appears: the header hides the name and role below sm.
    -->
    <div class="shrink-0 border-t border-slate-800/80 p-4">
      <div
        class="flex items-center gap-3"
        :class="isCollapsed ? 'flex-col gap-2' : ''"
      >
        <div
          class="flex min-w-0 flex-1 items-center gap-3"
          :class="isCollapsed ? 'justify-center' : ''"
        >
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {{ initials(user?.name, user?.email?.[0]?.toUpperCase() ?? 'A') }}
          </span>

          <div
            v-if="!isCollapsed"
            class="min-w-0"
          >
            <p class="truncate text-sm font-medium text-slate-100">
              {{ user?.name ?? 'Admin' }}
            </p>
            <p class="truncate text-[11px] text-slate-500">
              {{ user?.email ?? 'admin@store.com' }}
            </p>
          </div>
        </div>

        <button
          type="button"
          class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800/30 hover:text-rose-400 disabled:opacity-60"
          :class="isCollapsed ? '' : 'ml-auto'"
          :aria-label="isLoggingOut ? 'Signing out' : 'Sign out'"
          :disabled="isLoggingOut"
          @click="signOut"
        >
          <LogOut
            v-if="!isLoggingOut"
            class="h-4 w-4"
          />
          <span
            v-else
            class="block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent"
          />
        </button>
      </div>
    </div>
  </aside>
</template>
