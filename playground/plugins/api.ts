import axios from 'axios'

import type { AuthProfile } from '~/types/api'
import { toApiError } from '~/utils/api-error'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const token = useTokenCookie()
  const user = useState<AuthProfile | null>('auth-user', () => null)

  // Two bases, because the API is reachable under two different names. The
  // browser must go through the published host port, while SSR runs inside the
  // container network where only the service name resolves. A single public
  // value cannot satisfy both.
  const baseURL = import.meta.server
    ? (config.apiBaseServer || config.public.apiBase)
    : config.public.apiBase

  const api = axios.create({
    baseURL,
    timeout: 15_000,
  })

  // The cookie is read per request rather than captured once, so a token set by
  // login() is picked up immediately and works during SSR too.
  api.interceptors.request.use((requestConfig) => {
    if (token.value) {
      requestConfig.headers.Authorization = `Bearer ${token.value}`
    }

    return requestConfig
  })

  api.interceptors.response.use(
    response => response,
    (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        token.value = null
        user.value = null

        // A rejected login lands here too; re-navigating would fight the form.
        if (import.meta.client && window.location.pathname !== '/login') {
          void navigateTo('/login')
        }
      }

      return Promise.reject(toApiError(error))
    },
  )

  return {
    provide: { api },
  }
})
