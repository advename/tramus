#!/usr/bin/env node
// Builds a Tramus installer for the current OS and CPU architecture (used locally and by
// .github/workflows/release.yml):
//   1. freezes the Python engine with PyInstaller (engine/dist/tramus-engine/)
//   2. copies it to app/resources/engine/
//   3. builds the renderer/main bundles and runs electron-builder (app/release/)
// Usage: node scripts/build.mjs [--skip-engine] [--skip-app]
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BUILD_INFO_PATH } from './build-info.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const engineDir = join(root, 'engine')
const appDir = join(root, 'app')
const isWindows = process.platform === 'win32'
const venvBin = join(engineDir, '.venv', isWindows ? 'Scripts' : 'bin')
const args = new Set(process.argv.slice(2))

function run(command, commandArgs, cwd) {
  console.log(`\n$ ${command} ${commandArgs.join(' ')}   (in ${cwd})`)
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit', shell: isWindows })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (!args.has('--skip-engine')) {
  if (!existsSync(venvBin)) {
    console.error('engine/.venv not found — create it first (see README → Development).')
    process.exit(1)
  }
  // Pinned versions: every platform and release ships the same tracking stack
  run(join(venvBin, 'pip'), ['install', '-q', '-e', '.[build]', '-c', 'packaging/constraints.txt'],
    engineDir)
  run(join(venvBin, 'pyinstaller'), ['packaging/tramus-engine.spec', '--noconfirm',
    '--distpath', 'dist', '--workpath', 'build'], engineDir)
  const target = join(appDir, 'resources', 'engine')
  rmSync(target, { recursive: true, force: true })
  // verbatimSymlinks: PyInstaller's relative links (Python.framework, dylibs) must stay relative;
  // by default cpSync rewrites them to absolute paths into engine/dist on this machine
  cpSync(join(engineDir, 'dist', 'tramus-engine'), target, { recursive: true, verbatimSymlinks: true })
}

if (!args.has('--skip-app')) {
  // `npm run build` writes the build-info file first (a release build keeps its stamp)
  run('npm', ['run', 'build'], appDir)
  // Release builds set the OS-level build version (CFBundleVersion on macOS, FileVersion on
  // Windows) to <version>.<build number>; local builds keep electron-builder's default
  const { version, buildNumber } = JSON.parse(readFileSync(BUILD_INFO_PATH, 'utf-8'))
  const buildVersion = buildNumber ? [`--config.buildVersion=${version}.${buildNumber}`] : []
  // Never publish from electron-builder: the Release workflow uploads the installers itself
  run('npx', ['electron-builder', '--config', 'electron-builder.yml', '--publish', 'never',
    ...buildVersion], appDir)
}
