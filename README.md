# Tramus

Tramus tracks a single mouse in top-down lab videos and measures how long it spends in zones you
draw — e.g. the three chambers of a sociability box. It runs on Windows, macOS and Linux, works
offline, and keeps every analysis in a JSON file next to the video so results are reproducible.

**Workflow:** open a folder → pick a video → draw the arena and zones (optionally measure a known
distance so sizes show in cm), set the trial start/end and exclude disturbed periods → **Track** →
review at 4× with a movement trail and fix flagged frames (hotkeys: A accept, P set position, ]
next) → results → export to Excel/CSV. A setup can be saved as a template and applied to a whole
batch of videos recorded with the same camera.

**Results:** time per zone (as a share of the analysed time), every zone visit, and **zone
crossings**: counts for from→to rules you define (e.g. Left → Center, or "any zone") plus a full
from×to matrix, with every crossing's time.

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
* **Excluded periods** (e.g. a hand in the arena) are cut out of the analysis only: the whole
  video stays tracked, so exclusions can change without re-tracking.
* **Crossings** count X→Y when the mouse leaves X and the next zone it enters is Y. Time on
  unzoned floor or out of sight in between doesn't break a crossing; an excluded period does.

See [docs/architecture.md](docs/architecture.md) for the design, algorithms and API.

## Privacy

Tramus processes everything locally. Videos are decoded, tracked and analysed on your machine by
the bundled Python engine (a local-only child process — see `docs/architecture.md` §1); nothing is
uploaded, and there's no telemetry or analytics. Analysis is written as a `*.tramus.json` file next
to each video; app settings and templates live in the OS user config dir (e.g.
`~/Library/Application Support/Tramus` on macOS). There's no auto-updater and no crash reporter —
updates and support are manual.

### macOS folder permissions

The first time you open a folder under Desktop, Documents, Downloads, or a removable/network
volume, macOS asks for permission — the usage text explains what it's for and that it stays
local. If you pick **Don't Allow**, macOS remembers that answer and every later attempt fails
with "Operation not permitted" (Tramus shows this as a "can't access this folder" screen with a
shortcut to fix it). To fix it:

* **System Settings → Privacy & Security → Files and Folders** → find Tramus → enable the folder
  (or the broader location it's under), then try again in Tramus.
* To make macOS ask again from scratch (e.g. while testing), run
  `tccutil reset All org.tramus.app` and relaunch.
* Unsigned builds (no Apple Developer ID) may be asked again after every rebuild/update, because
  macOS ties the permission to the exact binary — this goes away once the app is signed.

## Repository

| Path | What |
|---|---|
| `engine/` | Python engine: decoding (PyAV), tracking (OpenCV), analysis, sidecar files, export, local HTTP API (FastAPI), CLI |
| `app/` | Desktop app: Electron + React + MUI |
| `docs/` | Architecture and contracts |
| `designs/` | UI design source (Claude Design): the visual baseline; later features follow its style |
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
npm run build && npm run smoke              # drives the real app (hidden window): screenshots + playback fps
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
