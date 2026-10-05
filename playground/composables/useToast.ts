export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  message: string
}

/**
 * Global toast queue. Every mutation reports its outcome through this, so the
 * user always gets feedback and never has to infer success from a list that
 * happened to change.
 */
export const useToast = () => {
  const toasts = useState<Toast[]>('toasts', () => [])

  const dismiss = (id: number) => {
    toasts.value = toasts.value.filter(toast => toast.id !== id)
  }

  const push = (tone: ToastTone, message: string, timeout = 4500) => {
    // Ids only need to be unique within the visible queue, and a counter is
    // cheaper and safer than a random id under SSR hydration.
    const id = Date.now() + toasts.value.length

    toasts.value = [...toasts.value, { id, tone, message }]

    if (import.meta.client)
      window.setTimeout(() => dismiss(id), timeout)

    return id
  }

  const success = (message: string) => push('success', message)
  const error = (message: string) => push('error', message, 6500)
  const info = (message: string) => push('info', message)

  return { toasts, push, success, error, info, dismiss }
}
