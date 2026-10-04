#!/usr/bin/env node
// Writes the build-info file for a local build (npm run dev / build, scripts/build.mjs). A
// release build is stamped by scripts/set-version.mjs, which writes it with the build number; this
// leaves such a stamp alone.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BUILD_INFO_PATH, DEV_VERSION, localBuildInfo, root, writeBuildInfo } from './build-info.mjs'

const { version } = JSON.parse(readFileSync(join(root, 'app', 'package.json'), 'utf-8'))
if (version !== DEV_VERSION) {
  console.log(`Release version ${version}: keeping ${BUILD_INFO_PATH}`)
} else {
  const info = localBuildInfo()
  writeBuildInfo(info)
  console.log(`Build info: ${info.version}`)
}
