#!/usr/bin/env node
// Builds a Tramus installer for the current OS:
//   1. freezes the Python engine with PyInstaller (engine/dist/tramus-engine/)
//   2. copies it to app/resources/engine/
//   3. builds the renderer/main bundles and runs electron-builder (app/release/)
// Usage: node scripts/build.mjs [--skip-engine] [--skip-app]
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  run(join(venvBin, 'pip'), ['install', '-q', '-e', '.[build]'], engineDir)
  run(join(venvBin, 'pyinstaller'), ['packaging/tramus-engine.spec', '--noconfirm',
    '--distpath', 'dist', '--workpath', 'build'], engineDir)
  const target = join(appDir, 'resources', 'engine')
  rmSync(target, { recursive: true, force: true })
  cpSync(join(engineDir, 'dist', 'tramus-engine'), target, { recursive: true })
}

if (!args.has('--skip-app')) {
  run('npm', ['run', 'build'], appDir)
  run('npx', ['electron-builder', '--config', 'electron-builder.yml'], appDir)
}
