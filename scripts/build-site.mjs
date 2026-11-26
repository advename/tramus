#!/usr/bin/env node
// Builds the website (site/) into a deployable folder, stamped with the latest published release:
// its version, the four installer links and file names, the citation year. The Website workflow
// (.github/workflows/pages.yml) runs this on every change to site/ and whenever a release is
// published, so the download buttons always point at the newest installers.
// The page itself makes no requests to other servers (fonts are self-hosted, CSP forbids it).
//
// Usage: node scripts/build-site.mjs [outDir=_site]
//   GITHUB_REPOSITORY  owner/repo to read releases from (default advename/tramus; set in Actions)
//   GITHUB_TOKEN       optional, avoids the anonymous API rate limit
//   SITE_URL           public URL of the site, for canonical/Open Graph links
//                      (Actions passes the Pages URL, so a custom domain is picked up automatically)
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, process.argv[2] ?? '_site')
const repo = process.env.GITHUB_REPOSITORY || 'advename/tramus'
const siteUrl = (process.env.SITE_URL || `https://${repo.split('/')[0]}.github.io/${repo.split('/')[1]}`).replace(/\/?$/, '/')
const repoUrl = `https://github.com/${repo}`

// Installer file names come from electron-builder's artifactName: Tramus-<version>-<os>-<arch>.<ext>
const PLATFORMS = {
  MAC_ARM64: '-mac-arm64.dmg',
  MAC_X64: '-mac-x64.dmg',
  WIN_X64: '-win-x64.exe',
  LINUX_X64: '-linux-x86_64.AppImage',
}

function fail(message) {
  console.error(`build-site: ${message}`)
  process.exit(1)
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

async function latestRelease() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'tramus-site-build' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers })
  if (!res.ok) fail(`couldn't read the latest release of ${repo} (HTTP ${res.status}). Is one published?`)
  return res.json()
}

const release = await latestRelease()
const version = release.tag_name.replace(/^v/, '')
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`latest release tag "${release.tag_name}" isn't vMAJOR.MINOR.PATCH`)
const year = new Date(release.published_at).getUTCFullYear()

const tokens = {
  VERSION: version,
  SITE_URL: siteUrl,
  CITATION: `The Tramus contributors. (${year}). Tramus (Version ${version}) [Computer software]. ${repoUrl}`,
}
for (const [key, suffix] of Object.entries(PLATFORMS)) {
  const matches = release.assets.filter((a) => a.name.endsWith(suffix))
  if (matches.length !== 1)
    fail(`release ${release.tag_name} has ${matches.length} assets ending in "${suffix}", expected 1`)
  tokens[`DL_${key}`] = matches[0].browser_download_url
  tokens[`FILE_${key}`] = matches[0].name
}

const description = readFileSync(join(root, 'site/index.html'), 'utf8').match(/<meta name="description" content="([^"]*)">/)[1]
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Tramus',
  description,
  url: siteUrl,
  applicationCategory: 'ScientificApplication',
  operatingSystem: 'Windows 10, Windows 11, macOS 14 or later, Linux',
  softwareVersion: version,
  license: 'https://opensource.org/licenses/MIT',
  downloadUrl: `${repoUrl}/releases/latest`,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
}

rmSync(outDir, { recursive: true, force: true })
cpSync(join(root, 'site'), outDir, { recursive: true })

for (const file of readdirSync(outDir).filter((f) => f.endsWith('.html'))) {
  const path = join(outDir, file)
  let html = readFileSync(path, 'utf8')
  html = html.replace('__JSON_LD__', () => JSON.stringify(jsonLd).replace(/</g, '\\u003c'))
  html = html.replace(/__([A-Z][A-Z0-9_]*)__/g, (match, key) => (key in tokens ? escapeHtml(tokens[key]) : match))
  const left = html.match(/__[A-Z][A-Z0-9_]*__/g)
  if (left) fail(`${file} still contains ${[...new Set(left)].join(', ')}`)
  writeFileSync(path, html)
}

console.log(`build-site: ${outDir} — Tramus ${version}, ${siteUrl}`)
