// The build-info file: what this build is (version, build number, commit, build date). It is
// generated into app/resources/build-info.json — gitignored, so a build never touches tracked
// files — and shipped inside the app. The Electron main process reads it, shows it in
// Settings → About and hands the full version to the engine (TRAMUS_APP_VERSION), so analyses
// and exports record exactly what the app reports.
//
//   release build  1.2.3, build 45        stamped by scripts/set-version.mjs (Release workflow)
//   local build    0.0.0-dev+abc1234      `.dirty` appended when there are uncommitted changes;
//                                         plain 0.0.0-dev when git isn't available
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const BUILD_INFO_PATH = join(root, 'app', 'resources', 'build-info.json')
export const DEV_VERSION = '0.0.0-dev'

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/** The short commit hash, or null outside a git checkout. */
export function currentCommit() {
  return git('rev-parse', '--short=7', 'HEAD') || null
}

/** Whether the working tree has uncommitted changes (false when git isn't available). */
function isDirty() {
  return Boolean(git('status', '--porcelain'))
}

/** The info for a local build: `0.0.0-dev+<sha>[.dirty]`, or `0.0.0-dev` without git. */
export function localBuildInfo() {
  const commit = currentCommit()
  const dirty = commit !== null && isDirty()
  return {
    version: commit ? `${DEV_VERSION}+${commit}${dirty ? '.dirty' : ''}` : DEV_VERSION,
    buildNumber: null,
    commit,
    dirty,
    buildDate: new Date().toISOString()
  }
}

/** The info for a release build; `buildNumber` is the GitHub Actions run number. */
export function releaseBuildInfo(version, buildNumber) {
  return {
    version,
    buildNumber,
    commit: currentCommit(),
    dirty: false, // stamping the version edits tracked files; the release is still that commit
    buildDate: new Date().toISOString()
  }
}

export function writeBuildInfo(info) {
  mkdirSync(dirname(BUILD_INFO_PATH), { recursive: true })
  writeFileSync(BUILD_INFO_PATH, JSON.stringify(info, null, 2) + '\n')
}
