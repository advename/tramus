# Tramus (app/)

Electron + React 19 + TypeScript (strict) + MUI v7 desktop UI for the Tramus mouse-tracking
engine. Built with [electron-vite](https://electron-vite.org). See `../docs/architecture.md` for
the full system contract (processes, HTTP API, domain model) and `../designs/` for the visual
design this implements.

## Structure

```
app/
├── electron.vite.config.ts   electron-vite (main/preload/renderer build config)
├── electron-builder.yml      packaging (mac dmg, win nsis, linux AppImage)
├── tsconfig.json             references node + web tsconfigs
├── tsconfig.node.json        main/preload/shared — strict, Node types
├── tsconfig.web.json         renderer — strict, DOM types
├── eslint.config.js          flat config: typescript-eslint + react-hooks
├── scripts/gen-api.mjs       regenerates api/schema.d.ts from the engine's OpenAPI schema
├── resources/engine/         PyInstaller-built engine goes here for packaging (gitignored)
└── src/
    ├── shared/ipc.ts         IPC channel names + payload types, used by all three processes
    ├── main/                 Electron main process
    │   ├── index.ts             window creation, single-instance lock, app lifecycle
    │   ├── engine.ts            EngineProcess: spawns/waits-for/kills the Python engine
    │   └── ipc.ts                ipcMain.handle registrations
    ├── preload/
    │   ├── index.ts             contextBridge: exposes window.tramus
    │   └── global.d.ts          declares window.tramus for the renderer
    └── renderer/
        ├── index.html
        └── src/
            ├── main.tsx          entry point: imports fonts/icons, mounts <App>
            ├── app/              App.tsx, providers.tsx, routes.tsx, AppShell.tsx
            ├── theme/            design tokens → MUI theme (dark/light)
            ├── api/              typed client, `types.ts` (API type aliases), shared `queries/`,
            │                     query keys, WebSocket events, EngineProvider
            ├── components/       shared UI: Symbol, Kbd, ShortcutTooltip, StatusChip, NotificationHost, …
            ├── lib/              time formatting, keyboard shortcuts, platform, sx helper
            ├── stores/           app-wide Zustand stores (notifications, current folder)
            └── features/
                ├── start/ library/ templates/ batch/ settings/
                └── workspace/    the per-video Setup → Track → Review → Results screen
                    ├── WorkspacePage.tsx  layout, step routing, page-wide shortcuts
                    ├── data/       session queries + editors (optimistic, ordered, undoable)
                    ├── state/      workspaceStore: UI state (frame, tools, selection, …)
                    ├── stage/      frame canvas + SVG overlay, zone/arena/measure editing
                    ├── playback/   clock, prefetch pipeline, bitmap loading
                    ├── timeline/   transport, trial handles, lanes, exclusions, range popover
                    ├── inspector/  per-step side panel (setup sections, flags, history)
                    ├── results/    summary, events, crossings (rules + matrix)
                    ├── topbar/ dialogs/
                    └── lib/        pure helpers (geometry, units, flags, crossings, …) + tests
```

## Scripts

| Script                            | What it does                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run dev`                     | Starts the app (electron-vite dev server + Electron), with HMR for the renderer.                       |
| `npm run build`                   | Builds main/preload/renderer into `out/`.                                                              |
| `npm run typecheck`               | `tsc --noEmit` for both the node (`main`/`preload`/`shared`) and web (`renderer`) TypeScript projects. |
| `npm run lint`                    | ESLint (flat config), zero warnings allowed.                                                           |
| `npm test`                        | Vitest unit tests for pure helpers (`features/**/lib`, `playback/`).                                    |
| `npm run smoke`                   | Drives the real app in a hidden window: screenshots + playback frame rates (see below).                |
| `npm run format` / `format:check` | Prettier.                                                                                              |
| `npm run gen:api`                 | Regenerates `src/renderer/src/api/schema.d.ts` from the engine's live OpenAPI schema (see below).      |
| `npm run dist`                    | `build` + `electron-builder` — produces installers in `release/`.                                      |

`npm run dev` and `npm run dist` need the engine's virtualenv (`engine/.venv`) or a packaged
engine binary — see `docs/architecture.md` §1 and `src/main/engine.ts`'s command resolution
(`TRAMUS_ENGINE_CMD` env var overrides both).

## Adding a feature screen

1. Build the screen under `src/renderer/src/features/<name>/`, exporting a component from
   `index.tsx` (e.g. `export function LibraryScreen()`).
2. Wire it into `src/renderer/src/app/routes.tsx` — it renders as a child of `<AppShell>`, so it
   only needs its own content, not nav-rail/window chrome.
3. Reach for the shared building blocks instead of rebuilding them:
   - `theme/createAppTheme.ts`'s palette augmentation: `palette.zones[0..7]`, `palette.trail`,
     `palette.detection`, `palette.canvas`, `palette.surface.{raised,hover,lineStrong,dim}`, plus
     the `mono` typography variant (`<Typography variant="mono">` or `<TimeText>`).
   - `components/`: `Symbol` (Material Symbols icon), `Kbd`, `ShortcutTooltip`, `StatusChip`,
     `TimeText`, `EmptyState`, `ConfirmDialog`.
   - `lib/time.ts` for all time/date formatting, `lib/shortcuts.ts`'s `useShortcut`/
     `formatShortcut` for keyboard shortcuts (`mod` = Ctrl/Cmd), `lib/sx.ts`'s `extendSx` if your
     component both applies its own `sx` and forwards a caller's.
   - `api/client.ts`'s `getApiClient()` (typed against `api/schema.d.ts`) + `unwrap()` for HTTP
     calls, `api/queryKeys.ts` for TanStack Query keys, `api/urls.ts` for frame/thumbnail image
     URLs, `api/events.ts`'s `useEngineEvents()` (already mounted once in `AppShell`) for
     live job/session updates.
4. API types: import them from `api/types.ts` only (aliases of the generated schema, already
   shaped the way openapi-fetch returns them). Hooks used by several features go in
   `api/queries/`; feature-only hooks stay in the feature.
5. UI-only state that doesn't belong in TanStack Query (e.g. "which tool is selected") goes in a
   Zustand store: feature-local (`features/<name>/state/`) or app-wide (`stores/`).

## `api/schema.d.ts`

Generated from the engine's OpenAPI schema by `npm run gen:api`. Never hand-edit it. The flow
for any API or data-model change is: change the engine's Pydantic models or routes, then run
`npm run gen:api`, then fix the type errors in the UI.

## UI smoke test

`npm run build && npm run smoke` launches the built app with a hidden window
(`TRAMUS_HIDDEN_WINDOW=1`) in a throwaway profile and engine config dir, so it never touches
real settings, templates or batches and works while `npm run dev` is running. It connects over
the Chrome DevTools Protocol with Playwright, and runs
a list of steps. It opens a folder's first video, screenshots Setup, plays for a few seconds and
reports canvas draws per second. Screenshots go to `test-results/smoke/`. Custom steps:
`node scripts/ui-smoke.mjs --folder <videos> setup:0 key:Space wait:2 shot:playing` (see the
header of the script for all step kinds).

## Theme

Design tokens live in `theme/tokens.ts` as oklch strings (dark + light, from
`designs/Tramus Design.dc.html` §9) and are converted to sRGB via `theme/color.ts` (culori) —
MUI's own colour helpers (`alpha`, contrast checks, …) can't parse oklch. `theme/
createAppTheme.ts` builds the MUI theme and augments `Palette`/`PaletteOptions` with `zones`,
`trail`, `detection`, `canvas`, `surface`, and augments `TypographyVariants` with `mono`.
`theme/ThemeProvider.tsx` resolves dark/light/system from the engine's `AppSettings.theme`
(falling back to dark) and applies it with `CssBaseline`.

## Troubleshooting

- **`npm run dev` prints a Node error like "does not provide an export named 'BrowserWindow'"** —
  the shell has `ELECTRON_RUN_AS_NODE=1` set (some editor/tool environments set it), so Electron
  runs as plain Node. Unset it: `env -u ELECTRON_RUN_AS_NODE npm run dev`.
- **The window stays on "Starting the Tramus engine…"** — check the terminal for `[engine]` lines;
  the dev engine is `../engine/.venv` (create it per the root README). The first launch of a
  freshly installed build can take ~30 s while the OS scans the bundled engine.
- **Preload changes** — the preload is built as CommonJS (`out/preload/index.cjs`) because
  Electron can't load ES modules in a sandboxed preload.

## Known gaps

- No app icon yet (`build/` is empty), so `electron-builder` uses its default icon.
- Zones can be edited but not *added* from Review's Zones tab (drawing tools are Setup-only).
- Polygons: vertices can be dragged, but not inserted/removed by double-clicking an edge.
- Shapes can be drawn partly outside the video frame (harmless for results; not clamped).
- Templates can't be imported/exported as files from the UI yet (they live in the user config
  directory, e.g. `~/Library/Application Support/Tramus/templates/` on macOS).
- Crossing markers on the timeline use one colour for all rules; the crossing matrix hasn't been
  tried with many (6+) zones.
