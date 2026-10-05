export default defineNuxtRouteMiddleware((to) => {
  const token = useTokenCookie()
  const isAuthenticated = Boolean(token.value)

  if (to.path === '/login') {
    if (isAuthenticated)
      return navigateTo('/')

    return
  }

  if (!isAuthenticated)
    return navigateTo('/login')
})
