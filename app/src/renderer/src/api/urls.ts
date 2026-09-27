import { getEngineConnection } from './connection'

function withToken(path: string, params: Record<string, string | number | undefined>): string {
  const { baseUrl, token } = getEngineConnection()
  const search = new URLSearchParams()
  search.set('token', token)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  return `${baseUrl}${path}?${search.toString()}`
}

export interface FrameUrlOptions {
  maxSide?: number
  brightness?: number
  contrast?: number
  quality?: number
}

/** `GET /videos/{id}/frames/{index}` as an `<img>`/canvas-drawable URL, token included. */
export function frameUrl(videoId: string, index: number, opts: FrameUrlOptions = {}): string {
  return withToken(`/api/videos/${videoId}/frames/${index}`, {
    max_side: opts.maxSide,
    brightness: opts.brightness,
    contrast: opts.contrast,
    quality: opts.quality
  })
}

export interface ThumbnailUrlOptions {
  maxSide?: number
  t?: number
}

/** `GET /videos/{id}/thumbnail` as an `<img>`-src URL, token included. */
export function thumbnailUrl(videoId: string, opts: ThumbnailUrlOptions = {}): string {
  return withToken(`/api/videos/${videoId}/thumbnail`, { max_side: opts.maxSide, t: opts.t })
}
