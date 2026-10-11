export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'admin-theme'

/**
 * Resolves the theme for a first visit: the stored choice wins, otherwise the
 * OS preference via `prefers-color-scheme`, otherwise dark (the theme the
 * admin was designed in). The inline head script in nuxt.config runs the same
 * resolution before first paint, so there is no flash; this composable only
 * keeps the reactive `mode` (which drives the toggle icon) in sync with it.
 */
const resolveInitialMode = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored === 'dark' || stored === 'light')
      return stored
  }
  catch {
    // Private mode / storage disabled: fall through to the system preference.
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export const useTheme = () => {
  // SSR renders the dark markup by default; the class pair on every element is
  // static, so appearance is driven entirely by `html.dark` (set pre-paint by
  // the head script). This state only tracks what the toggle should show, and
  // is corrected after hydration, which avoids a hydration mismatch.
  const mode = useState<ThemeMode>('theme-mode', () => 'dark')

  const apply = (next: ThemeMode) => {
    mode.value = next

    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', next === 'dark')

      try {
        localStorage.setItem(STORAGE_KEY, next)
      }
      catch {
        // Storage may be unavailable; the session still switches modes.
      }
    }
  }

  const toggle = () => apply(mode.value === 'dark' ? 'light' : 'dark')

  if (import.meta.client) {
    onMounted(() => {
      mode.value = resolveInitialMode()
      document.documentElement.classList.toggle('dark', mode.value === 'dark')
    })
  }

  return { mode, toggle, apply }
}
