# Tramus architecture

Tramus tracks a single mouse in top-down lab videos and measures how long it spends in zones the
user draws. This document is the contract between the parts of the codebase. Read it before
changing a boundary (domain models, module interfaces, API, sidecar format).

## 1. Processes

```
┌──────────────── Electron main (app/src/main) ────────────────┐
│ window · native dialogs · starts/stops the engine process     │
│  ┌──────── Renderer: React + MUI (app/src/renderer) ───────┐  │
│  │ Library · Workspace (Setup/Track/Review/Results) · Batch │  │
│  └──────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────┼─────────────────────────────────┘
          HTTP /api/* (JSON, JPEG, PNG)   +   WebSocket /api/events
┌─────────────────────────────┴─────────────────────────────────┐
│ Python engine (engine/src/tramus_engine) — FastAPI on 127.0.0.1│
│ video decoding · tracking · analysis · sidecar files · export  │
│ tracking runs in worker processes (one per video)              │
└────────────────────────────────────────────────────────────────┘
```

* The **engine owns all domain logic** (tracking, corrections, zone membership, results,
  persistence). The UI never re-implements it; it renders what the API returns.
* The engine holds one in-memory **session** per open video (the draft `AnalysisDocument`).
  Edits go to the session; **Save** writes the sidecar. Batch runs save directly.
* The engine is also a **CLI** (`tramus-engine track …`) so batches can run headless.
* Handshake: Electron starts `tramus-engine serve --port 0 --token <random>`. The engine prints
  one JSON line to stdout: `{"event": "ready", "port": 53124}`. Every request carries the token
  (`X-Tramus-Token` header, or `?token=` for `<img src>` / WebSocket URLs). The engine exits
  when its stdin closes (Electron died) so no orphan processes are left behind.

## 2. Repository layout

```
tramus/
├── docs/architecture.md        this file
├── designs/                    Claude Design source of the UI (reference only)
├── engine/                     Python package `tramus_engine`
│   ├── pyproject.toml
│   ├── src/tramus_engine/
│   │   ├── domain/             Pydantic models — the contract (sidecar + API + TS types)
│   │   ├── video/              probing, fingerprint, frame-accurate reader        [core]
│   │   ├── imaging/            adjustments, shape rasterising, image encoding     [core]
│   │   ├── tracking/           tracker plugin API, background subtraction, flags  [core]
│   │   ├── analysis/           corrections, zone membership, results, history     [core]
│   │   ├── storage/            sidecar files, templates, settings                  [app]
│   │   ├── export/             xlsx / csv writers                                  [app]
│   │   ├── services/           application layer used by API and CLI               [app]
│   │   ├── api/                FastAPI app, routes, WebSocket event hub            [app]
│   │   └── cli.py              `tramus-engine serve | track | export | openapi`    [app]
│   └── tests/
├── app/                        Electron + React (electron-vite)
│   └── src/{main,preload,renderer}
└── scripts/                    cross-platform build helpers
```

Layering rule: `domain` ← `video`/`imaging` ← `tracking`/`analysis` ← `storage`/`export` ←
`services` ← `api`/`cli`. Lower layers never import higher ones. `core` modules are pure
computation (no FastAPI, no file-system state beyond reading videos).

## 3. Conventions

* **Coordinates**: video pixels of the full-resolution frame, origin top-left, y down. Shapes,
  track positions and corrections all use this space. Processing may downscale internally but
  always converts back.
* **Frames and time**: frame index `i` is the i-th frame in *presentation* order. Frame time
  `t[i]` = `(pts[i] − pts[0]) × time_base` in seconds ("video time"). Never compute time as
  `i / fps` — recordings are variable frame rate (the samples jitter between 38 and 42 ms).
  Frame duration `d[i] = t[i+1] − t[i]`; the last frame uses the median duration.
* **Wall-clock time**: `recorded_at` (UTC, from container `creation_time`, treated as the
  recording start) + video time. Stored and sent as UTC ISO-8601 with `Z`. The UI converts to
  the computer's local time zone for display; exports contain both UTC and local columns.
* **JSON** is snake_case everywhere (sidecar, API, generated TS types).
* **IDs**: `new_id()` (12 hex chars) for zones, corrections, jobs, templates. Video IDs are
  `sha1(absolute path)[:16]`. Flag IDs are deterministic: `f"{reason}-{frame_start}"`.

## 4. Domain (engine/src/tramus_engine/domain)

The Pydantic models are the single source of truth. Key ones:

| Model | Purpose |
|---|---|
| `Setup` | arena `Shape`, `zones`, `ImageAdjustments`, `DetectionSettings`, `AnalysisSettings`, `TrialWindow`, `TemplateRef`, `Calibration` |
| `Track` | raw per-frame body ellipse, column-wise (`t, x, y, semi_major, semi_minor, angle_deg, area_px, status`) |
| `Flag` | suspicious frame range found after tracking (`not_found`, `sudden_jump`, `unusual_size`) |
| `Correction` | `set_position`, `mark_hidden`, `interpolate`, `accept_flag` — applied in list order on top of the raw track |
| `AnalysisDocument` | the sidecar: video info, setup, raw track, flags, corrections, setup changes, results snapshot |
| `Results` | summary rows (per zone + "No zone" + "Not visible") and zone visits |
| `Template`, `AppSettings`, `Job` | templates, preferences, background work |

The raw track is never modified; corrections are an ordered, timestamped log. That keeps every
change traceable and makes undo trivial (drop the last correction).

`Setup.calibration` (`Calibration | None`) is an optional scale reference: a line `(x1, y1) →
(x2, y2)` in video px with a known real-world `length_mm`, plus a derived `mm_per_px` property.
It is additive — sidecars without it still load as `calibration: null` — so `SCHEMA_VERSION`
stays 1. `Template` carries the same field; `setup_from_template` scales its endpoints with the
shapes (`length_mm` is a physical quantity and is left unchanged).

## 5. Algorithms

### 5.1 Background-subtraction tracker (`tracking/background_subtraction.py`)

Validated on the sample footage (0 % missed frames on Sample1, ~450 fps incl. decoding on an M-series Mac).

1. **Processing scale** `s = min(1, 640 / max(width, height))`; frames are converted to
   grayscale, image adjustments applied, then resized by `s`.
2. **Image adjustments**: `out = clip((in − 128) · (1 + contrast/100) + 128 + brightness · 1.28)`.
   The same function is used for displayed frames, so what the user sees is what is tracked.
3. **Background**: median of 60 frames sampled evenly across the whole video (seek, don't decode
   everything). The mouse moves, so it drops out of the median. Never use adaptive models
   (MOG2): a mouse that stops moving would fade into the background.
4. **Per frame**: `diff = bg − frame` (polarity `darker`) or `frame − bg` (`lighter`),
   saturating; Gaussian blur 5×5; threshold `T = round(60 − 0.55 · sensitivity)` (sensitivity
   60 → 27); AND with the rasterised arena mask (whole frame if no arena); morphological
   opening with a 7×7 ellipse kernel (removes the tail and noise) then closing 5×5.
5. **Pick the body**: largest external contour with area ≥ `min_mouse_area_px · s²`.
6. **Body ellipse** from the contour's moments: centre = centroid; covariance eigenvalues
   λ₁ ≥ λ₂ give `semi_major = 2√λ₁`, `semi_minor = 2√λ₂` (equal-moment ellipse), angle of the
   major eigenvector. Convert to full-resolution pixels (÷ s, area ÷ s²).
7. Frames without a body get status `missing`.
8. **Post-processing**: gaps of `missing` ≤ 0.5 s between two visible frames are filled by
   linear interpolation (status `interpolated`; ellipse size/angle from the nearer neighbour).
9. The whole video is tracked (not just the trial) so the trial window can change later
   without re-tracking. Flags outside the trial are hidden by the API.

### 5.2 Flags (`tracking/flags.py`) — computed on the raw track after post-processing

* `not_found`: runs of `missing` frames. Detail `"Lost for 0.8 s"`, metric = seconds.
* `sudden_jump`: consecutive visible frames whose centre distance exceeds
  `1.5 × median body length` (`2 × median semi_major`) scaled by `d / median d`.
  Detail `"41 px in 1 frame"`, metric = pixels.
* `unusual_size`: detected frames with `area < 0.4×` or `> 2.5×` the median area.
  Detail `"2.4× typical body size"`, metric = ratio (the most extreme in the run).
* Consecutive flagged frames of the same reason within 3 frames are merged into one flag.

### 5.3 Corrections (`analysis/corrections.py`)

Applied in order to a copy of the raw track to produce the **effective track**:

* `set_position(frame, x, y)`: centre moved to (x, y); ellipse size/angle/area copied from the
  nearest frame (either direction) with status `detected`; status `manual`.
* `mark_hidden(a, b)`: frames a..b → status `hidden`, geometry `None`.
* `interpolate(a, b)`: frames a..b get a linear interpolation between the nearest visible
  frame before `a` and after `b` (anchors outside the range); status `interpolated`. If an
  anchor is missing on one side, copy the other anchor.
* `accept_flag(flag_id)`: no track change.

Flag status: `accepted` if an `accept_flag` targets it; else `fixed` if any other correction's
frame range overlaps the flag's range; else `unresolved`.

### 5.4 Zone membership (`analysis/occupancy.py`) — "most of the body" with hysteresis

* Body = ellipse of the effective track. Sample **96 fixed points** inside the unit disk
  (Fibonacci / sunflower pattern), map them into each frame's ellipse (vectorised over all
  frames), and look them up in rasterised zone masks (full resolution). `f[z]` = share of
  points inside zone z; `f_none` = share of points inside no zone (points outside the frame
  count as "no zone").
* Threshold θ = `setup.analysis.in_zone_threshold` (default 0.5). For each *visible* frame:
  * If the previous frame was visible (continuity):
    enter z when `f[z] ≥ θ`; leave z only when `f[z] < θ` **and** (`f[w] ≥ θ` for some other
    zone w, or `f_none ≥ θ`). This is the lab's rule: the mouse stays in a chamber until at
    least half of it is in another one — or clearly out on unzoned floor.
  * Otherwise (first visible frame of the trial or after a gap): `in[z] = f[z] ≥ θ`; if no
    zone qualifies and `f_none < θ`, assign the zone with the largest `f[z]`.
* Frames with status `missing`/`hidden` are in no zone and count as **Not visible**.
* Zones may overlap; membership is independent per zone.

### 5.5 Results (`analysis/results.py`)

* Trial = `setup.trial` or the whole video. Each frame contributes the overlap of
  `[t[i], t[i] + d[i])` with the trial window.
* Summary rows: one per zone (in setup order) with time and share of trial; then
  **No zone** (visible, in no zone) and **Not visible**. With non-overlapping zones
  `Σ zones + No zone + Not visible = trial duration`.
* Visits: contiguous runs of membership within the trial per zone, numbered chronologically.
  `enter_s`/`exit_s` are clipped to the trial; `exit_s` = end of the last frame inside.
  `enter_utc`/`exit_utc` = `recorded_at + seconds` when `recorded_at` is known.

### 5.6 History (`analysis/history.py`)

Newest first: one entry per correction, one per `setup_changes` item, and "Tracking finished"
(`track.tracked_at`, detail e.g. `"9 000 frames · 7 flags"`). Titles follow the design:
"Set position", "Fill in between", "Mouse not visible", "Accepted flag", "Tracking finished".

## 6. Engine core interfaces (implemented in `video/`, `imaging/`, `tracking/`, `analysis/`)

```python
# video/probe.py
def probe_video(path: Path) -> VideoInfo: ...              # fast: container metadata + packet scan
def read_frame_times(path: Path) -> np.ndarray: ...        # float64 seconds, presentation order

# video/fingerprint.py
def compute_fingerprint(path: Path) -> str: ...            # "sha256:<hex>" of size + 3 × 1 MiB chunks

# video/reader.py
class FrameReader:                                         # frame-accurate, thread-safe (internal lock)
    def __init__(self, path: Path) -> None: ...
    width: int; height: int; frame_count: int
    frame_times: np.ndarray
    def read(self, index: int, *, gray: bool = False) -> np.ndarray: ...   # BGR uint8 or gray uint8
    def iter_frames(self, start: int = 0, stop: int | None = None, *, gray: bool = True
                    ) -> Iterator[tuple[int, np.ndarray]]: ...
    def index_at_time(self, t_s: float) -> int: ...
    def close(self) -> None: ...                           # also a context manager
    # sequential reads decode forward; random reads seek to the previous keyframe

# imaging/adjust.py
def apply_adjustments(image: np.ndarray, adjustments: ImageAdjustments) -> np.ndarray: ...
# imaging/raster.py
def rasterize_shape(shape: Shape, width: int, height: int, scale: float = 1.0) -> np.ndarray: ...  # bool mask
# imaging/encode.py
def resize_max_side(image: np.ndarray, max_side: int | None) -> np.ndarray: ...
def encode_jpeg(image: np.ndarray, quality: int = 82) -> bytes: ...
def encode_png(image: np.ndarray) -> bytes: ...

# tracking/base.py
ProgressCallback = Callable[[int, int], None]              # (frames_done, frames_total)
class CancelToken(Protocol):
    def is_set(self) -> bool: ...                          # threading.Event / multiprocessing Event
class TrackingCancelled(Exception): ...
class TrackingFailed(Exception): ...                       # message is user-facing
@dataclass(frozen=True)
class Observation: x: float; y: float; semi_major: float; semi_minor: float; angle_deg: float; area_px: float
@dataclass(frozen=True)
class DetectionPreview: mask: np.ndarray; observation: Observation | None; scale: float  # mask: uint8 0/255 at processing scale
class Tracker(Protocol):
    id: str; name: str; version: str; supports_gpu: bool
    def track(self, video_path: Path, setup: Setup, *, device: ProcessingDevice,
              progress: ProgressCallback | None = None, cancel: CancelToken | None = None) -> Track: ...
    def preview(self, video_path: Path, frame_index: int, setup: Setup) -> DetectionPreview: ...
# tracking/registry.py  — built-ins + entry points in group "tramus.trackers"
def get_tracker(tracker_id: str) -> Tracker: ...
def available_trackers() -> list[Tracker]: ...
# tracking/flags.py
def detect_flags(track: Track) -> list[Flag]: ...
# tracking/runner.py — what a worker process runs
@dataclass
class TrackingOutcome: track: Track; flags: list[Flag]
def run_tracking(video_path: Path, setup: Setup, *, device: ProcessingDevice,
                 progress: ProgressCallback | None = None, cancel: CancelToken | None = None
                 ) -> TrackingOutcome: ...

# analysis/corrections.py
def apply_corrections(raw: Track, corrections: Sequence[Correction]) -> Track: ...
def flag_statuses(flags: Sequence[Flag], corrections: Sequence[Correction]) -> dict[str, FlagStatus]: ...
# analysis/occupancy.py
def zone_fractions(track: Track, zones: Sequence[Zone], width: int, height: int
                   ) -> tuple[np.ndarray, np.ndarray]: ...     # (frames × zones), (frames,) f_none
def zone_membership(fractions: np.ndarray, outside: np.ndarray, visible: np.ndarray,
                    threshold: float) -> np.ndarray: ...       # bool (frames × zones)
# analysis/results.py
def compute_results(document: AnalysisDocument, effective: Track | None = None) -> Results | None: ...
# analysis/history.py
def build_history(document: AnalysisDocument) -> list[HistoryEntry]: ...
# analysis/status.py
def unresolved_flag_count(document: AnalysisDocument) -> int: ...  # only flags overlapping the trial
def video_status(document: AnalysisDocument | None) -> VideoStatus: ...
```

`video_status`: no document or empty setup → `new`; setup but no track → `set_up`; track with
unresolved flags → `tracked`; no unresolved flags → `reviewed`; `exported_at ≥ updated_at` →
`exported`.

## 7. Storage

* Sidecar: `<video file name>.tramus.json` next to the video (e.g. `M12.mp4.tramus.json`),
  written atomically (temp file + `os.replace`), pretty-printed (indent 2). On load, a
  fingerprint mismatch marks the session `file_changed` (UI shows the amber warning).
* Templates: `<user config dir>/templates/<id>.json`. Settings: `<user config dir>/settings.json`.
  User config dir = `platformdirs.user_config_dir("Tramus")`; overridable with `TRAMUS_CONFIG_DIR`
  (tests use a temp dir).

## 8. HTTP API (all under `/api`, token required)

| Method & path | Body → Response |
|---|---|
| `GET /health` | → `{status, version}` |
| `GET /system` | → `{version, platform, cpu_count, gpu: {name}|null, trackers: [{id, name, supports_gpu}]}` |
| `GET /settings` · `PUT /settings` | `AppSettings` |
| `POST /library/open` | `{path}` → `Library {folder: {path, name, video_count}, videos: VideoSummary[]}` |
| `GET /library/recent` | → `RecentFolder[]` |
| `GET /videos/{id}` | → `VideoSummary {id, path, file_name, size_bytes, duration_s, width, height, recorded_at, status, unresolved_flags, file_changed, has_analysis}` |
| `GET /videos/{id}/frame-times` | → `{t: float[]}` |
| `GET /videos/{id}/frames/{index}` | `?max_side&brightness&contrast&quality` → `image/jpeg` |
| `GET /videos/{id}/thumbnail` | `?max_side=320&t=` → `image/jpeg` (cached) |
| `POST /videos/{id}/detection-preview` | `{frame_index, setup}` → `{mask_png: base64, observation, scale}` |
| `POST /videos/{id}/session` | open (load sidecar or create) → `SessionState` |
| `GET /videos/{id}/session` | → `SessionState` |
| `PUT /videos/{id}/session/setup` | `Setup` → `SessionState` (records a `SetupChange` if tracked) |
| `PUT /videos/{id}/session/corrections` | `Correction[]` → `SessionState` |
| `POST /videos/{id}/session/save` · `/discard` | → `SessionState` |
| `POST /videos/{id}/session/apply-template` | `{template_id}` → `SessionState` |
| `GET /videos/{id}/session/track` | → effective `Track` |
| `GET /videos/{id}/session/flags` | → `FlagView[]` (flag + `status`; only flags overlapping the trial) |
| `GET /videos/{id}/session/results` | → `Results | null` |
| `GET /videos/{id}/session/history` | → `HistoryEntry[]` |
| `POST /videos/{id}/session/track` | start tracking with the session setup → `Job` |
| `GET /jobs` · `GET /jobs/{id}` · `POST /jobs/{id}/cancel` | `Job` |
| `POST /batches/check` | `{template_id, video_ids}` → `BatchCheckItem[] {video_id, file_name, duration_s, width, height, scale_x, scale_y, suggested_trial, warnings[]}` |
| `POST /batches` | `{template_id, items: [{video_id, trial, offset_x, offset_y}]}` → `{id, jobs: Job[]}` |
| `GET /templates` · `POST /templates` · `GET/PUT/DELETE /templates/{id}` | `Template`; create body `{name, video_id}` (from that session's setup) |
| `POST /templates/{id}/apply` | `{video_ids}` → `VideoSummary[]` (writes sidecars) |
| `POST /export` | `{video_ids, format: "xlsx"|"csv", path}` → `{files: string[]}` |
| `WS /events` | server → client: `{"type": "job", "job": Job}`, `{"type": "session", "video_id", "state": SessionState}` |

`SessionState` = `{video: VideoSummary, document: AnalysisDocument without track arrays
(track replaced by track_summary {tracked_at, frame_count, tracker}), dirty, saved_at,
loaded_from_disk, file_changed, active_job: Job | null}`.

Errors: JSON `{detail: str}` with 400 (invalid input), 404 (unknown id), 409 (conflict, e.g.
tracking already running), 500. `detail` is written for the end user.

## 9. Export

`.xlsx` (XlsxWriter) — one workbook for one or many videos:
* **Summary**: video, zone, time (s), share of trial (%), trial start/end, threshold.
* **Visits**: video, #, zone, entered/left (video time s), entered/left (UTC ISO) and (local,
  Excel datetime), duration (s).
* **Track**: per video, frame, t, x, y, status, zones (one 0/1 column per zone).
* **Settings**: app version, tracker + parameters, setup (zones as text, sizes in mm when
  calibrated), recording time, fingerprint, tracked at, reference length (mm), mm per px,
  corrections log.
`.csv`: `<name>_summary.csv` and `<name>_visits.csv` (UTF-8 with BOM, comma separated).
Exporting sets `exported_at` on the document and saves it.

## 10. Frontend (app/)

* **Stack**: Electron + electron-vite, React 19 + TypeScript (strict), MUI v7 + MUI X
  (DataGrid, Charts), TanStack Query (server state), Zustand (UI state), React Router (hash
  router), openapi-typescript + openapi-fetch (typed client generated from the engine's
  OpenAPI schema — never hand-write API types), IBM Plex Sans/Mono and Material Symbols
  bundled locally (the app must work offline).
* **Theme**: tokens from the design (`designs/Tramus Design.dc.html`, section 9) live in
  `renderer/src/theme/tokens.ts` as oklch strings and are converted to sRGB hex for MUI
  (MUI's colour helpers do not parse oklch). Dark is the default; light mirrors it.
* **Layout**: nav rail 52 px · top bar 48 px · inspector 312 px · timeline at the bottom.
  Minimum window 1000 × 700.
* **Video stage**: frames come from `GET /frames/{index}` (JPEG) drawn on a `<canvas>`;
  overlays (arena, zones, handles, trail, heatmap, body outline) are an SVG layer in video
  pixel coordinates (`viewBox="0 0 W H"`). The browser `<video>` element is not used.
* **Playback**: a `requestAnimationFrame` clock advances video time by `dt × speed`, maps it
  to a frame index via binary search in `frame-times`, and requests that frame if it isn't
  already displayed or in flight (frames are dropped when decoding can't keep up).
* **Folders**:
  `renderer/src/{app (shell, routes, providers), theme, api (client, generated schema, query
  hooks, events), components (shared UI), features/<feature> (library, workspace, batch,
  templates, settings), hooks, lib (time/format, shortcuts), stores}`.
