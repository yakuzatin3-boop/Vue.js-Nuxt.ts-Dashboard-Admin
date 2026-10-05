export const formatCurrency = (value: string | number | null | undefined, currency = 'USD') => {
  const amount = typeof value === 'string' ? Number(value) : (value ?? 0)

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export const formatNumber = (value: string | number | null | undefined) => {
  const amount = typeof value === 'string' ? Number(value) : (value ?? 0)

  return new Intl.NumberFormat('en-US').format(Number.isFinite(amount) ? amount : 0)
}

export const formatDate = (value: string | null | undefined) => {
  if (!value)
    return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime()))
    return '—'

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

export const formatMonth = (month: string) => {
  const date = new Date(`${month}-01T00:00:00`)

  if (Number.isNaN(date.getTime()))
    return month

  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date)
}

export const initials = (name: string | null | undefined, fallback = 'A') => {
  if (!name)
    return fallback

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || fallback
}

/**
 * Abbreviated money for tight spots such as axis labels and card values.
 * `$1.2M` reads faster than `$1,234,567` and stops long values from wrapping.
 */
export const formatCompactCurrency = (
  value: string | number | null | undefined,
  currency = 'USD',
) => {
  const amount = typeof value === 'string' ? Number(value) : (value ?? 0)

  if (!Number.isFinite(amount))
    return formatCurrency(0, currency)

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

export const formatCompactNumber = (value: string | number | null | undefined) => {
  const amount = typeof value === 'string' ? Number(value) : (value ?? 0)

  if (!Number.isFinite(amount))
    return formatNumber(0)

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

/** "3 days ago", "just now". Falls back to an absolute date past a month. */
export const formatRelative = (value: string | null | undefined) => {
  if (!value)
    return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return '—'

  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000)

  if (diffSeconds < 60)
    return 'just now'

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34524, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ]

  let amount = diffSeconds

  for (const [step, unit] of units) {
    if (Math.abs(amount) < step) {
      return new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(
        -Math.round(amount),
        unit,
      )
    }

    amount /= step
  }

  return formatDate(value)
}

/** Full date plus time, for tooltips and detail rows. */
export const formatDateTime = (value: string | null | undefined) => {
  if (!value)
    return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return '—'

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Turns SCREAMING_SNAKE enum values into readable labels. */
export const humanize = (value: string | null | undefined) => {
  if (!value)
    return '—'

  const spaced = value.replace(/[_-]+/g, ' ').trim().toLowerCase()

  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
