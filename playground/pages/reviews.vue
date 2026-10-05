<script setup lang="ts">
import { RefreshCw, Star, Trash2 } from '@lucide/vue'

import type { Review } from '~/types/api'
import type { ClientColumn } from '~/composables/useClientTable'
import { formatDate, formatRelative, initials } from '~/utils/format'

useHead({ title: 'Reviews' })

const api = useApiClient()

const { data: reviews, pending, error, refresh } = await useAllPages<Review>(
  'admin-reviews',
  '/admin/reviews',
)

const COLUMNS: ClientColumn<Review>[] = [
  { key: 'product', label: 'Product', sort: row => row.product?.name ?? '' },
  { key: 'customer', label: 'Customer', sort: row => row.user?.name ?? row.user?.email ?? '' },
  { key: 'rating', label: 'Rating', align: 'right', sort: row => row.rating },
  { key: 'comment', label: 'Comment' },
  { key: 'posted', label: 'Posted', sort: row => row.createdAt },
]

const ratingFilter = ref('')

/** The star facet narrows the source list before the table sees it, so search and paging stay consistent with it. */
const scopedReviews = computed(() => {
  const all = reviews.value ?? []

  if (ratingFilter.value === 'low')
    return all.filter(review => review.rating <= 2)
  if (ratingFilter.value === 'high')
    return all.filter(review => review.rating >= 4)

  return all
})

const {
  search,
  items,
  total,
  pages,
  page,
  sortState,
  toggleSort,
} = useClientTable(scopedReviews, COLUMNS, {
  pageSize: 15,
  searchKeys: row => [row.product?.name, row.user?.name, row.user?.email, row.comment, row.rating],
})

const averageRating = computed(() => {
  if (!reviews.value?.length)
    return null

  const sum = reviews.value.reduce((total_, review) => total_ + review.rating, 0)

  return sum / reviews.value.length
})

const needsAttention = computed(
  () => (reviews.value ?? []).filter(review => review.rating <= 2).length,
)

const { error: saveError, remove } = useCrud('Review', refresh)

const removalTarget = ref<Review | null>(null)
const removing = ref(false)
const removeError = ref<string | null>(null)

const confirmRemove = async () => {
  const target = removalTarget.value

  if (!target)
    return

  removing.value = true
  removeError.value = null

  const ok = await remove(() => api.delete(`/reviews/${target.id}`), 'Review deleted.')

  removing.value = false

  if (ok)
    removalTarget.value = null
  else
    removeError.value = saveError.value
}
</script>

<template>
  <PageHeader
    title="Reviews"
    description="Moderate customer product reviews."
    :icon="Star"
  >
    <template #actions>
      <Button
        :icon="RefreshCw"
        :loading="pending"
        @click="refresh()"
      >
        Refresh
      </Button>
    </template>

    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 shadow-card">
          <p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Total reviews
          </p>
          <p class="nums mt-1 text-xl font-semibold text-slate-100">
            {{ reviews?.length ?? 0 }}
          </p>
        </div>
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 shadow-card">
          <p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Average rating
          </p>
          <p class="nums mt-1 text-xl font-semibold text-slate-100">
            {{ averageRating === null ? '—' : averageRating.toFixed(2) }}
          </p>
        </div>
        <div
          class="rounded-xl border px-4 py-3 shadow-card"
          :class="needsAttention ? 'border-amber-500/20 bg-amber-500/10' : 'border-slate-800/80 bg-slate-900/60'"
        >
          <p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Rated 1–2 stars
          </p>
          <p
            class="nums mt-1 text-xl font-semibold"
            :class="needsAttention ? 'text-amber-400' : 'text-slate-100'"
          >
            {{ needsAttention }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="ratingFilter === '' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400' : 'border-slate-800/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800/30'"
            @click="ratingFilter = ''"
          >
            All
          </button>
          <button
            v-for="option in [
              { value: 'low', label: '1–2 stars' },
              { value: 'high', label: '4–5 stars' },
            ]"
            :key="option.value"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="ratingFilter === option.value ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400' : 'border-slate-800/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800/30'"
            @click="ratingFilter = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <input
          v-model="search"
          type="search"
          placeholder="Filter by product, customer or comment…"
          class="w-full max-w-xs rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20"
        >
      </div>

      <DataState
        :pending="pending"
        :error="error"
        :empty="total === 0"
        :empty-text="search || ratingFilter ? 'No reviews match your filters.' : 'No reviews yet.'"
        @refresh="refresh"
      >
        <div class="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-card">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-800/80 bg-slate-950/50 text-[11px] tracking-wider text-slate-400 uppercase">
                <tr>
                  <SortableTh
                    v-for="column in COLUMNS"
                    :key="column.key"
                    :label="column.label"
                    :sort-key="column.sort ? column.key : null"
                    :state="sortState(column.key)"
                    :align="column.align"
                    @sort="toggleSort(column.key)"
                  />
                  <th class="px-4 py-3" />
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/80">
                <tr
                  v-for="review in items"
                  :key="review.id"
                  class="align-top hover:bg-slate-800/30"
                >
                  <td class="px-4 py-3 font-medium text-slate-100">
                    {{ review.product?.name ?? `#${review.productId}` }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                        {{ initials(review.user?.name, 'U') }}
                      </span>
                      <div class="min-w-0">
                        <p class="truncate text-slate-100">
                          {{ review.user?.name ?? '—' }}
                        </p>
                        <p class="truncate text-xs text-slate-400">
                          {{ review.user?.email }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <span class="inline-flex items-center gap-0.5 text-amber-400">
                      <Star
                        v-for="n in 5"
                        :key="n"
                        class="h-3.5 w-3.5"
                        :class="n <= review.rating ? 'fill-current' : 'text-slate-700'"
                      />
                    </span>
                  </td>
                  <td class="max-w-md px-4 py-3 text-slate-300">
                    {{ review.comment ?? '—' }}
                  </td>
                  <td
                    class="px-4 py-3 text-slate-300"
                    :title="formatDate(review.createdAt)"
                  >
                    {{ formatRelative(review.createdAt) }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end">
                      <button
                        type="button"
                        :aria-label="`Delete review of ${review.product?.name ?? review.productId}`"
                        class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                        @click="removalTarget = review"
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <TablePagination
            :page="page"
            :pages="pages"
            :total="total"
            unit="reviews"
            @previous="page -= 1"
            @next="page += 1"
          />
        </div>
      </DataState>
    </div>

    <ConfirmDialog
      :open="removalTarget !== null"
      title="Delete review"
      :message="`This removes the ${removalTarget?.rating}-star review of “${removalTarget?.product?.name ?? ''}”. The product's average rating is recalculated. This cannot be undone.`"
      :busy="removing"
      :error="removeError"
      confirm-label="Delete review"
      @confirm="confirmRemove"
      @close="removalTarget = null"
    />
  </PageHeader>
</template>
