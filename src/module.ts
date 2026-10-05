import { resolve } from 'node:path'
import { defineNuxtModule, addPlugin, addTemplate, createResolver } from '@nuxt/kit'
import tailwindcss from '@tailwindcss/vite'

export interface ModuleOptions {
  /**
   * Path to a stylesheet holding the `@theme` block. It is imported into the
   * generated Tailwind entry rather than listed in `css`, so its tokens
   * produce utility classes.
   */
  theme?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'my-module',
    configKey: 'myModule',
  },
  defaults: {},
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Do not add the extension since the `.ts` will be transpiled to `.mjs` after `npm run prepack`
    addPlugin(resolver.resolve('./runtime/plugin'))

    nuxt.hook('vite:extendConfig', (config) => {
      // The hook receives a readonly config, so the plugin list is replaced
      // through Object.assign instead of being assigned to directly.
      const plugins = config.plugins ? [...config.plugins, tailwindcss()] : [tailwindcss()]

      Object.assign(config, { plugins })
    })

    // The generated file is the single Tailwind entry point. Anything holding
    // `@theme` has to be imported from here rather than added to `css`
    // separately: Tailwind generates utilities per compilation unit, so a
    // `@theme` block in a standalone stylesheet defines the custom properties
    // but emits no `.bg-*`/`.text-*` utilities for them.
    // Tailwind resolves `@import` paths itself rather than through Vite's
    // resolver, so a `~` alias would not be understood here. An absolute path
    // works in both dev and the production build.
    const themePath = options.theme
      ? resolve(nuxt.options.srcDir, options.theme.replace(/^[~@]\//, ''))
      : undefined

    const { dst: cssTemplate } = addTemplate({
      filename: 'tailwind.css',
      write: true,
      getContents: () => [
        '@import "tailwindcss";',
        `@source "${nuxt.options.srcDir}";`,
        ...(themePath ? [`@import "${themePath}";`] : []),
        '',
      ].join('\n'),
    })

    nuxt.options.css = nuxt.options.css || []
    nuxt.options.css.unshift(cssTemplate)
  },
})
