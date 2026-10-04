import { randomBytes } from 'node:crypto'
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

import type { EngineConnection } from '@shared/ipc'

// Generous: the first launch after installing can take ~30 s while the OS security scan inspects
// the bundled engine binaries (measured on macOS); later launches take well under a second.
const READY_TIMEOUT_MS = 120_000
const STDERR_TAIL_LINES = 40

interface EngineReadyEvent {
  event: 'ready'
  port: number
}

function isEngineReadyEvent(value: unknown): value is EngineReadyEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { event?: unknown }).event === 'ready' &&
    typeof (value as { port?: unknown }).port === 'number'
  )
}

/** Thrown when the engine process exits or times out before printing its ready line. */
export class EngineStartupError extends Error {
  constructor(
    message: string,
    readonly stderrTail: string
  ) {
    super(message)
    this.name = 'EngineStartupError'
  }
}

/**
 * Resolves the command used to launch the engine.
 *
 * Priority: `TRAMUS_ENGINE_CMD` (space-separated, for local overrides) → the dev virtualenv in
 * the sibling `engine/` repo folder → the PyInstaller build bundled as an extra resource in a
 * packaged app.
 */
function resolveCommand(): { command: string; args: string[] } {
  const override = process.env.TRAMUS_ENGINE_CMD
  if (override) {
    const [command, ...args] = override.split(' ').filter(Boolean)
    if (!command) throw new Error('TRAMUS_ENGINE_CMD is set but empty')
    return { command, args }
  }

  if (!app.isPackaged) {
    // <repo>/app -> <repo>/engine
    const repoRoot = join(app.getAppPath(), '..')
    const venvDir = join(repoRoot, 'engine', '.venv')
    const python =
      process.platform === 'win32'
        ? join(venvDir, 'Scripts', 'python.exe')
        : join(venvDir, 'bin', 'python')
    return { command: python, args: ['-m', 'tramus_engine', 'serve'] }
  }

  const exeName = process.platform === 'win32' ? 'tramus-engine.exe' : 'tramus-engine'
  const command = join(process.resourcesPath, 'engine', exeName)
  return { command, args: ['serve'] }
}

/**
 * Owns the lifecycle of the local Python engine process: spawns it, waits for its readiness
 * line on stdout, and exposes the base URL + token every API/WebSocket call must use.
 *
 * The engine's stdin is left piped (never closed) and closed explicitly on quit, so the engine
 * sees EOF on stdin and exits on its own if Electron is killed uncleanly.
 */
export class EngineProcess {
  private child: ChildProcessWithoutNullStreams | null = null
  private stderrTail: string[] = []
  private connectionPromise: Promise<EngineConnection> | null = null

  /** @param appVersion the full version, passed on so the engine records exactly this. */
  constructor(private readonly appVersion: string) {}

  /** Starts the engine (idempotent: repeated calls return the same in-flight/resolved promise). */
  start(): Promise<EngineConnection> {
    if (!this.connectionPromise) {
      this.connectionPromise = this.spawnAndWaitForReady()
    }
    return this.connectionPromise
  }

  private spawnAndWaitForReady(): Promise<EngineConnection> {
    const token = randomBytes(24).toString('hex')
    const { command, args } = resolveCommand()

    if (!app.isPackaged && !existsSync(command)) {
      return Promise.reject(
        new EngineStartupError(
          `Engine executable not found at "${command}". Did you create engine/.venv? ` +
            `(cd engine && python -m venv .venv && .venv/bin/pip install -e .)`,
          ''
        )
      )
    }

    const child = spawn(command, [...args, '--port', '0', '--token', token], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TRAMUS_APP_VERSION: this.appVersion },
      // The frozen engine is a console program; without this Windows opens a console window
      windowsHide: true
    })
    this.child = child

    return new Promise<EngineConnection>((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill()
        reject(
          new EngineStartupError(
            `Engine did not report readiness within ${READY_TIMEOUT_MS / 1000}s.`,
            this.stderrTail.join('\n')
          )
        )
      }, READY_TIMEOUT_MS)

      let stdoutBuffer = ''
      child.stdout.setEncoding('utf-8')
      child.stdout.on('data', (chunk: string) => {
        stdoutBuffer += chunk
        let newlineIndex: number
        while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex).trim()
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)
          if (!line || settled) continue

          let parsed: unknown
          try {
            parsed = JSON.parse(line)
          } catch {
            continue // Not JSON — ignore (the engine may log plain text before it's ready).
          }
          if (isEngineReadyEvent(parsed)) {
            settled = true
            clearTimeout(timeout)
            resolve({ baseUrl: `http://127.0.0.1:${parsed.port}`, token })
          }
        }
      })

      child.stderr.setEncoding('utf-8')
      child.stderr.on('data', (chunk: string) => {
        console.error(`[engine] ${chunk.trimEnd()}`)
        for (const line of chunk.split('\n')) {
          if (!line) continue
          this.stderrTail.push(line)
          if (this.stderrTail.length > STDERR_TAIL_LINES) this.stderrTail.shift()
        }
      })

      child.on('error', (error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        reject(new EngineStartupError(`Failed to launch engine: ${error.message}`, ''))
      })

      child.on('exit', (code, signal) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        reject(
          new EngineStartupError(
            `Engine exited before it was ready (code ${code ?? 'null'}, signal ${signal ?? 'null'}).`,
            this.stderrTail.join('\n')
          )
        )
      })
    })
  }

  /** Kills the engine process. Safe to call multiple times / before start(). */
  stop(): void {
    if (!this.child) return
    try {
      this.child.stdin.end()
    } catch {
      // ignore — process may already be gone
    }
    this.child.kill()
    this.child = null
  }
}
