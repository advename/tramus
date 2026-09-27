# Tramus

Tramus tracks a single mouse in top-down lab videos and measures how long it spends in zones you
draw — e.g. the three chambers of a sociability box. It runs on Windows, macOS and Linux, works
offline, and keeps every analysis in a JSON file next to the video so results are reproducible.

**Workflow:** open a folder → pick a video → draw the arena and zones, set the trial start/end →
**Track** → review at 4× with a movement trail and fix flagged frames → results (time per zone and
every zone visit) → export to Excel/CSV. A setup can be saved as a template and applied to a whole
batch of videos recorded with the same camera.

## How it works

* **Detection**: background subtraction. A median of ~60 frames gives an empty-arena image; the
  mouse is whatever differs from it inside the arena. The tail is removed and the body is modelled
  as an ellipse. No training data and no GPU needed; typically 10–20× faster than real time.
* **In a zone** = at least 50 % (configurable) of the body is inside. The mouse stays in a zone
  until at least 50 % of it is in another zone or on unzoned floor, so doorways don't cause flicker.
* **Time** comes from each frame's timestamp (recordings are often variable frame rate). Clock
  times are stored in UTC from the video's metadata and shown in your local time zone.
* **Corrections** are stored as a log on top of the raw tracking, so every change is traceable
  and included in exports.

See [docs/architecture.md](docs/architecture.md) for the design, algorithms and API.

## Repository

| Path | What |
|---|---|
| `engine/` | Python engine: decoding (PyAV), tracking (OpenCV), analysis, sidecar files, export, local HTTP API (FastAPI), CLI |
| `app/` | Desktop app: Electron + React + MUI |
| `docs/` | Architecture and contracts |
| `designs/` | UI design source (Claude Design) |
| `scripts/` | Build helpers |

## Development

Requirements: Python ≥ 3.12, Node ≥ 20.

```bash
# engine
cd engine
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"          # Windows: .venv\Scripts\pip
.venv/bin/python -m pytest

# app (starts the engine from engine/.venv automatically)
cd ../app
npm install
npm run gen:api                            # regenerate API types after engine API changes
npm run dev
npm run typecheck && npm run lint && npm test
```

Headless use: `engine/.venv/bin/tramus-engine track <folder> --template <id>` and
`tramus-engine export <folder> --out results.xlsx`.

## Building installers

```bash
node scripts/build.mjs                      # engine (PyInstaller) + app (electron-builder)
```

Installers must be built on the target OS (PyInstaller can't cross-compile): macOS on a Mac,
Windows on Windows (or GitHub Actions), Linux on Linux or in Docker. Output lands in `app/release/`.

## Extending

Trackers are plugins: implement the `Tracker` protocol (`tramus_engine.tracking.base`) and
register it under the `tramus.trackers` entry-point group in your package — e.g. a DeepLabCut-based
tracker can live in its own package without making the default installer heavier.

## License

MIT
