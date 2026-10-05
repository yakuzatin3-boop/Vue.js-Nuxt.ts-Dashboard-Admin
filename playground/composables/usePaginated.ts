import type { AxiosInstance } from 'axios'

import type { Paginated } from '~/types/api'

export type PageFetcher<T> = (
  params: { page: number, limit: number },
  api: AxiosInstance,
) => Promise<Paginated<T>>

export const usePaginated = async <T>(
  key: string,
  fetcher: PageFetcher<T>,
  limit = 10,
) => {
  const page = ref(1)
  const api = useApiClient()

  const {
    data,
    pending,
    error,
    refresh,
  } = await useAsyncData(key, () => fetcher({ page: page.value, limit }, api), {
    watch: [page],
  })

  const items = computed(() => data.value?.items ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const pages = computed(() => data.value?.pages ?? 0)

  const hasPrevious = computed(() => page.value > 1)
  const hasNext = computed(() => page.value < pages.value)

  const previous = () => {
    if (hasPrevious.value)
      page.value -= 1
  }

  const next = () => {
    if (hasNext.value)
      page.value += 1
  }

  return {
    items,
    total,
    pages,
    page,
    pending,
    error,
    refresh,
    hasPrevious,
    hasNext,
    previous,
    next,
  }
}
