#!/usr/bin/env node
// UI smoke test: launches the *built* app (`npm run build` first) with a hidden window, connects
// over the Chrome DevTools Protocol and runs a list of steps. It exits non-zero if the page throws.
//
//   node scripts/ui-smoke.mjs [--folder <dir with videos>] [--out <dir>] [--port <n>] [steps...]
//
// Without steps it runs: open the folder's first video in Setup, screenshot, measure playback.
// Runs isolated by default: a throwaway Electron profile and engine config dir, so it never
// touches real settings/templates/batches and works while `npm run dev` is running.
// Steps (`name:arg`, coordinates in CSS px of the 1440×900 window):
//   library                 open the folder in the Library
//   setup|review|results:N  open video N of the folder at that workspace step
//   hash:#/route            navigate to a route
//   key:Meta+t              press a key (Playwright key syntax)
//   click:Text              click the first element with that text
//   hover:Text              hover the first element with that text
//   drag:x1,y1,x2,y2        mouse drag;  sdrag:… the same with Shift held
//   move:x,y  mclick:x,y    move / click the mouse
//   type:text               type text
//   wait:seconds            pause
//   shot:name               screenshot to <out>/<name>.png
//   play:seconds            play for N s and report canvas draws/s and frame fetches/s
//   eval:js                 evaluate JS in the page and print the result
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import electronPath from 'electron'
import { chromium } from 'playwright'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { options, steps } = parseArgs(process.argv.slice(2), {
  folder: resolve(appDir, '..'),
  out: join(appDir, 'test-results', 'smoke'),
  port: '9333'
})
const runSteps = steps.length ? steps : ['setup:0', 'shot:setup', 'play:3', 'shot:playing']
mkdirSync(options.out, { recursive: true })

// The app must run as Electron even when the calling shell sets ELECTRON_RUN_AS_NODE.
const sandbox = mkdtempSync(join(tmpdir(), 'tramus-smoke-'))
const env = {
  ...process.env,
  TRAMUS_HIDDEN_WINDOW: '1',
  TRAMUS_CONFIG_DIR: join(sandbox, 'config') // engine settings, templates, batches
}
delete env.ELECTRON_RUN_AS_NODE
// Launch with the app *directory* (as `electron .` does) so dev engine resolution works.
// A separate --user-data-dir also means a separate single-instance lock.
const app = spawn(
  electronPath,
  [
    appDir,
    `--remote-debugging-port=${options.port}`,
    `--user-data-dir=${join(sandbox, 'profile')}`
  ],
  { env }
)
app.stderr.on('data', (chunk) => {
  const text = String(chunk)
  if (/error|exception|traceback/i.test(text) && !/objc|AVF|DevTools/.test(text)) {
    console.log('[main]', text.trim().slice(0, 500))
  }
})

let pageErrors = 0
const browser = await retry(() => chromium.connectOverCDP(`http://127.0.0.1:${options.port}`))
const page = await retry(async () => {
  const found = browser.contexts()[0]?.pages()[0]
  if (!found) throw new Error('no page yet')
  return found
})
page.on('pageerror', (error) => {
  pageErrors++
  console.log('[pageerror]', error.message)
})
page.on('console', (message) => {
  if (message.type() === 'error') console.log('[console.error]', message.text().slice(0, 300))
})
await page.waitForTimeout(3000) // engine start + first render

const api = (path, init) =>
  page.evaluate(
    async ([path, init]) => {
      const { baseUrl, token } = await window.tramus.engine.getConnection()
      const headers = { 'X-Tramus-Token': token, 'Content-Type': 'application/json' }
      return (await fetch(baseUrl + path, { ...init, headers })).json()
    },
    [path, init]
  )
const navigate = async (hash, settleMs = 3000) => {
  await page.evaluate((h) => (location.hash = h), hash)
  await page.waitForTimeout(settleMs)
}
const videoId = async (index) => {
  const body = JSON.stringify({ path: options.folder })
  const library = await api('/api/library/open', { method: 'POST', body })
  return library.videos[index].id
}
const points = (arg) => arg.split(',').map(Number)
const drag = async ([x1, y1, x2, y2]) => {
  await page.mouse.move(x1, y1)
  await page.mouse.down()
  await page.mouse.move(x2, y2, { steps: 8 })
  await page.mouse.up()
}

const handlers = {
  library: () => navigate(`#/library?folder=${encodeURIComponent(options.folder)}`),
  setup: async (arg) => navigate(`#/videos/${await videoId(Number(arg || 0))}/setup`, 4500),
  review: async (arg) => navigate(`#/videos/${await videoId(Number(arg || 0))}/review`, 4500),
  results: async (arg) => navigate(`#/videos/${await videoId(Number(arg || 0))}/results`, 4500),
  hash: (arg) => navigate(arg),
  key: async (arg) => {
    await page.keyboard.press(arg)
    await page.waitForTimeout(1200)
  },
  click: async (arg) => {
    await page.getByText(arg).first().click()
    await page.waitForTimeout(1500)
  },
  hover: async (arg) => {
    await page.getByText(arg).first().hover()
    await page.waitForTimeout(800)
  },
  drag: async (arg) => {
    await drag(points(arg))
    await page.waitForTimeout(1200)
  },
  sdrag: async (arg) => {
    await page.keyboard.down('Shift')
    await drag(points(arg))
    await page.keyboard.up('Shift')
    await page.waitForTimeout(1200)
  },
  move: async (arg) => {
    const [x, y] = points(arg)
    await page.mouse.move(x, y, { steps: 4 })
    await page.waitForTimeout(800)
  },
  mclick: async (arg) => {
    const [x, y] = points(arg)
    await page.mouse.click(x, y)
    await page.waitForTimeout(1000)
  },
  type: (arg) => page.keyboard.type(arg),
  wait: (arg) => page.waitForTimeout(Number(arg) * 1000),
  shot: async (arg) => {
    await page.screenshot({ path: join(options.out, `${arg}.png`) })
    console.log('screenshot', join(options.out, `${arg}.png`))
  },
  play: async (arg) =>
    console.log('playback', JSON.stringify(await measurePlayback(Number(arg || 3)))),
  eval: async (arg) => console.log(await page.evaluate(arg))
}

/** Plays for `seconds` and reports how many frames were drawn and fetched per second. */
async function measurePlayback(seconds) {
  await page.evaluate(() => {
    performance.setResourceTimingBufferSize(10_000)
    performance.clearResourceTimings()
    window.__smokeDraws = 0
    const draw = CanvasRenderingContext2D.prototype.drawImage
    if (!window.__smokeHooked) {
      window.__smokeHooked = true
      CanvasRenderingContext2D.prototype.drawImage = function (...args) {
        window.__smokeDraws++
        return draw.apply(this, args)
      }
    }
  })
  await page.keyboard.press('Space')
  await page.waitForTimeout(seconds * 1000)
  await page.keyboard.press('Space')
  return page.evaluate((seconds) => {
    const fetches = performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.includes('/frames/')).length
    return {
      canvasDrawsPerS: +(window.__smokeDraws / seconds).toFixed(1),
      frameFetchesPerS: +(fetches / seconds).toFixed(1)
    }
  }, seconds)
}

try {
  for (const step of runSteps) {
    const [name, ...rest] = step.split(':')
    const handler = handlers[name]
    if (!handler) throw new Error(`Unknown step "${name}"`)
    await handler(rest.join(':'))
  }
} finally {
  await browser.close().catch(() => {})
  app.kill()
  rmSync(sandbox, { recursive: true, force: true })
}
if (pageErrors > 0) {
  console.error(`${pageErrors} page error(s)`)
  process.exit(1)
}

function parseArgs(argv, defaults) {
  const parsed = { ...defaults }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i].match(/^--(folder|out|port)$/)
    if (flag) parsed[flag[1]] = argv[++i]
    else rest.push(argv[i])
  }
  return {
    options: { ...parsed, folder: resolve(parsed.folder), out: resolve(parsed.out) },
    steps: rest
  }
}

async function retry(fn, attempts = 60, delayMs = 500) {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i >= attempts) throw error
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}
