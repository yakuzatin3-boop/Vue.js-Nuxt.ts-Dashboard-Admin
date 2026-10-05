import type { Paginated } from '~/types/api'

/** The API caps `limit` at 100 and refuses anything larger. */
const MAX_LIMIT = 100

/**
 * Loads every page of a paginated admin endpoint into one array.
 *
 * `/admin/orders`, `/admin/payments` and `/admin/reviews` paginate but accept
 * no search or filter parameters, so filtering the full set in the browser is
 * the only way to make those tables searchable. This trades the server-side
 * paging for one flat list; the request count stays low because each page
 * already carries the maximum 100 rows.
 */
export const useAllPages = async <T>(key: string, path: string) => {
  const api = useApiClient()

  return useAsyncData<T[]>(
    key,
    async () => {
      const collected: T[] = []
      let page = 1
      let total: number

      do {
        const { data } = await api.get<Paginated<T>>(path, {
          params: { page, limit: MAX_LIMIT },
        })

        collected.push(...data.items)
        total = data.total
        page += 1

        // A short page means the last one has been read, even if the reported
        // `total` disagrees with what the endpoint actually returned.
        if (data.items.length < MAX_LIMIT)
          break
      } while (collected.length < total)

      return collected
    },
    { default: () => [] as T[] },
  )
}
