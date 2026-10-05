import type { AxiosError } from 'axios'

/**
 * Nest's exception filter answers with `{ statusCode, message }` where `message`
 * is a string for thrown exceptions and a string[] for ValidationPipe failures.
 * Flatten both into one readable string so pages only ever handle `Error`.
 */
export function toApiError(error: unknown): Error {
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<{
      statusCode?: number
      message?: string | string[]
      error?: string
    }>

    const data = axiosError.response?.data
    const raw = data?.message ?? data?.error

    const message = Array.isArray(raw) ? raw.join(', ') : (raw ?? axiosError.message)

    if (axiosError.response?.status === 401) {
      return new Error(message || 'Your session has expired. Please sign in again.')
    }

    if (!axiosError.response) {
      return new Error(
        `Cannot reach the API at ${axiosError.config?.baseURL ?? 'the server'}. Is the backend running?`,
      )
    }

    return new Error(message || 'Something went wrong.')
  }

  return error instanceof Error ? error : new Error(String(error))
}
