import { describe, expect, it } from 'vitest'

import { LruMap } from './lruMap'

describe('LruMap', () => {
  it('returns undefined for a missing key', () => {
    const cache = new LruMap<number, string>(2)
    expect(cache.get(1)).toBeUndefined()
    expect(cache.has(1)).toBe(false)
  })

  it('stores and retrieves values under capacity', () => {
    const cache = new LruMap<number, string>(2)
    expect(cache.set(1, 'a')).toBeUndefined()
    expect(cache.set(2, 'b')).toBeUndefined()
    expect(cache.get(1)).toBe('a')
    expect(cache.get(2)).toBe('b')
    expect(cache.size).toBe(2)
  })

  it('evicts the least-recently-used entry once over capacity', () => {
    const cache = new LruMap<number, string>(2)
    cache.set(1, 'a')
    cache.set(2, 'b')
    const evicted = cache.set(3, 'c') // 1 is oldest, untouched since insertion
    expect(evicted).toEqual([1, 'a'])
    expect(cache.has(1)).toBe(false)
    expect(cache.keys()).toEqual([2, 3])
  })

  it('reading a key refreshes its recency', () => {
    const cache = new LruMap<number, string>(2)
    cache.set(1, 'a')
    cache.set(2, 'b')
    cache.get(1) // now 2 is the least-recently-used
    const evicted = cache.set(3, 'c')
    expect(evicted).toEqual([2, 'b'])
    expect(cache.keys()).toEqual([1, 3])
  })

  it('peek reads without affecting recency', () => {
    const cache = new LruMap<number, string>(2)
    cache.set(1, 'a')
    cache.set(2, 'b')
    expect(cache.peek(1)).toBe('a')
    const evicted = cache.set(3, 'c') // 1 still oldest — peek didn't refresh it
    expect(evicted).toEqual([1, 'a'])
  })

  it('re-setting an existing key updates its value and recency without evicting', () => {
    const cache = new LruMap<number, string>(2)
    cache.set(1, 'a')
    cache.set(2, 'b')
    const evicted = cache.set(1, 'a2')
    expect(evicted).toBeUndefined()
    expect(cache.get(1)).toBe('a2')
    expect(cache.size).toBe(2)
  })

  it('clear empties the cache', () => {
    const cache = new LruMap<number, string>(2)
    cache.set(1, 'a')
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.keys()).toEqual([])
  })
})
