/**
 * Conversation state for the Admin Insights Assistant.
 *
 * Lives as a module-level `useState` store rather than a Pinia store on purpose:
 * the launcher sits in the default layout, so it has to survive page changes,
 * and the admin container mounts only a fixed set of directories into the Nuxt
 * dev server — a new `stores/` folder would not even be visible there.
 *
 * Streaming uses the raw `fetch` SSE endpoint (`/admin/ai/chat/stream`) instead
 * of the axios client, because axios has no first-class SSE support and the
 * Abstraction-free route reads like a plain event loop.
 */
import type {
  AiInsightsContext,
  AiInsightsPreset,
  InsightsTurn,
} from '~/types/ai-insights'
import {
  INSIGHTS_DEFAULT_CHART_QUESTION,
  INSIGHTS_WELCOME,
} from '~/types/ai-insights'

const STREAM_TIMEOUT_MS = 90_000

// Module-scoped so every `useAiInsights()` call (layout + pages) shares one
// counter; a per-call `nextId` would hand out the same ids twice. The welcome
// turn is the only message rendered during SSR and it always lands on id 1.
let nextId = 0

export const useAiInsights = () => {
  const config = useRuntimeConfig()
  const token = useTokenCookie()
  const user = useState<{ role?: string } | null>('auth-user', () => null)

  const open = useState<boolean>('ai-insights-open', () => false)

  const welcomeTurn = (): InsightsTurn => ({
    id: ++nextId,
    role: 'assistant',
    text: INSIGHTS_WELCOME,
    at: Date.now(),
  })

  const messages = useState<InsightsTurn[]>('ai-insights-messages', () => [
    welcomeTurn(),
  ])

  const thinking = useState<boolean>('ai-insights-thinking', () => false)
  const conversationId = useState<string | null>('ai-insights-conversation', () => null)

  const chartContext = useState<AiInsightsContext | null>(
    'ai-insights-chart-context',
    () => null,
  )

  const lastUserTurn = computed(() =>
    [...messages.value].reverse().find(turn => turn.role === 'user'),
  )

  const lastAssistantText = computed(() => {
    for (let index = messages.value.length - 1; index >= 0; index--) {
      const turn = messages.value[index]

      if (turn.role === 'assistant' && turn.text.trim() && !turn.error)
        return turn.text
    }

    return ''
  })

  const hasHistory = computed(() => {
    const last = messages.value.at(-1)

    return last !== undefined && last.role === 'user' && !thinking.value
  })

  const toggle = () => {
    open.value = !open.value
  }

  const openWithChart = (context: AiInsightsContext) => {
    chartContext.value = context
    open.value = true
  }

  /** Drops the pending chart context without closing the panel or the chat. */
  const clearChartContext = () => {
    chartContext.value = null
  }

  const pushUser = (text: string) => {
    messages.value = [...messages.value, { id: ++nextId, role: 'user', text, at: Date.now() }]
  }

  const pushAssistant = (text: string, error = false) => {
    messages.value = [...messages.value, {
      id: ++nextId,
      role: 'assistant',
      text,
      at: Date.now(),
      error,
    }]
  }

  const failSession = () => {
    token.value = null
    user.value = null

    if (import.meta.client && window.location.pathname !== '/login')
      void navigateTo('/login')
  }

  const readSseError = async (res: Response): Promise<Error> => {
    const raw = await res.text().catch(() => '')

    const data = raw
      ? (JSON.parse(raw) as { message?: string | string[] }).message
      : undefined
    const message = Array.isArray(data) ? data.join(', ') : (data ?? `Request failed (${res.status})`)

    return new Error(message)
  }

  /** Appends a `delta` token to the running assistant turn. */
  const appendToken = (text: string) => {
    const last = messages.value.at(-1)

    if (last?.role === 'assistant')
      last.text += text
  }

  const finalizeTurn = (reply: string) => {
    const last = messages.value.at(-1)

    // Streaming pushed deltas already; the final payload is authoritative, so
    // the turn ends exactly as the server persisted it.
    if (last?.role === 'assistant')
      last.text = reply
  }

  const failTurn = (message: string) => {
    const last = messages.value.at(-1)

    if (last?.role === 'assistant') {
      last.text = message
      last.error = true
    }
    else {
      pushAssistant(message, true)
    }
  }

  const send = async (raw: string, explicitContext?: AiInsightsContext) => {
    if (thinking.value)
      return

    const context = explicitContext ?? chartContext.value ?? undefined

    chartContext.value = null

    const question = raw.trim() || (context ? INSIGHTS_DEFAULT_CHART_QUESTION : '')

    if (!question)
      return

    pushUser(question)
    pushAssistant('')
    thinking.value = true

    const baseURL = config.public.apiBase
    const contextPayload = context
      ? {
          page: context.page,
          dateRange: context.dateRange,
          chartId: context.chartId,
          chartTitle: context.chartTitle,
          chartData: context.chartData,
        }
      : undefined
    const body = {
      message: question,
      conversationId: conversationId.value ?? undefined,
      context: contextPayload,
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      if (token.value)
        headers.Authorization = `Bearer ${token.value}`

      const res = await fetch(`${baseURL}/admin/ai/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
      })

      if (res.status === 401) {
        failSession()

        throw new Error('Your session has expired. Please sign in again.')
      }

      if (!res.ok) {
        throw await readSseError(res)
      }

      if (!res.body) {
        throw new Error('The stream produced no response body.')
      }

      await readStream(res.body, {
        onDelta: text => appendToken(text),
        onDone: reply => finalizeTurn(reply),
        onError: message => failTurn(message),
      })
    }
    catch (caught) {
      const message = caught instanceof Error
        ? caught.name === 'TimeoutError'
          ? 'The assistant took too long to answer. Try again with a shorter question.'
          : caught.message
        : 'Something went wrong while generating the answer.'

      failTurn(message)
    }
    finally {
      thinking.value = false
    }
  }

  const sendPreset = (preset: AiInsightsPreset) => {
    void send(preset.question)
  }

  const clear = () => {
    messages.value = [welcomeTurn()]
    conversationId.value = null
    chartContext.value = null
  }

  /** Starts a fresh conversation with the previous question. */
  const retry = () => {
    const question = lastUserTurn.value?.text

    if (!question)
      return

    clear()
    void send(question)
  }

  const copyLastAnswer = async () => {
    if (!lastAssistantText.value)
      return

    if (import.meta.client) {
      await navigator.clipboard?.writeText(lastAssistantText.value).catch(() => undefined)
    }
  }

  return {
    open,
    messages,
    thinking,
    conversationId,
    chartContext,
    lastAssistantText,
    hasHistory,
    toggle,
    openWithChart,
    clearChartContext,
    send,
    sendPreset,
    clear,
    retry,
    copyLastAnswer,
  }
}

/**
 * Consumes an SSE response body frame-by-frame. Frames are separated by a blank
 * line; each carries an `event:` name and one or more `data:` payload lines.
 */
async function readStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onDelta: (text: string) => void
    onDone: (reply: string) => void
    onError: (message: string) => void
  },
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleFrame = (frame: string) => {
    let event = 'message'
    const dataLines: string[] = []

    for (const line of frame.split('\n')) {
      if (line.startsWith('event:'))
        event = line.slice(6).trim()
      else if (line.startsWith('data:'))
        dataLines.push(line.slice(5).trim())
    }

    if (!dataLines.length)
      return

    const data = JSON.parse(dataLines.join('\n')) as {
      text?: string
      reply?: string
      message?: string
    }

    if (event === 'delta' && typeof data.text === 'string')
      handlers.onDelta(data.text)

    if (event === 'done' && typeof data.reply === 'string')
      handlers.onDone(data.reply)

    if (event === 'error' && typeof data.message === 'string')
      handlers.onError(data.message)
  }

  for (;;) {
    const { done, value } = await reader.read()

    if (done)
      break

    buffer += decoder.decode(value, { stream: true })

    let separator = buffer.indexOf('\n\n')

    while (separator !== -1) {
      const frame = buffer.slice(0, separator)

      buffer = buffer.slice(separator + 2)

      if (frame.trim())
        handleFrame(frame)

      separator = buffer.indexOf('\n\n')
    }
  }
}
