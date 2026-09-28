/**
 * A capacity-bounded least-recently-used map. `get`/`set` both mark a key as most-recently-used;
 * once `size` exceeds `capacity`, `set` evicts the least-recently-used entry and returns it so
 * the caller can dispose of it (used by `usePlaybackFrames.ts` to close evicted `ImageBitmap`s).
 * Backed by a `Map`, whose keys iterate in insertion order — re-inserting a key on access is
 * enough to keep that order equal to recency order.
 */
export class LruMap<K, V> {
  private readonly map = new Map<K, V>()

  constructor(private readonly capacity: number) {}

  get size(): number {
    return this.map.size
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  /** Reads `key` without affecting recency (safe to call during render). */
  peek(key: K): V | undefined {
    return this.map.get(key)
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  /** Inserts/replaces `key` as most-recently-used. Returns the evicted `[key, value]`, if any. */
  set(key: K, value: V): [K, V] | undefined {
    this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size <= this.capacity) return undefined
    const oldestKey = this.map.keys().next().value as K
    const oldestValue = this.map.get(oldestKey) as V
    this.map.delete(oldestKey)
    return [oldestKey, oldestValue]
  }

  keys(): K[] {
    return [...this.map.keys()]
  }

  values(): V[] {
    return [...this.map.values()]
  }

  clear(): void {
    this.map.clear()
  }
}
