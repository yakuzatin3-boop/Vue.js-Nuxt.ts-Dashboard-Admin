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
import { readSseError, readSseStream } from '~/utils/sse'
import { toApiError } from '~/utils/api-error'

const STREAM_TIMEOUT_MS = 90_000

const WELCOME = 'Ask me anything about this store. Store questions come from the same live data the dashboard uses, so you can verify the numbers on the Analytics page — and anything else goes to the AI assistant.'

const welcomeReply = (): ChatReply => ({
  intent: 'help',
  headline: WELCOME,
  blocks: [],
  suggestions: ['How is the store doing?', 'What are my top 5 products?', 'What should I work on?', 'Give me ideas to sell more'],
})

export const useChartBot = async () => {
  const api = useApiClient()
  const config = useRuntimeConfig()
  const token = useTokenCookie()
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

  /**
   * The AI fallback. Everything the rule engine recognises keeps its verified,
   * chart-rendered answer; anything else is streamed from the same assistant the
   * Insights panel uses, seeded with the store context, so an open-ended
   * question gets a real answer instead of the "I only track..." shrug.
   */
  const aiReply = (): ChatReply => ({
    intent: 'ai',
    headline: '',
    blocks: [{ kind: 'markdown', text: '' }],
    suggestions: SUGGESTIONS.slice(0, 4).map(entry => entry.label),
  })

  /** The streaming markdown block of the assistant turn currently in flight. */
  const activeMarkdown = () => {
    const last = messages.value.at(-1)

    if (last?.role !== 'assistant' || last.reply?.intent !== 'ai')
      return null

    const block = last.reply.blocks.find(entry => entry.kind === 'markdown')

    return block && block.kind === 'markdown' ? block : null
  }

  const appendDelta = (text: string) => {
    const block = activeMarkdown()

    if (block)
      block.text += text
  }

  const finalizeAi = (reply: string) => {
    const block = activeMarkdown()

    if (block)
      block.text = reply
  }

  const failAi = (message: string) => {
    const last = messages.value.at(-1)

    const failure: ChatReply = {
      intent: 'ai',
      headline: 'I could not finish that answer.',
      blocks: [{ kind: 'note', tone: 'warn', text: message }],
      suggestions: SUGGESTIONS.slice(0, 4).map(entry => entry.label),
    }

    if (last?.role === 'assistant' && last.reply?.intent === 'ai')
      last.reply = failure
    else
      push({ role: 'assistant', text: failure.headline, reply: failure })
  }

  const askAi = async (question: string) => {
    push({ role: 'assistant', text: '', reply: aiReply() })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (token.value)
      headers.Authorization = `Bearer ${token.value}`

    try {
      const res = await fetch(`${config.public.apiBase}/admin/ai/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: question, context: { page: 'chart-bot' } }),
        signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
      })

      if (res.status === 401) {
        token.value = null

        if (import.meta.client && window.location.pathname !== '/login')
          void navigateTo('/login')

        throw new Error('Your session has expired. Please sign in again.')
      }

      if (!res.ok)
        throw await readSseError(res)

      if (!res.body)
        throw new Error('The assistant produced no response body.')

      await readSseStream(res.body, {
        onDelta: appendDelta,
        onDone: finalizeAi,
        onError: failAi,
      })
    }
    catch (caught) {
      const message = caught instanceof Error
        ? caught.name === 'TimeoutError'
          ? 'The assistant took too long to answer. Try again with a shorter question.'
          : caught.message
        : 'Something went wrong while generating the answer.'

      failAi(message)
    }
  }

  /**
   * Answers one question: deterministic when the router recognises the topic,
   * streamed from the AI assistant when it does not. The route is computed with
   * the catalogue in hand so a named product wins before the AI is consulted.
   */
  const respond = async (question: string, animate: boolean) => {
    const routed = routeQuestion(question, catalogue.value.products as Product[])

    if (routed.intent === 'unknown') {
      await askAi(question)

      return
    }

    // A short beat so the transition reads as the bot thinking rather than as
    // a button that silently stops working. The answer itself is synchronous.
    if (animate)
      await new Promise(resolve => setTimeout(resolve, 200))

    const reply = replyFor(question)

    push({ role: 'assistant', text: reply.headline, reply })
  }

  const ask = async (raw: string) => {
    const question = raw.trim()

    if (!question || thinking.value)
      return

    push({ role: 'user', text: question })
    thinking.value = true
    datasetError.value = null

    try {
      await ensureDatasets(routeQuestion(question).datasets)

      await respond(question, true)

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
      // Re-answers through the same router, so an AI answer is re-asked as an
      // AI answer rather than silently downgraded to the rule engine's shrug.
      await respond(lastQuestion.text, false)
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
