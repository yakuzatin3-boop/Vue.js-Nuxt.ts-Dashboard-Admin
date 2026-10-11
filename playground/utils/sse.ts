/**
 * Server-sent-events plumbing shared by the streaming assistants.
 *
 * The backend streams a small, fixed frame vocabulary — `delta`, `done` and
 * `error` — so the reader stays a plain event loop rather than a general SSE
 * client. It is browser-only and side-effect free, which keeps it out of the
 * composables that own the conversation state.
 */

export interface SseHandlers {
  /** A token or chunk of the reply as it is produced. */
  onDelta: (text: string) => void
  /** The authoritative, fully persisted reply, which ends the stream. */
  onDone: (reply: string) => void
  /** A stream-level failure carrying the server's message. */
  onError: (message: string) => void
}

/**
 * Consumes an SSE response body frame-by-frame. Frames are separated by a blank
 * line; each carries an `event:` name and one or more `data:` payload lines.
 */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  handlers: SseHandlers,
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

/**
 * Turns a non-OK streaming response into an Error carrying the API message.
 * Nest answers errors as `{ message }`, but a proxy can return plain HTML, and
 * a throw here would mask the real one, so the parse is guarded.
 */
export async function readSseError(res: Response): Promise<Error> {
  const raw = await res.text().catch(() => '')
  let data: string | string[] | undefined

  try {
    data = raw ? (JSON.parse(raw) as { message?: string | string[] }).message : undefined
  }
  catch {
    data = raw || undefined
  }

  const message = Array.isArray(data) ? data.join(', ') : (data ?? `Request failed (${res.status})`)

  return new Error(message)
}
