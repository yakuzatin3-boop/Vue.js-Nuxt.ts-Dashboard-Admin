import type { Ref } from 'vue'

export interface ClientColumn<T> {
  key: string
  label: string
  /** Sort accessor. Omit to make the column unsortable. */
  sort?: (row: T) => string | number
  align?: 'left' | 'right'
}

/**
 * Search, sort and paginate a list the API returns in full.
 *
 * `/products`, `/brands`, `/categories`, `/customers`, `/users` and
 * `/inventory` have no pagination, search or sort parameters, so this runs
 * entirely in the browser. Rows are re-sliced through a derived ref, which
 * means the page's template stays reactive without any manual recompute.
 */
export const useClientTable = <T>(
  rows: Ref<T[] | undefined | null>,
  columns: ClientColumn<T>[],
  options: {
    pageSize?: number
    searchKeys?: ((row: T) => (string | number | null | undefined)[])
    /** Seeds the search box, so a deep link such as `/products?q=shirt` lands pre-filtered. */
    initialSearch?: string
  } = {},
) => {
  const pageSize = options.pageSize ?? 10
  const search = ref(options.initialSearch ?? '')
  const sortKey = ref<string | null>(null)
  const sortDirection = ref<'asc' | 'desc'>('asc')
  const page = ref(1)

  const column = computed(() => columns.find(item => item.key === sortKey.value))

  const searched = computed(() => {
    const term = search.value.trim().toLowerCase()
    const all = rows.value ?? []

    if (!term || !options.searchKeys)
      return all

    return all.filter(row =>
      options.searchKeys!(row).some(value => String(value ?? '').toLowerCase().includes(term)))
  })

  const sorted = computed(() => {
    const active = column.value
    const all = [...searched.value]

    if (!active?.sort)
      return all

    const direction = sortDirection.value === 'asc' ? 1 : -1

    return all.sort((a, b) => {
      const left = active.sort!(a)
      const right = active.sort!(b)

      // Numbers compare numerically; everything else compares as text so
      // "Product 10" does not sort before "Product 2".
      if (typeof left === 'number' && typeof right === 'number')
        return (left - right) * direction

      return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * direction
    })
  })

  const total = computed(() => sorted.value.length)
  const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
  const items = computed(() => {
    const start = (page.value - 1) * pageSize

    return sorted.value.slice(start, start + pageSize)
  })

  // Any change that shrinks the result set can strand the reader on a page that
  // no longer exists, so the position is clamped rather than left dangling.
  watch([search, sortKey, sortDirection], () => {
    page.value = 1
  })

  watch(pages, (count) => {
    if (page.value > count)
      page.value = count
  })

  const toggleSort = (key: string) => {
    if (sortKey.value === key) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'

      return
    }

    sortKey.value = key
    sortDirection.value = 'asc'
  }

  const sortState = (key: string) => {
    if (sortKey.value !== key)
      return 'none' as const

    return sortDirection.value === 'asc' ? 'ascending' as const : 'descending' as const
  }

  return {
    search,
    page,
    pageSize,
    sortKey,
    sortDirection,
    columns,
    items,
    total,
    pages,
    sorted,
    toggleSort,
    sortState,
  }
}
