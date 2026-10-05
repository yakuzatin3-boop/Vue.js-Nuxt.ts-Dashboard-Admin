/** A single labelled value on a time axis, shared by every chart component. */
export interface ChartPoint {
  label: string
  value: number
}

/** One slice of a part-to-whole breakdown. */
export interface ChartSlice {
  label: string
  value: number
  /** Index into the chart palette. Defaults to position in the array. */
  tone?: number
}

export const chartColor = (tone: number) => `var(--chart-${(tone % 6) + 1})`
