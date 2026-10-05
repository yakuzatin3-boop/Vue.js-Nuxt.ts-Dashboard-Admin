export default defineNuxtConfig({
  modules: ['../src/module', '@pinia/nuxt'],
  components: [
    // Chart and layout primitives live in `components/panel/`. Nuxt prefixes
    // nested component names with their directory by default, which would turn
    // them into `PanelPanel`, `PanelMetricCard`, ... Dropping the prefix keeps
    // call sites in templates readable.
    { path: '~/components', pathPrefix: false },
  ],
  devtools: { enabled: true },
  // No `css` entry on purpose. admin.css carries the `@theme` block, and Tailwind
  // only emits utilities for tokens inside its own compilation unit. It is
  // imported by the module's generated tailwind.css via `myModule.theme` below;
  // listing it here too would just bundle it twice.
  runtimeConfig: {
    // Private: only the Nitro server reads it, so it can name the API by its
    // Docker service name. Overridden by NUXT_API_BASE_SERVER.
    apiBaseServer: 'http://localhost:3001',
    public: {
      // Reaches the browser, so it has to name the host-published port.
      // 3001 rather than the API's own default of 3000, because Compose claims
      // 3000 for the admin container itself.
      apiBase: 'http://localhost:3001',
    },
  },
  compatibilityDate: 'latest',
  myModule: {
    // Imported into the module's generated tailwind.css, which is what makes
    // bg-rail, border-line, text-ink-subtle and friends resolve.
    theme: 'assets/css/admin.css',
  },
})
