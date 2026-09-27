import createClient from 'openapi-fetch'

import type { EngineConnection } from '@shared/ipc'

import type { paths } from './schema'

export type ApiClient = ReturnType<typeof createClient<paths>>

/** Error shape the engine sends for every non-2xx response: `{"detail": "..."}`. */
interface ErrorBody {
  detail?: unknown
}

/** Thrown by `unwrap()` for any failed API call. `.message` is the engine's `detail` string. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let client: ApiClient | null = null

/** Called once by `<EngineProvider>` after the engine connection is known. */
export function configureApiClient(connection: EngineConnection): ApiClient {
  // Every path in the generated `paths` type already starts with "/api" (the engine's FastAPI
  // router prefix — see docs/architecture.md §8), so the client's baseUrl is just the engine's
  // origin. Call sites use the full path, e.g. `client.GET('/api/settings')`.
  client = createClient<paths>({ baseUrl: connection.baseUrl })
  client.use({
    onRequest({ request }) {
      request.headers.set('X-Tramus-Token', connection.token)
      return request
    }
  })
  return client
}

/** The shared, typed engine client. Safe to call from anywhere rendered inside `<EngineProvider>`. */
export function getApiClient(): ApiClient {
  if (!client) {
    throw new Error('API client not configured yet — render inside <EngineProvider>.')
  }
  return client
}

/**
 * Unwraps an openapi-fetch result (`{data, error, response}`), throwing `ApiError` with the
 * engine's `detail` message on failure. Use this in every `queryFn`/`mutationFn` instead of
 * checking `error` by hand:
 *
 * ```ts
 * queryFn: async () => unwrap(await getApiClient().GET('/api/videos/{id}', { params: { path: { id } } }))
 * ```
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined) {
    throw new ApiError(extractDetail(result.error), result.response.status)
  }
  if (result.data === undefined) {
    throw new ApiError('The engine returned an empty response.', result.response.status)
  }
  return result.data
}

function extractDetail(error: unknown): string {
  const body = error as ErrorBody | undefined
  if (body && typeof body.detail === 'string') return body.detail
  return 'Unexpected error from the Tramus engine.'
}
