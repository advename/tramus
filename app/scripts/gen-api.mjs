#!/usr/bin/env node
/**
 * Regenerates `src/renderer/src/api/schema.d.ts` from the engine's live OpenAPI schema:
 *
 *   1. `<engine venv python> -m tramus_engine openapi --out <tmp file>`
 *   2. `openapi-typescript <tmp file> -o src/renderer/src/api/schema.d.ts`
 *
 * Requires `engine/.venv` to exist with `tramus-engine` installed (`cd engine && python -m venv
 * .venv && .venv/bin/pip install -e .`). If step 1 fails (e.g. the CLI's `openapi` command
 * doesn't exist yet), the current `schema.d.ts` is left untouched — see the placeholder notice
 * at the top of that file.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = join(appDir, '..')
const venvDir = join(repoRoot, 'engine', '.venv')
const python =
  process.platform === 'win32'
    ? join(venvDir, 'Scripts', 'python.exe')
    : join(venvDir, 'bin', 'python')

const tmpDir = mkdtempSync(join(tmpdir(), 'tramus-openapi-'))
const openapiJsonPath = join(tmpDir, 'openapi.json')

try {
  console.log(`[gen:api] ${python} -m tramus_engine openapi --out ${openapiJsonPath}`)
  const genResult = spawnSync(
    python,
    ['-m', 'tramus_engine', 'openapi', '--out', openapiJsonPath],
    { stdio: 'inherit', cwd: repoRoot }
  )

  if (genResult.status !== 0) {
    console.error(
      '\n[gen:api] Could not run `tramus_engine openapi` (see output above). Is the engine ' +
        'built yet (cd engine && python -m venv .venv && .venv/bin/pip install -e .)? ' +
        'Leaving src/renderer/src/api/schema.d.ts untouched.'
    )
    process.exit(genResult.status ?? 1)
  }

  const outPath = join(appDir, 'src/renderer/src/api/schema.d.ts')
  console.log(`[gen:api] openapi-typescript ${openapiJsonPath} -o ${outPath}`)
  const tsResult = spawnSync('npx', ['openapi-typescript', openapiJsonPath, '-o', outPath], {
    stdio: 'inherit',
    cwd: appDir,
    shell: process.platform === 'win32'
  })

  if (tsResult.status !== 0) process.exit(tsResult.status ?? 1)

  console.log('[gen:api] Done — src/renderer/src/api/schema.d.ts regenerated.')
} finally {
  rmSync(tmpDir, { recursive: true, force: true })
}
