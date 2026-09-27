import { type RefObject, useEffect, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

const ZERO_SIZE: ElementSize = { width: 0, height: 0 }

/** Tracks an element's content-box size via `ResizeObserver` — for stage/timeline layout math. */
export function useElementSize(ref: RefObject<Element | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>(ZERO_SIZE)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const box = entry.contentBoxSize?.[0]
      setSize(
        box
          ? { width: box.inlineSize, height: box.blockSize }
          : { width: entry.contentRect.width, height: entry.contentRect.height }
      )
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return size
}
