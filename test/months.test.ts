import { describe, it, expect } from 'vitest'

import { expandMonths, lastMonths, monthKey } from '../playground/utils/months'

const utc = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1))

describe('monthKey', () => {
  it('zero pads single digit months', () => {
    expect(monthKey(utc(2026, 3))).toBe('2026-03')
  })

  it('reads the date in UTC so the key cannot shift by timezone', () => {
    // Late evening UTC would be the next day in some zones, which is how a
    // month boundary gets attributed to the wrong month.
    expect(monthKey(new Date(Date.UTC(2026, 8, 30, 23, 59)))).toBe('2026-09')
  })
})

describe('lastMonths', () => {
  const now = utc(2026, 10)

  it('returns the trailing window oldest first', () => {
    expect(lastMonths(3, now)).toEqual(['2026-08', '2026-09', '2026-10'])
  })

  it('always ends on the reference month', () => {
    expect(lastMonths(6, now).at(-1)).toBe('2026-10')
  })

  it('crosses a year boundary without repeating or skipping a month', () => {
    expect(lastMonths(4, utc(2026, 2))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })

  it('returns unique months for a large window', () => {
    const months = lastMonths(12, now)

    expect(months).toHaveLength(12)
    expect(new Set(months).size).toBe(12)
  })

  it('handles a single month window', () => {
    expect(lastMonths(1, now)).toEqual(['2026-10'])
  })

  it('defaults to the current month when no reference is given', () => {
    expect(lastMonths(1).at(-1)).toBe(monthKey(new Date()))
  })
})

describe('expandMonths', () => {
  it('backfills an interior gap instead of dropping the slot', () => {
    // Charts read the series positionally, so a missing month shifts every
    // later point one slot left of the month it belongs to.
    expect(expandMonths(['2026-01', '2026-04'])).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ])
  })

  it('crosses a December to January boundary', () => {
    expect(expandMonths(['2025-11', '2026-02'])).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })

  it('sorts and dedupes the keys it is given', () => {
    expect(expandMonths(['2026-03', '2026-01', '2026-03'])).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })

  it('returns nothing when there are no keys', () => {
    expect(expandMonths([])).toEqual([])
  })

  it('honours explicit bounds', () => {
    expect(expandMonths(['2026-01'], '2026-01', '2026-03')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })

  it('returns nothing when the bounds are inverted', () => {
    expect(expandMonths(['2026-01'], '2026-05', '2026-01')).toEqual([])
  })

  it('aligns every slot with its own month when a month has no data', () => {
    const axis = lastMonths(6, utc(2026, 10))
    const rows = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
    const values = axis.map(month => (rows.includes(month) ? 100 : 0))

    expect(axis).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ])
    // 2026-10 has no rows, so it must be a zero in the last slot rather than
    // absent, which would leave September's value sitting in October's place.
    expect(values).toEqual([100, 100, 100, 100, 100, 0])
  })
})
