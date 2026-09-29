# Tramus — notes for AI coding sessions

Desktop app that tracks a single mouse in top-down lab videos and measures time in user-drawn
zones (PhD research tool, open source). Python engine (`engine/`) + Electron/React/MUI app
(`app/`). **`docs/architecture.md` is the contract** (domain, algorithms, API, frontend rules):
read the relevant section before changing a boundary, and update it in the same change.

## Commands
```bash
# engine (venv + pip; no uv)
cd engine && .venv/bin/python -m pytest tests && .venv/bin/ruff check src tests && .venv/bin/ruff format --check src tests
# app
cd app && npm run typecheck && npm run lint && npm test && npm run build && npx prettier --check src
npm run gen:api          # after ANY engine model/route change — never hand-edit api/schema.d.ts
npm run dev              # engine starts from engine/.venv automatically
npm run build && npm run smoke   # real app, hidden window: screenshots + playback fps (scripts/ui-smoke.mjs)
node scripts/build.mjs   # (repo root) PyInstaller engine + electron-builder installer for this OS
```

## How changes flow
1. Data or API change: edit the Pydantic models in `engine/src/tramus_engine/domain/` or the
   routes, then run `npm run gen:api`, then fix the UI type errors. Import API types in the UI
   only from `app/src/renderer/src/api/types.ts`.
2. The engine owns all domain logic (tracking, corrections, zone membership, results,
   crossings, exclusions). The UI renders what the API returns and never re-implements it.
3. Document edits go through the workspace editors (`features/workspace/data/editors.ts`).
   They are optimistic, ordered and undoable: preview during a gesture, one `commit` on release.
4. Pure logic goes in `lib/` with Vitest tests (app) or `analysis/`/`tracking/` with pytest
   (engine).

## Gotchas (each one cost real debugging time)
- The shell here may export `ELECTRON_RUN_AS_NODE=1`, which makes Electron run as plain Node
  (error: "does not provide an export named 'BrowserWindow'"). Unset it with
  `env -u ELECTRON_RUN_AS_NODE …`.
- Launch Electron with the **app directory**, not `out/main/index.js`. Otherwise
  `app.getAppPath()` is wrong and the dev engine isn't found.
- The app holds a single-instance lock. A leftover hidden Electron makes new launches quit
  silently. Kill the real binary (`node_modules/electron/dist/…/Electron`), not the `.bin`
  wrapper.
- `TRAMUS_HIDDEN_WINDOW=1` plus `--remote-debugging-port` gives an invisible window you can
  drive with Playwright `connectOverCDP`. `ui-smoke.mjs` does this in an isolated
  `--user-data-dir` and `TRAMUS_CONFIG_DIR`, so it never collides with the user's running app
  and never writes to their real config. Batch runs still write sidecars next to the videos,
  so delete them afterwards.
- TanStack Query `select` must be a module-level function. An inline one rebuilds data every
  render and restarts effects that depend on it (this once broke the playback clock).
- Never close an `ImageBitmap` before React commits its replacement ("image source is
  detached" crash). Never abort an in-flight frame fetch just because a newer frame is wanted.
- The playback clock keeps a running time. Re-deriving time from the current frame loses
  sub-frame progress, so 1× playback stalls.
- Time is always frame timestamps (variable frame rate), never `frame / fps`. Shapes are in
  full-resolution video pixels.
- Engine subprocesses (tracking pool, manager) must die with the engine: see `exit_with_parent`
  and `JobManager.shutdown`.
- The preload must be CommonJS (`index.cjs`): sandboxed preloads can't be ES modules.

## Data and privacy
`Sample1.mp4` and `Sample2.mp4` in the repo root are real lab recordings (1280×1024, ~25 fps
with variable timing, 5:10, three-chamber box). They are gitignored and must never be committed.
Neither are `*.tramus.json` sidecars written next to them during testing; delete those
afterwards. Engine settings and templates live in the OS user config dir
(`~/Library/Application Support/Tramus` on macOS); tests use `TRAMUS_CONFIG_DIR`.

## Design
`designs/` holds the original Claude Design source (visual baseline). Later features (Measure
tool, excluded periods, crossings) follow its visual language but aren't in it.
