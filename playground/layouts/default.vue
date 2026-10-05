<script setup lang="ts">
const { isCollapsed } = useSidebar()
</script>

<template>
  <div class="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
    <AppSidebar />

    <div
      :class="[
        'flex min-h-screen flex-col transition-[padding] duration-300 ease-in-out',
        isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64',
      ]"
    >
      <AppHeader />

      <main class="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div class="mx-auto w-full max-w-[1600px]">
          <slot />
        </div>
      </main>
    </div>

    <ToastHost />
  </div>
</template>
