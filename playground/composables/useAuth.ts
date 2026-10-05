import type { AxiosInstance } from 'axios'

import type { AuthProfile, LoginResponse } from '~/types/api'

export const useApiClient = (): AxiosInstance => useNuxtApp().$api

export const useAuth = () => {
  const token = useTokenCookie()
  const user = useState<AuthProfile | null>('auth-user', () => null)

  const isAuthenticated = computed(() => Boolean(token.value))
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  const login = async (email: string, password: string) => {
    const api = useApiClient()

    const { data } = await api.post<LoginResponse>('/auth/login', { email, password })

    token.value = data.accessToken
    user.value = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      isActive: true,
    }
  }

  const fetchProfile = async () => {
    const api = useApiClient()
    const { data } = await api.get<AuthProfile>('/auth/profile')
    user.value = data
    return data
  }

  const logout = async () => {
    token.value = null
    user.value = null
    await navigateTo('/login')
  }

  const clearSession = () => {
    token.value = null
    user.value = null
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    fetchProfile,
    clearSession,
  }
}
