import { toApiError } from '~/utils/api-error'

/**
 * Runs a mutation, reports the outcome through the toast queue, and refetches
 * the list. Pages never write this try/catch themselves, which is why every
 * create/update/delete in the dashboard ends up with the same error handling.
 */
export const useCrud = (label: string, refresh: () => unknown | Promise<unknown>) => {
  const saving = ref(false)
  const error = ref<string | null>(null)
  const toast = useToast()

  const run = async (
    task: () => Promise<unknown>,
    successMessage: string,
  ): Promise<boolean> => {
    saving.value = true
    error.value = null

    try {
      await task()
      // Refetch before the toast so a failed reload is reported too, otherwise
      // the user is told it worked while the table still shows the old data.
      await refresh()
      toast.success(successMessage)

      return true
    }
    catch (caught) {
      const message = toApiError(caught).message

      error.value = message
      toast.error(message)

      return false
    }
    finally {
      saving.value = false
    }
  }

  return {
    saving: readonly(saving),
    error,
    clearError: () => {
      error.value = null
    },
    create: (task: () => Promise<unknown>, message?: string) =>
      run(task, message ?? `${label} created.`),
    update: (task: () => Promise<unknown>, message?: string) =>
      run(task, message ?? `${label} updated.`),
    remove: (task: () => Promise<unknown>, message?: string) =>
      run(task, message ?? `${label} deleted.`),
  }
}
