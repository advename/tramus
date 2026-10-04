#!/usr/bin/env node
// Stamps a release version into the app and the engine. The Release workflow runs this on its
// own checkout before building; the repo itself stays at the development version (0.0.0-dev).
//   app/package.json + package-lock.json  → installer names, the OS-level app version
//   engine/src/tramus_engine/__init__.py  → the engine's own version (CLI use without the app)
//   app/resources/build-info.json          → version + build number, shown in Settings → About and
//                                            recorded as `app_version` in every analysis/export;
//                                            scripts/build.mjs also reads it for electron-builder
// Usage: node scripts/set-version.mjs 1.2.3 45   (version, then the build number: the Actions run number)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { releaseBuildInfo, writeBuildInfo } from './build-info.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2] ?? ''
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Expected a version like 1.2.3, got "${version}".`)
  process.exit(1)
}
const buildArg = process.argv[3] ?? ''
if (!/^[1-9]\d*$/.test(buildArg)) {
  console.error(`Expected a build number like 45, got "${buildArg}".`)
  process.exit(1)
}

function editJson(path, edit) {
  const data = JSON.parse(readFileSync(path, 'utf-8'))
  edit(data)
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

editJson(join(root, 'app', 'package.json'), (pkg) => {
  pkg.version = version
})
editJson(join(root, 'app', 'package-lock.json'), (lock) => {
  lock.version = version
  lock.packages[''].version = version
})

const initPath = join(root, 'engine', 'src', 'tramus_engine', '__init__.py')
const init = readFileSync(initPath, 'utf-8')
const stamped = init.replace(/^__version__ = ".*"$/m, `__version__ = "${version}"`)
if (stamped === init && !init.includes(`__version__ = "${version}"`)) {
  console.error(`No __version__ line found in ${initPath}.`)
  process.exit(1)
}
writeFileSync(initPath, stamped)
writeBuildInfo(releaseBuildInfo(version, Number(buildArg)))
console.log(`Version set to ${version} (build ${buildArg}).`)
