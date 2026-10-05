export const useTokenCookie = () =>
  useCookie<string | null>('access-token', {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  })
