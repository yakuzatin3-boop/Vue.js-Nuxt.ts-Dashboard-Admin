/**
 * Minimal, escape-first markdown renderer for the assistant's replies.
 *
 * Block structure is detected on the RAW lines first (a `>` quote marker must
 * be recognised before it is escaped), and only then is the content of each
 * block escaped and rebuilt with the small set of tags the model is allowed to
 * use. Because byte-for-byte unknown input is still escaped, `v-html` can never
 * run a `<script>` the model returned. Links are further restricted to
 * http/https/mailto so a `javascript:` URL cannot ride in through `[text](url)`.
 */

/** Safety net on both the raw input and the final HTML (.max 2000 from the API anyway). */
export const MAX_RENDERED_MARKDOWN = 20_000

/** Escapes text, then rebuilds only inline tags the model is allowed to use. */
const inline = (text: string): string => {
  const escaped = escapeHtml(text)

  return escaped
    // Bold-italic first so the bold rule does not swallow the asterisks.
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
      const safeUrl = safeLink(url)

      return safeUrl
        ? `<a href="${safeUrl}" target="_blank" rel="noreferrer noopener">${label}</a>`
        : label
    })
}

function safeLink(url: string): string | null {
  const trimmed = url.trim()

  if (/^(?:https?:|mailto:)/i.test(trimmed))
    return trimmed

  return null
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Renders markdown-ish text into sanitized HTML.
 *
 * Supported: headings, lists, **bold**, *italic*, `code`, ``` fenced code ```,
 * blockquotes, inline links and blank-line-separated paragraphs. Adjacent
 * plain lines share one paragraph joined by `<br>`. Anything unrecognized
 * stays as escaped text.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown.trim())
    return ''

  const lines = markdown.slice(0, MAX_RENDERED_MARKDOWN).split('\n')
  const out: string[] = []

  let inList: 'ul' | 'ol' | null = null
  let inQuote = false
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length)
      return

    out.push(`<p>${paragraph.join('<br>')}</p>`)
    paragraph = []
  }

  // A blank line or any block element ends the current paragraph. Lists and
  // quotes flush here too, so interleaving "text, list, more text" stays valid.
  const flushAll = () => {
    flushParagraph()
    closeList()
    closeQuote()
  }

  const closeList = () => {
    if (inList) {
      out.push(`</${inList}>`)
      inList = null
    }
  }

  const closeQuote = () => {
    if (inQuote) {
      out.push('</blockquote>')
      inQuote = false
    }
  }

  for (let index = 0; index < lines.length; index++) {
    const line = (lines[index] ?? '').trimEnd()

    if (!line.trim()) {
      flushAll()

      continue
    }

    // Fenced code block: consume lines until the closing fence.
    if (line.trim().startsWith('```')) {
      flushAll()

      const codeLines: string[] = []

      while (index + 1 < lines.length && !(lines[index + 1] ?? '').trim().startsWith('```')) {
        index += 1
        codeLines.push(lines[index] ?? '')
      }

      index += 1 // skip the closing fence

      out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)

      continue
    }

    const heading = /^(#{1,3}) (.+)$/.exec(line)

    if (heading) {
      flushAll()
      // #/##/### map to h2/h3/h4, skipping one level for page semantics.
      const level = Math.min((heading[1] ?? '').length + 1, 4)
      out.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`)

      continue
    }

    const quote = /^>\s?(.+)$/.exec(line)

    if (quote) {
      flushParagraph()
      closeList()

      if (!inQuote) {
        out.push('<blockquote>')
        inQuote = true
      }

      out.push(inline(quote[1] ?? ''))

      continue
    }

    const listItem = /^([-*+]|\d+\.) (.+)$/.exec(line)

    if (listItem) {
      flushParagraph()
      closeQuote()

      const kind = /^\d+\.$/.test(listItem[1] ?? '') ? 'ol' : 'ul'

      if (inList !== kind) {
        closeList()
        out.push(`<${kind}>`)
        inList = kind
      }

      out.push(`<li>${inline(listItem[2] ?? '')}</li>`)

      continue
    }

    // Plain line: part of the current paragraph.
    closeList()
    closeQuote()
    paragraph.push(inline(line))
  }

  flushAll()

  const html = out.join('')

  return html.length > MAX_RENDERED_MARKDOWN
    ? html.slice(0, MAX_RENDERED_MARKDOWN)
    : html
}
