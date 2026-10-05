import { type Ref, onBeforeUnmount, onMounted, ref } from 'vue'

export interface ElementSize {
  /** Host element to attach to. */
  element: Ref<HTMLElement | null>
  /** Border-box width in CSS pixels. `0` before the first measurement. */
  width: Ref<number>
  /** Border-box height in CSS pixels. */
  height: Ref<number>
}

/**
 * Tracks an element's rendered size.
 *
 * SVG charts here are drawn in real pixels rather than scaled from a fixed
 * viewBox, which needs a width to lay out bars and axis gutters. SSR has no
 * layout, so `width` stays `0` until the observer fires after hydration.
 */
export function useElementSize<T extends HTMLElement = HTMLElement>(): ElementSize {
  const element = ref<T | null>(null)
  const width = ref(0)
  const height = ref(0)

  let observer: ResizeObserver | null = null

  onMounted(() => {
    const node = element.value
    if (!node)
      return

    observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry)
        return

      width.value = entry.contentRect.width
      height.value = entry.contentRect.height
    })

    observer.observe(node)
    width.value = node.clientWidth
    height.value = node.clientHeight
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return { element, width, height }
}
