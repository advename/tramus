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
* Handshake: Electron starts `tramus-engine serve --port 0 --token <random> --parent-pid <pid>`.
  The engine prints one JSON line to stdout: `{"event": "ready", "port": 53124}`. Every request carries the token
  (`X-Tramus-Token` header, or `?token=` for `<img src>` / WebSocket URLs). The engine exits
  when its stdin closes (app quit or Electron died), terminating its tracking workers first.
  On Windows it never reads stdin (a pending read on the pipe hangs every child process at
  startup, tracking workers included); it waits on the app process given by `--parent-pid`.
  Workers and the job manager's helper process also exit on their own when the engine process
  disappears (even after a hard kill), so no orphan processes are left behind.

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
| `Setup` | arena `Shape`, `zones`, `ImageAdjustments`, `DetectionSettings`, `AnalysisSettings`, `TrialWindow`, `TemplateRef`, `Calibration`, `exclusions` |
| `Exclusion` | `{id, start_s, end_s, note}` — a period subtracted from the trial before analysis. Per video: lives on `Setup`, not `Template` |
| `CrossingRule` | `{id, from_zone_id, to_zone_id}` — a zone-to-zone transition to count; `None` on either side means "Any zone". Lives on `AnalysisSettings`, so templates carry it |
| `Track` | raw per-frame body ellipse, column-wise (`t, x, y, semi_major, semi_minor, angle_deg, area_px, status`) |
| `UnusualSizeRule` | `{enabled, smaller_than, larger_than, min_duration_s}` — when a size run becomes a flag (defaults 0.4×, 2.5×, 0 s; ranges 0.1–0.9, 1.1–5.0, 0–2). Lives on `AnalysisSettings`, so templates carry it |
| `Flag` | suspicious frame range found after tracking (`not_found`, `sudden_jump`, `unusual_size`) |
| `Correction` | `set_position`, `mark_hidden`, `interpolate`, `accept_flag` — applied in list order on top of the raw track |
| `AnalysisDocument` | the sidecar: video info, setup, raw track, flags, corrections, setup changes, results snapshot |
| `Results` | summary rows (per zone + "No zone" + "Not visible"), zone visits, zone crossings (rule counts/events), the crossing matrix and total distance travelled |
| `Template`, `AppSettings`, `Job` | templates, preferences, background work |

The raw track is never modified; corrections are an ordered, timestamped log. That keeps every
change traceable and makes undo trivial (drop the last correction).

`Setup.calibration` (`Calibration | None`) is an optional scale reference: a line `(x1, y1) →
(x2, y2)` in video px with a known real-world `length_mm`, plus a derived `mm_per_px` property.
It is additive — sidecars without it still load as `calibration: null` — so `SCHEMA_VERSION`
stays 1. `Template` carries the same field; `setup_from_template` scales its endpoints with the
shapes (`length_mm` is a physical quantity and is left unchanged).

`Setup.exclusions` (`list[Exclusion]`, default `[]`) is additive, so `SCHEMA_VERSION` stays 1.
Exclusions are per video: tracking is unchanged, they only affect analysis (§5.5); `Template`
does not carry them, and `setup_from_template` always produces an empty list. `Results` gained
`analysed_duration_s`, `excluded_duration_s`, `crossings` and `crossing_matrix`, and
`SummaryRow.share_of_trial` was renamed to `share_of_analysed` (0–1 of the analysed duration,
not the trial duration) — all additive/defaulted so older sidecars' `results` snapshot (which is
always re-derivable, never read back by the engine) still loads.

`AnalysisSettings.crossing_rules` (`list[CrossingRule]`, default `[]`) is additive. Because it
lives on `AnalysisSettings` rather than `Setup` directly, templates carry it like the other
analysis settings: `Template.analysis` and `setup_from_template`'s `analysis=template.analysis`
already round-trip it. Crossing rules reference zones by id, so id stability across a template
round trip matters — `setup_from_template` copies each template zone's `id` unchanged (only the
`shape` is scaled), and template creation copies `setup.zones` (with their ids) verbatim — so a
rule saved against one video's zones still matches after the template is applied to another.

`Results.distance_mm` (`float | None`, additive) is the total distance the body centre travelled
over the analysed time (§5.5), in mm; `None` without `Setup.calibration` (`analysis/distance.py`,
§5.5). `AppSettings.export_layout` and `ExportRequest.layout` (both `ExportLayout`, `"wide" |
"long"`, default `"wide"`) select the export shape (§9); `AppSettings.export_layout` only seeds
the export dialog's default in the UI, since `ExportRequest.layout` always carries its own
explicit value.

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
* `unusual_size` (rule: `setup.analysis.unusual_size`, off when `enabled` is false): visible
  frames with `area < smaller_than ×` or `> larger_than ×` the median area; merged runs shorter
  than `min_duration_s` (frame timestamps, to the next frame's time) are dropped.
  Detail `"2.4× typical body size"`, metric = ratio (the most extreme in the run).
* Consecutive flagged frames of the same reason within 3 frames are merged into one flag.
* Flag ids are `reason-frame_start`. Flags are a pure function of the raw track and the rule, so
  `document.flags` is a stored snapshot: set at tracking time (worker, batch and CLI all pass
  `setup.analysis.unusual_size`) and re-derived by `SessionManager.put_setup` whenever the rule
  changes — no re-tracking. Ids don't change, so `accept_flag` corrections still match flags
  that survive. History logs "Flag rules changed · Flags recalculated" (coalesced).

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
* **Excluded frames** (`analysis/exclusions.py`): a frame whose start time `t[i]` falls inside a
  `Setup.exclusion` is in no zone, regardless of visibility or geometry, and is treated like a
  gap for continuity — the next analysed frame uses the "first frame" rule above. This is what
  splits a zone visit into two when an exclusion falls in the middle of a stay (§5.5), and what
  makes a crossing's chain start over after an exclusion (§5.7). `zone_membership` takes this as
  an optional `excluded` frame mask alongside `visible`.

### 5.5 Results (`analysis/results.py`)

* Trial = `setup.trial` or the whole video. **Analysed time** = the trial minus the union of
  `setup.exclusions` (`analysis/exclusions.analysed_intervals`), as a set of sorted,
  non-overlapping sub-intervals. Each frame contributes the overlap of `[t[i], t[i] + d[i])`
  with the analysed intervals (the same partial-frame clipping the trial used before exclusions
  existed) — `analysis/exclusions.frame_interval_overlap`.
* `Results.analysed_duration_s` = the sum of the analysed intervals' lengths;
  `Results.excluded_duration_s` = `trial_duration_s − analysed_duration_s` (exclusions clipped
  to the trial and merged, so overlapping exclusions aren't double-counted).
* Summary rows: one per zone (in setup order) with time and **share of analysed time**
  (`share_of_analysed`, renamed from `share_of_trial`); then **No zone** (visible, analysed, in
  no zone) and **Not visible**. Excluded frames don't count in the zone/No zone/Not visible rows
  at all — with non-overlapping zones `Σ zones + No zone + Not visible = analysed duration`.
* Visits: contiguous runs of membership within the trial per zone, numbered chronologically.
  `enter_s`/`exit_s` are clipped to the trial; `exit_s` = end of the last frame inside. Because
  membership is forced to "no zone" for excluded frames (§5.4), a visit that would have spanned
  an exclusion is split into two — one ending at the exclusion's start, one starting at the next
  analysed frame. `enter_utc`/`exit_utc` = `recorded_at + seconds` when `recorded_at` is known.
* Flags entirely inside excluded time are hidden the same way flags outside the trial are:
  from the flag list (`GET .../session/flags`), `unresolved_flag_count` and `video_status`.
* **Distance travelled** (`analysis/distance.py`, `Results.distance_mm`): the body centre's path
  length over the analysed intervals (never bridged across an exclusion or a trial edge), from
  the effective track, converted to mm via `Setup.calibration.mm_per_px`; `None` without a
  calibration. Within one interval, the centre is first smoothed with a centred moving average
  (`SMOOTH_WINDOW_FRAMES = 5`, shrinking near the edges) over each continuous visible run, to
  remove single-frame detection jitter without smearing real locomotion (5 frames ≈ 160–200 ms
  at the sample videos' ~25 fps). Not-visible frames strictly between two visible frames of the
  same interval are bridged with a straight line; steps below `NOISE_FLOOR_PX = 0.5` px (after
  smoothing) are dropped rather than summed, so a stationary-but-jittery mouse totals ≈ 0.
  `compute_distance_mm` returns raw mm; exports show it in cm (`mm / 10`) and the app in m.

### 5.6 History (`analysis/history.py`)

Newest first: one entry per correction, one per `setup_changes` item, and "Tracking finished"
(`track.tracked_at`, detail e.g. `"9 000 frames · 7 flags"`). Titles follow the design:
"Set position", "Fill in between", "Mouse not visible", "Accepted flag", "Tracking finished".

### 5.7 Zone crossings (`analysis/crossings.py`)

A **stay** is a continuous run of membership in one zone, within one continuity segment (one of
the analysed intervals from §5.5 — an exclusion is the only thing that breaks a segment; not
being tracked yet doesn't, since only analysed time is considered at all). Two things are
transparent when deciding whether a stay is "over":

* **Not-visible gaps are transparent**: consecutive stays of the *same* zone separated only by
  not-visible frames merge into one stay — no crossing fires at the resumption. A crossing
  *through* the gap to a *different* zone still counts (`X → not visible → Y` = `X→Y`).
* **Unzoned floor is transparent for crossings, but doesn't merge stays**: a visible-but-unzoned
  frame between two stays of the same zone prevents the merge, so `X → no zone → X` is a genuine
  re-entry crossing; `X → no zone → Y` counts as `X→Y` the same way.

A crossing fires at the moment a stay starts (zone Y entered). Its "from" is the stay — of any
zone, in the same continuity segment — that most recently *ended* at or before that moment: a
zone still occupied at entry time is never a "from" (only stays that have actually exited are
candidates); ties (equal exit time) go to the stay that ended last. The first stay to start in a
continuity segment (including the first one after an exclusion) has no candidate, so it isn't a
crossing — this is how exclusions break the crossing chain.

A `CrossingRule {id, from_zone_id, to_zone_id}` matches a crossing when each side equals the
rule's id, with `None` matching any zone; `Results.crossings` holds one `CrossingResult` per
rule (its matched `count` and `events`). `Results.crossing_matrix` is the count for *every*
ordered zone pair, including the diagonal (re-entries), in setup zone order — independent of
`crossing_rules`.

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
def detect_flags(track: Track, unusual_size: UnusualSizeRule) -> list[Flag]: ...
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
                    threshold: float, excluded: np.ndarray | None = None) -> np.ndarray: ...
                    # bool (frames × zones); `excluded` defaults to "none excluded"
# analysis/exclusions.py — pure interval arithmetic, shared by results, crossings and flag filtering
def analysed_intervals(trial_start: float, trial_end: float,
                       exclusions: Sequence[Exclusion]) -> list[tuple[float, float]]: ...
def excluded_duration_s(trial_start: float, trial_end: float,
                        exclusions: Sequence[Exclusion]) -> float: ...
def frame_is_excluded(frame_start_times: np.ndarray, exclusions: Sequence[Exclusion]) -> np.ndarray: ...
def frame_interval_overlap(frame_starts: np.ndarray, frame_ends: np.ndarray,
                           intervals: Sequence[tuple[float, float]]) -> np.ndarray: ...
def is_interval_fully_excluded(start: float, end: float, exclusions: Sequence[Exclusion]) -> bool: ...
# analysis/results.py
def compute_results(document: AnalysisDocument, effective: Track | None = None) -> Results | None: ...
# analysis/crossings.py
def compute_crossings(*, t: np.ndarray, frame_end_times: np.ndarray, membership: np.ndarray,
                      visible: np.ndarray, zones: list[Zone], intervals: list[tuple[float, float]],
                      rules: list[CrossingRule], recorded_at: datetime | None
                      ) -> tuple[list[CrossingResult], list[MatrixCell]]: ...
# analysis/history.py
def build_history(document: AnalysisDocument) -> list[HistoryEntry]: ...
# analysis/status.py
def unresolved_flag_count(document: AnalysisDocument) -> int: ...
    # unresolved flags overlapping the trial, excluding ones entirely inside an excluded period
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
  Batches: `<user config dir>/batches/<id>.json` — a `BatchRecord {id, created_at, template_id,
  template_name, folder, items: [{video_id, video_path, file_name, trial, offset_x, offset_y}]}`,
  written the same way. It's the *input* to a batch run, not its live status: job progress stays
  in-memory only (`services.jobs.JobManager`), so after a restart each item's status is derived
  fresh from its sidecar (`services.batch.summarize_batch`) plus any job still running for that
  video. A batch file that fails to parse is skipped (logged warning) rather than breaking the
  list, and reported back as `{id, error}` so the UI can offer to delete it.
  User config dir = `platformdirs.user_config_dir("Tramus")`; overridable with `TRAMUS_CONFIG_DIR`
  (tests use a temp dir).

## 8. HTTP API (all under `/api`, token required)

| Method & path | Body → Response |
|---|---|
| `GET /health` | → `{status, version}` |
| `GET /system` | → `{version, platform, cpu_count, gpu: {name}|null, trackers: [{id, name, supports_gpu}]}`. `version` is the full app version the desktop app passes in `TRAMUS_APP_VERSION` (`1.2.3 (build 45)` for releases, `0.0.0-dev+<sha>[.dirty]` for local builds; the engine's own `engine_version` when run without the app, e.g. the CLI), the same value saved as `app_version` in analyses and exports; Settings → About shows both |
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
| `POST /batches` | `{template_id, items: [{video_id, trial, offset_x, offset_y}]}` → `{id, jobs: Job[]}` — also saves a `BatchRecord` |
| `GET /batches` | → `{batches: BatchView[], broken: {id, error}[]}`, newest first; each item has its live `status`/`unresolved_flags` (from its sidecar) and `job` (if one is running) |
| `GET /batches/{id}` | → `BatchView` (404 if unknown) |
| `DELETE /batches/{id}` | reset: deletes the saved record only (never sidecars/videos) → 204, or 404 |
| `GET /templates` · `POST /templates` · `GET/PUT/DELETE /templates/{id}` | `Template`; create body `{name, video_id}` (from that session's setup) |
| `POST /templates/{id}/apply` | `{video_ids}` → `VideoSummary[]` (writes sidecars) |
| `POST /export` | `{video_ids, format: "xlsx"|"csv", path, layout: "wide"|"long" = "wide"}` → `{files: string[]}` |
| `WS /events` | server → client: `{"type": "job", "job": Job}`, `{"type": "session", "video_id", "state": SessionState}` |

`SessionState` = `{video: VideoSummary, document: AnalysisDocument without track arrays
(track replaced by track_summary {tracked_at, frame_count, tracker}), dirty, saved_at,
loaded_from_disk, file_changed, active_job: Job | null}`.

Errors: JSON `{detail: str}` with 400 (invalid input), 403 (OS denied a file/folder read —
typically macOS's per-folder privacy protection after "Don't Allow"; any `PermissionError`
raised while handling a request is translated centrally by `api/errors.py`, not caught per
route), 404 (unknown id), 409 (conflict, e.g. tracking already running), 500. `detail` is
written for the end user.

## 9. Export

`ExportLayout` (`domain/settings.py`) picks the shape of the three *per-video aggregate* tables —
Summary, crossing rule counts and the crossing matrix. Visits, crossing events and Track are event
lists, not per-video aggregates, and are **always long** in both layouts. `export/tables.py`
builds each table's rows once, in the long shape, from `Results`/`AnalysisDocument`; the `*_wide`
builders pivot those same long rows rather than recomputing anything, so `xlsx.py`/`csv.py` only
choose which builder to call. Wide columns are aligned across videos **by name** (zone name, rule
label, or ordered zone-name pair), in first-seen order; a video missing a given zone/rule/pair
gets an empty cell for that column rather than being dropped or misaligned.

* **Long** (`ExportLayout.LONG`, the original shape): one row per video and zone (Summary), per
  video and rule (crossing counts), or a from×to grid per video (crossing matrix).
* **Wide** (`ExportLayout.WIDE`, the default): one row per video. Summary's zone columns become
  `"<zone> – Time (s)"` / `"<zone> – Share of analysed (%)"` pairs (zones, then "No zone", then
  "Not visible"); crossing counts become one `"<from> → <to> – Crossings"` column per distinct
  rule label ("Any zone" spelled out for `None`); the crossing matrix becomes one `"<from> →
  <to>"` column per ordered zone-name pair (including the diagonal).

`.xlsx` (XlsxWriter) — one workbook for one or many videos:
* **Export info**: one row stating the chosen layout, so it's obvious without counting columns.
* **Summary** (`"Summary (wide)"` / `"Summary (long)"`): video, [zone / per-zone columns], trial
  start/end, analysed duration (s), excluded duration (s), threshold, and (wide layout: at the
  end) **Distance travelled (cm)** — empty without a calibration.
* **Visits**: video, #, zone, entered/left (video time s), entered/left (UTC ISO) and (local,
  Excel datetime), duration (s). Always long.
* **Track**: per video, frame, t, x, y, status, zones (one 0/1 column per zone; membership
  already accounts for exclusions, §5.4). Always long.
* **Crossings** (`"Crossings (wide)"` / `"Crossings (long)"`): the rule-count block (pivoted in
  wide layout), then the always-long crossing-event table (video, rule, from, to (concrete zones
  for that event), time (s), time (UTC), time (local)).
* **Crossing matrix** (`"Crossing matrix (wide)"` / `"Crossing matrix (long)"`): one row per
  video with one column per ordered zone-name pair (wide), or one from×to grid per video, zone
  names as row/column headers in setup order (long) — both include the diagonal.
* **Settings**: app version, tracker + parameters, setup (zones as text, sizes in mm when
  calibrated), exclusions (time range, duration, note), crossing rules (zone names or "Any
  zone"), recording time, fingerprint, tracked at, reference length (mm), mm per px, corrections
  log. Always one row per video, independent of layout.

`.csv`, UTF-8 with BOM, comma separated: `<name>_visits.csv` is unchanged by layout. Long layout
writes `<name>_summary.csv` and `<name>_crossings.csv` (per-rule counts, the from×to matrix, then
events, as three blocks separated by a blank line) — the original, backward-compatible names.
Wide layout writes `<name>_summary_wide.csv` and `<name>_crossings_wide.csv` instead (pivoted
rule-count and matrix blocks, then the always-long events block) — the `_wide` suffix is what
makes the layout obvious from the file list. Exporting sets `exported_at` on the document and
saves it, regardless of layout.

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
* **Playback** (`features/workspace/playback/`):
  * *Clock*: a `requestAnimationFrame` loop keeps a continuous playback time (advanced by
    `dt × speed`) and maps it to a frame via binary search in `frame-times`. It never re-derives
    time from the current frame, or sub-frame progress is lost and 1× playback stalls.
  * *Frames while playing*: a prefetch pipeline predicts the frames the clock will need on a
    fixed grid (stride = ⌈fps × speed / 60⌉, about 0.6 s ahead) and keeps up to 4 requests in
    flight at JPEG quality 70. Decoded frames go into a small LRU cache, and the newest cached
    frame at or before the clock is drawn. Measured on the samples: every frame at 1×, every
    2nd frame at 4×.
  * *Frames when paused or scrubbing*: exactly `currentFrame`, at full quality, single-flight
    and latest-wins.
  * *Tracker view*: previews follow playback single-flight and latest-wins (one
    `/detection-preview` in flight, then the newest frame).
* **Frontend rules learned the hard way**:
  * Never close an `ImageBitmap` until React has committed its replacement. Drawing a closed
    ("detached") bitmap throws and takes the page down.
  * TanStack Query `select` functions must have a stable identity (module-level). An inline
    `select` rebuilds typed arrays on every render and restarts effects that depend on them.
  * Never abort an in-flight frame request just because a newer frame is wanted. Show it,
    then fetch the newest.
  * The preload is built as CommonJS (`out/preload/index.cjs`): sandboxed preloads can't be ES
    modules.
  * Pointer maths: shapes live in video pixels. Handles and labels keep a constant screen size
    via the `px` (= 1 / stage scale) factor, and timeline positions go through
    `lib/timelineScale.ts` (it has a 14 px gutter at each end).
* **Build info and versions**: `scripts/build-info.mjs` generates `app/resources/build-info.json`
  (version, build number, commit, dirty, date; gitignored, bundled via electron-builder `files`).
  Local builds write it from `npm run dev` / `npm run build` (`0.0.0-dev+<sha>[.dirty]`); the
  Release workflow writes it through `scripts/set-version.mjs <version> <run number>`, and
  `scripts/build.mjs` sets electron-builder's `buildVersion` (`<version>.<run number>`). Electron
  main reads the file (`main/buildInfo.ts`), exposes it through `app.getInfo()` and starts the
  engine with `TRAMUS_APP_VERSION=<full version>`.
* **Keyboard shortcuts**: one registry, `renderer/src/lib/shortcutRegistry.ts` (id, combo, label,
  group, screens/steps where active). Call sites pass `SHORTCUTS.<id>.combo` to `useShortcut` /
  `<ShortcutTooltip>`; Settings → Keyboard shortcuts renders the same table. A key may be reused
  only where the contexts never overlap (tested).
* **Folders**:
  `renderer/src/{app (shell, routes, providers), theme, api (client, generated schema,
  `types.ts` aliases, shared `queries/`, events), components (shared UI), features/<feature>
  (start, library, templates, batch, settings, workspace), lib (time/format, shortcuts),
  stores (app-wide, e.g. notifications)}`. See `app/README.md` for the workspace breakdown.
* **Tests**: Vitest covers pure helpers (`npm test`). `app/scripts/ui-smoke.mjs` drives the
  real app (hidden window, over CDP) for screenshots and playback frame-rate measurements.
