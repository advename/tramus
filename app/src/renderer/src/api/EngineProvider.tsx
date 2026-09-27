import { useEffect, useState, type JSX, type ReactNode } from 'react'

import type { EngineConnection } from '@shared/ipc'

import { configureApiClient } from './client'
import { setEngineConnection } from './connection'

interface EngineProviderProps {
  children: ReactNode
}

type ConnectionState =
  { status: 'connecting' } | { status: 'ready' } | { status: 'error'; message: string }

// Hard-coded, not read from the theme: this splash can render before <ThemeProvider> (and its
// dependency on engine-provided settings) exists. Matches theme/tokens.ts's `darkTokens`.
const SPLASH_BG = '#100e0c'
const SPLASH_FG = '#eeebe4'
const SPLASH_ACCENT_BG = '#e5d2b0'
const SPLASH_ACCENT_FG = '#191511'

/**
 * Waits for the local engine process ({@link window.tramus.engine.getConnection}), configures
 * the shared API client (`api/client.ts`) and connection info (`api/urls.ts`) once it resolves,
 * and only then renders `children`. Renders a small branded splash while connecting, or an
 * error message if the engine failed to start — see `src/main/engine.ts` for the matching
 * native error dialog (which includes the engine's stderr tail).
 */
export function EngineProvider({ children }: EngineProviderProps): JSX.Element {
  const [state, setState] = useState<ConnectionState>({ status: 'connecting' })

  useEffect(() => {
    let cancelled = false

    const connect = (connection: EngineConnection): void => {
      if (cancelled) return
      setEngineConnection(connection)
      configureApiClient(connection)
      setState({ status: 'ready' })
    }

    window.tramus.engine
      .getConnection()
      .then(connect)
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not reach the Tramus engine.'
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'ready') return <>{children}</>

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: SPLASH_BG,
        color: SPLASH_FG,
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: SPLASH_ACCENT_BG,
            color: SPLASH_ACCENT_FG,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 600,
            fontSize: 22
          }}
        >
          T
        </div>
        {state.status === 'connecting' ? (
          <span style={{ fontSize: 13, opacity: 0.75 }}>Starting the Tramus engine…</span>
        ) : (
          <span style={{ fontSize: 13, maxWidth: 380, textAlign: 'center', opacity: 0.9 }}>
            {state.message}
          </span>
        )}
      </div>
    </div>
  )
}
