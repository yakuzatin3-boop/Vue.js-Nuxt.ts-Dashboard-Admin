/**
 * Month keys are the `YYYY-MM` strings the API groups by. The chart axes are
 * built from them rather than from the rows themselves, because a SQL
 * `GROUP BY month` only returns months that have data. Without a full axis a
 * quiet month vanishes and every later point slides one slot to the left,
 * which quietly misrepresents the trend.
 */

/** `YYYY-MM` for a date, read in UTC so the key never shifts by timezone. */
export const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

/** The trailing `count` months ending with the current one, oldest first. */
export const lastMonths = (count: number, now: Date = new Date()) => {
  const months: string[] = []

  for (let offset = count - 1; offset >= 0; offset--) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))))
  }

  return months
}

/**
 * Expands a sparse set of month keys into every month from `from` to `to`, so
 * the gaps become zero-valued points. Bounds default to the data itself, which
 * is what a "from the first sale to the last" axis wants.
 */
export const expandMonths = (keys: string[], from?: string, to?: string) => {
  const sorted = [...new Set(keys)].sort()
  const start = from ?? sorted[0]
  const end = to ?? sorted.at(-1)

  if (!start || !end || start > end)
    return []

  const [startYear, startMonth] = start.split('-').map(Number)
  const [endYear, endMonth] = end.split('-').map(Number)
  const months: string[] = []

  // Walking month-by-month rather than by date arithmetic, because adding 30
  // days to a month key drifts across short months and skips February.
  for (let year = startYear!, month = startMonth!; ; month += 1) {
    if (month > 12) {
      month = 1
      year += 1
    }

    months.push(`${year}-${String(month).padStart(2, '0')}`)

    if (year > endYear! || (year === endYear! && month >= endMonth!))
      break
  }

  return months
}
