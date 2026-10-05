/**
 * Conversation state for the Chart Bot.
 *
 * Two decisions live here rather than in the page:
 *
 * 1. Datasets load on demand. `/admin/stats` and `/admin/analytics` are fetched
 *    with the same `useAsyncData` keys the Dashboard and Analytics pages use, so
 *    navigating here after visiting them costs no extra requests. Products,
 *    categories, inventory and reviews are fetched the first time a question
 *    actually needs them: a "hello" should not pay for the catalogue.
 * 2. Replies are computed, not fetched. Every answer is derived from the payload
 *    the dashboard already uses, so the bot cannot disagree with the charts, and
 *    "refresh" is one call instead of a per-question round trip.
 */
import type { AdminStats, Analytics, Category, Inventory, Product, Review } from '~/types/api'
import type { ChatData, ChatDataset, ChatMessage, ChatReply } from '~/types/chat'
import { answerQuestion, CHAT_MONTHS, routeQuestion, SUGGESTIONS } from '~/utils/chatbot'
import { toApiError } from '~/utils/api-error'

const WELCOME = 'Ask me anything about this store. I read the same live data the dashboard does, so every number I give you is one you can verify on the Analytics page.'

const welcomeReply = (): ChatReply => ({
  intent: 'help',
  headline: WELCOME,
  blocks: [],
  suggestions: SUGGESTIONS.slice(0, 4).map(entry => entry.label),
})

export const useChartBot = async () => {
  const api = useApiClient()
  const toast = useToast()

  let nextId = 0

  const messages = ref<ChatMessage[]>([
    { id: nextId++, role: 'assistant', text: WELCOME, reply: welcomeReply(), at: Date.now() },
  ])

  const thinking = ref(false)

  // Shared keys with the dashboard and analytics pages, so the payload cache
  // serves this page without a second round trip after navigation.
  //
  // Deliberately not awaited: this composable is itself async, so an `await`
  // here would resume after the page's setup() had returned and `useAsyncData`
  // would lose the Nuxt instance context (NUXT_E1001). Unawaited, both requests
  // are still registered on the app's async-data queue, so SSR waits for them
  // before rendering and the payload is filled in either way.
  const { data: stats, pending, error, refresh } = useAsyncData<AdminStats>(
    'admin-stats',
    () => api.get('/admin/stats').then(r => r.data),
  )

  const { data: analytics, refresh: refreshAnalytics } = useAsyncData<Analytics>(
    'admin-analytics',
    () => api.get('/admin/analytics', { params: { months: CHAT_MONTHS } }).then(r => r.data),
  )

  /** Optional datasets, fetched at most once and only when a question needs them. */
  const catalogue = useState<Record<ChatDataset, unknown[]>>('chart-bot-datasets', () => ({
    products: [],
    categories: [],
    inventory: [],
    reviews: [],
  }))

  const DATASET_ENDPOINTS: Record<ChatDataset, string> = {
    products: '/products',
    categories: '/categories',
    inventory: '/inventory',
    reviews: '/admin/reviews',
  }

  const datasetError = ref<string | null>(null)

  /**
   * Fetches any dataset the routed intent needs that is not already held.
   *
   * A failure is not fatal: the answer is still produced from the aggregates, it
   * just has less detail. A flaky catalogue endpoint degrades one reply instead
   * of taking the bot down.
   */
  const ensureDatasets = async (datasets: ChatDataset[]) => {
    const missing = datasets.filter(dataset => !catalogue.value[dataset]?.length)

    if (!missing.length) {
      datasetError.value = null

      return
    }

    const results = await Promise.allSettled(
      missing.map(async (dataset) => {
        const { data } = await api.get(DATASET_ENDPOINTS[dataset], { params: { limit: 100 } })

        return [dataset, data] as const
      }),
    )

    const failures: string[] = []

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const [dataset, rows] = result.value

        catalogue.value = {
          ...catalogue.value,
          [dataset]: Array.isArray(rows) ? rows : (rows as { items?: unknown[] })?.items ?? [],
        }
      }
      else {
        failures.push(toApiError(result.reason).message)
      }
    }

    datasetError.value = failures.length
      ? `Part of the catalogue could not be loaded: ${failures.join(' ')}`
      : null
  }

  const snapshot = (): ChatData => ({
    stats: stats.value ?? null,
    analytics: analytics.value ?? null,
    products: catalogue.value.products as Product[],
    categories: catalogue.value.categories as Category[],
    inventory: catalogue.value.inventory as Inventory[],
    reviews: catalogue.value.reviews as Review[],
  })

  const push = (message: Omit<ChatMessage, 'id' | 'at'>) => {
    messages.value = [...messages.value, { ...message, id: nextId++, at: Date.now() }]
  }

  const replyFor = (question: string): ChatReply => answerQuestion(question, snapshot())

  const ask = async (raw: string) => {
    const question = raw.trim()

    if (!question || thinking.value)
      return

    push({ role: 'user', text: question })
    thinking.value = true
    datasetError.value = null

    try {
      await ensureDatasets(routeQuestion(question).datasets)

      // A short beat so the transition reads as the bot thinking rather than as
      // a button that silently stops working. The answer itself is synchronous.
      await new Promise(resolve => setTimeout(resolve, 200))

      const reply = replyFor(question)

      push({ role: 'assistant', text: reply.headline, reply })

      if (datasetError.value)
        toast.info(datasetError.value)
    }
    catch (caught) {
      push({
        role: 'assistant',
        text: 'Something went wrong while answering that.',
        reply: {
          intent: 'unknown',
          headline: 'I could not finish that answer.',
          blocks: [{ kind: 'note', tone: 'warn', text: toApiError(caught).message }],
          suggestions: ['How is the store doing?', 'Show me the revenue trend'],
        },
      })
    }
    finally {
      thinking.value = false
    }
  }

  const clear = () => {
    messages.value = [{ id: nextId++, role: 'assistant', text: WELCOME, reply: welcomeReply(), at: Date.now() }]
  }

  /** The latest set of follow ups, which is what the suggestion strip renders. */
  const suggestions = computed(() => {
    for (let index = messages.value.length - 1; index >= 0; index--) {
      const message = messages.value[index]

      if (message?.role === 'assistant' && message.reply?.suggestions.length)
        return message.reply.suggestions
    }

    return SUGGESTIONS.slice(0, 4).map(entry => entry.label)
  })

  /**
   * Refetches the aggregates and re-answers the last question against them, so
   * a refresh is visibly a refresh rather than a silent background reload.
   */
  const refreshData = async () => {
    const results = await Promise.allSettled([refresh(), refreshAnalytics()])
    const failed = results.some(result => result.status === 'rejected')

    if (failed) {
      toast.error('Could not refresh the store data. Try again in a moment.')

      return
    }

    const lastQuestion = [...messages.value].reverse().find(message => message.role === 'user')

    if (!lastQuestion) {
      toast.success('Store data refreshed.')

      return
    }

    thinking.value = true

    try {
      const reply = replyFor(lastQuestion.text)

      push({ role: 'assistant', text: reply.headline, reply })
      toast.success('Store data refreshed and the last answer recalculated.')
    }
    finally {
      thinking.value = false
    }
  }

  const loadError = computed(() => (error.value ? toApiError(error.value).message : null))

  return {
    messages,
    suggestions,
    thinking,
    pending,
    stats,
    analytics,
    loadError,
    ask,
    clear,
    refresh: refreshData,
  }
}
