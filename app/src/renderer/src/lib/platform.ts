/**
 * Renderer-side platform detection. `window.tramus.app.getInfo()` is the authoritative source
 * (it reads `process.platform` in the main process) but is async; this is a synchronous best
 * guess for the very first render, before that promise resolves, using the same UA sniff
 * Chromium/Electron recommend now that `navigator.platform` is deprecated.
 */
export function isMac(): boolean {
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform
  if (platform) return platform.toLowerCase() === 'macos'
  return /mac/i.test(navigator.userAgent)
}
