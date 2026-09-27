/** Path helpers for the export save dialog — no Node `path` module in the renderer. */

function splitPath(fullPath: string): { dir: string; base: string } {
  const index = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'))
  if (index === -1) return { dir: '', base: fullPath }
  return { dir: fullPath.slice(0, index), base: fullPath.slice(index + 1) }
}

function stem(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot <= 0 ? fileName : fileName.slice(0, dot)
}

/** `("/a/b/M12.mp4", "xlsx")` → `"/a/b/M12.xlsx"` — the export's default save location. */
export function defaultExportPath(videoPath: string, extension: 'xlsx' | 'csv'): string {
  const { dir, base } = splitPath(videoPath)
  const name = `${stem(base)}.${extension}`
  if (!dir) return name
  const separator = dir.includes('\\') && !dir.includes('/') ? '\\' : '/'
  return `${dir}${separator}${name}`
}
