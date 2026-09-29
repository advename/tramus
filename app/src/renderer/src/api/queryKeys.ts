/**
 * TanStack Query key factory. Every query/mutation in every feature should build its key from
 * here rather than writing array literals inline — it's what keeps `events.ts`'s cache
 * invalidation (and any manual invalidation elsewhere) correct as features are added.
 */
export const queryKeys = {
  system: {
    health: () => ['system', 'health'] as const,
    info: () => ['system', 'info'] as const
  },
  settings: {
    all: () => ['settings'] as const
  },
  library: {
    all: () => ['library'] as const,
    recent: () => ['library', 'recent'] as const,
    open: (path: string) => ['library', 'open', path] as const
  },
  video: {
    all: () => ['video'] as const,
    detail: (videoId: string) => ['video', videoId] as const,
    frameTimes: (videoId: string) => ['video', videoId, 'frame-times'] as const
  },
  session: {
    detail: (videoId: string) => ['video', videoId, 'session'] as const
  },
  track: {
    detail: (videoId: string) => ['video', videoId, 'session', 'track'] as const
  },
  flags: {
    list: (videoId: string) => ['video', videoId, 'session', 'flags'] as const
  },
  results: {
    detail: (videoId: string) => ['video', videoId, 'session', 'results'] as const
  },
  history: {
    list: (videoId: string) => ['video', videoId, 'session', 'history'] as const
  },
  jobs: {
    all: () => ['jobs'] as const,
    detail: (jobId: string) => ['jobs', jobId] as const
  },
  templates: {
    all: () => ['templates'] as const,
    detail: (templateId: string) => ['templates', templateId] as const
  },
  batches: {
    all: () => ['batches'] as const,
    detail: (batchId: string) => ['batches', batchId] as const
  }
} as const
