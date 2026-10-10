/**
 * Admin Insights Assistant types. The backend lives under /admin/ai and the
 * server never needs more than the chart context the dashboard already holds,
 * so every payload here is serializable plain data — no class instances.
 */

export interface AiInsightsContext {
  page?: string
  dateRange?: string
  chartId?: string
  chartTitle?: string
  /** A compact, already-summarized series. The backend re-truncates and scrubs it. */
  chartData?: Record<string, unknown>
}

export interface AiInsightsChatResponse {
  reply: string
  conversationId: string
}

export interface AiInsightsPreset {
  label: string
  hint: string
  question: string
}

/** Mirrors the preset names the backend whitelists. */
export const AI_INSIGHTS_PRESETS: AiInsightsPreset[] = [
  {
    label: 'Sales summary',
    hint: 'Headlines and the biggest risk right now',
    question:
      'Summarize the current sales performance, the most important changes, and the single biggest risk or opportunity I should act on.',
  },
  {
    label: 'Restock advice',
    hint: 'What to reorder first, and how much',
    question:
      'Which products should I restock first, and roughly how much of each should I order? Consider current stock, how fast items sell, and the season.',
  },
  {
    label: 'Marketing ideas',
    hint: 'Five ideas for slow sellers',
    question:
      'Give me 5 concrete, low-cost marketing ideas for my slow-selling items, each with why it should work and the expected impact.',
  },
  {
    label: 'Customer segments',
    hint: 'What your best customers buy together',
    question:
      'Describe what my best customers tend to buy together and which customer segments stand out, then suggest one way to target each.',
  },
]

export interface InsightsTurn {
  id: number
  role: 'user' | 'assistant'
  text: string
  at: number
  /** Set on assistant turns that ended in an error instead of an answer. */
  error?: boolean
}

export const INSIGHTS_WELCOME
  = 'Ask me anything about your store. I read the same aggregates the dashboard shows, so the numbers you see here match the charts — and I will always end with a recommended next step.'

export const INSIGHTS_DEFAULT_CHART_QUESTION
  = 'Explain this chart in plain language: what is happening, what stands out, and what should I do about it?'
