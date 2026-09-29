#!/usr/bin/env node
/**
 * Renders the app icons in build/ from build/icon.svg:
 *   icon.png        1024 px full-bleed tile (Linux, and the window icon on Windows/Linux)
 *   icon-macos.png  1024 px on Apple's icon grid (dev-mode Dock icon)
 *   icon.icns       macOS bundle icon (needs macOS `iconutil`; skipped elsewhere)
 *   icon.ico        Windows icon, 16–256 px
 *
 * Every size is rasterised from the SVG directly rather than downscaled, so small sizes stay
 * crisp. Uses Playwright's Chromium (a dev dependency). Run with `npm run gen:icons` after
 * changing icon.svg, and commit the outputs.
 */
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const buildDir = resolve(dirname(fileURLToPath(import.meta.url)), '../build')
const svg = await readFile(join(buildDir, 'icon.svg'))
const svgSrc = `data:image/svg+xml;base64,${svg.toString('base64')}`

// Apple's macOS icon grid: an 824 px tile centred on a 1024 px canvas, with a soft drop shadow.
const MAC_TILE = 824 / 1024

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })

/** Renders the icon at `size` px, either full-bleed or on the macOS grid, as PNG bytes. */
async function render(size, { mac = false } = {}) {
  await page.setViewportSize({ width: size, height: size })
  const img = mac
    ? `<img src="${svgSrc}" style="width:${size * MAC_TILE}px;height:${size * MAC_TILE}px;` +
      `filter:drop-shadow(0 ${size * 0.01}px ${size * 0.012}px rgb(0 0 0 / 0.3))">`
    : `<img src="${svgSrc}" style="width:${size}px;height:${size}px">`
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center">` +
      `${img}</body>`
  )
  await page.locator('img').evaluate((el) => el.decode())
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}

/** Packs PNG images into a .ico (PNG-compressed entries, supported since Windows Vista). */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, i) => {
    const entry = 6 + i * 16
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map(({ png }) => png)])
}

try {
  await writeFile(join(buildDir, 'icon.png'), await render(1024))
  await writeFile(join(buildDir, 'icon-macos.png'), await render(1024, { mac: true }))

  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const icoImages = []
  for (const size of icoSizes) icoImages.push({ size, png: await render(size) })
  await writeFile(join(buildDir, 'icon.ico'), ico(icoImages))

  if (process.platform === 'darwin') {
    const tmp = await mkdtemp(join(tmpdir(), 'tramus-icons-'))
    const iconset = join(tmp, 'icon.iconset')
    await mkdir(iconset)
    for (const base of [16, 32, 128, 256, 512]) {
      await writeFile(join(iconset, `icon_${base}x${base}.png`), await render(base, { mac: true }))
      await writeFile(
        join(iconset, `icon_${base}x${base}@2x.png`),
        await render(base * 2, { mac: true })
      )
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(buildDir, 'icon.icns')])
    await rm(tmp, { recursive: true })
  } else {
    console.warn('Skipped icon.icns: iconutil is only available on macOS.')
  }
} finally {
  await browser.close()
}

console.log(`Wrote icons to ${buildDir}`)
