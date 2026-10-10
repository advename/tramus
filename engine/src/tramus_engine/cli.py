"""`tramus-engine`: `serve` (the HTTP API for the Electron app), `track`, `export`, `openapi`."""

from __future__ import annotations

import argparse
import json
import logging
import logging.config
import multiprocessing
import os
import socket
import sys
import threading
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

logger = logging.getLogger(__name__)

_LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"default": {"format": "%(levelname)s %(name)s: %(message)s"}},
    "handlers": {
        "stderr": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
            "formatter": "default",
        }
    },
    "root": {"handlers": ["stderr"], "level": "INFO"},
    "loggers": {
        "uvicorn": {"handlers": ["stderr"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"handlers": ["stderr"], "level": "INFO", "propagate": False},
        "uvicorn.access": {"handlers": ["stderr"], "level": "INFO", "propagate": False},
    },
}


def _configure_logging() -> None:
    logging.config.dictConfig(_LOG_CONFIG)


def _watch_stdin(on_eof: Callable[[], None]) -> None:
    """Exits the process the moment stdin closes (the app quit or its process died)."""
    try:
        while sys.stdin.readline():
            pass
    except Exception:
        pass
    try:
        on_eof()  # stop tracking workers before leaving
    finally:
        os._exit(0)


_ERROR_INVALID_PARAMETER = 87  # what OpenProcess fails with when no such process exists


def _watch_parent(pid: int, on_exit: Callable[[], None]) -> None:
    """Windows: exits the process the moment the app process `pid` ends.

    Replaces `_watch_stdin` there. Windows hands the engine's stdin pipe to every child process
    it starts, and while a read on that (synchronous) pipe is pending, the child's startup check
    of the handle waits behind it — so tracking workers would hang before running any code.
    """
    import _winapi

    try:
        handle = _winapi.OpenProcess(_winapi.SYNCHRONIZE, False, pid)
    except OSError as exc:
        if exc.winerror != _ERROR_INVALID_PARAMETER:  # anything but "the app is already gone"
            logger.warning("Can't watch app process %s, engine won't exit with it: %s", pid, exc)
            return
    else:
        _winapi.WaitForSingleObject(handle, _winapi.INFINITE)
    try:
        on_exit()  # stop tracking workers before leaving
    finally:
        os._exit(0)


def cmd_serve(args: argparse.Namespace) -> int:
    import uvicorn

    from .api.app import create_app
    from .services.container import create_services

    services = create_services()
    app = create_app(services, args.token)

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((args.host, args.port))
    sock.listen(100)
    port = sock.getsockname()[1]

    # Exactly one line, to stdout, flushed: the Electron main process reads this to learn the
    # port before making any request.
    sys.stdout.write(json.dumps({"event": "ready", "port": port}) + "\n")
    sys.stdout.flush()

    if sys.platform == "win32":
        # Never block reading stdin on Windows (see `_watch_parent`).
        if args.parent_pid is not None:
            threading.Thread(
                target=_watch_parent, args=(args.parent_pid, services.shutdown), daemon=True
            ).start()
    elif not args.no_stdin_watch:
        threading.Thread(target=_watch_stdin, args=(services.shutdown,), daemon=True).start()

    config = uvicorn.Config(app, log_config=_LOG_CONFIG, log_level="info")
    server = uvicorn.Server(config)
    server.run(sockets=[sock])
    return 0


def _collect_video_paths(paths: list[str]) -> list[Path]:
    from .domain import VIDEO_EXTENSIONS

    result: list[Path] = []
    for raw in paths:
        candidate = Path(raw)
        if candidate.is_dir():
            result.extend(
                sorted(
                    f
                    for f in candidate.iterdir()
                    if f.is_file() and f.suffix.lower() in VIDEO_EXTENSIONS
                )
            )
        elif candidate.is_file():
            result.append(candidate)
        else:
            print(f"Not found, skipped: {raw}", file=sys.stderr)
    return result


def _resolve_template(value: str):
    from .domain import Template
    from .storage.templates import TemplateStore

    stored = TemplateStore().get(value)
    if stored is not None:
        return stored
    path = Path(value)
    if path.exists():
        return Template.model_validate_json(path.read_text(encoding="utf-8"))
    raise SystemExit(f"Unknown template: no stored template with id '{value}', and no such file.")


def _suggest_trial(path: Path, template) -> tuple[float, float] | None:
    from .services.batch import check_video
    from .services.library import video_id_for_path
    from .video.probe import probe_video

    video_info = probe_video(path)
    check = check_video(video_id_for_path(path), path, video_info, template)
    return check.suggested_trial


def _track_and_save(
    path_str: str, template_data: dict, trial: tuple[float, float] | None, app_version: str
) -> str:
    """Tracks one video and saves its sidecar. Top-level and picklable: used directly in-process
    for `--jobs 1`, or submitted to a `ProcessPoolExecutor` for `--jobs > 1`."""
    from .domain import ProcessingDevice, Template
    from .services.batch import build_batch_document
    from .services.templates import setup_from_template
    from .storage.sidecar import save_sidecar
    from .tracking.runner import run_tracking
    from .video.probe import probe_video

    path = Path(path_str)
    template = Template.model_validate(template_data)
    video_info = probe_video(path)
    setup = setup_from_template(template, video_info.width, video_info.height, trial=trial)
    document = build_batch_document(path, video_info, setup, app_version)
    outcome = run_tracking(path, setup, device=ProcessingDevice.AUTO)
    updated = document.model_copy(
        update={
            "track": outcome.track,
            "flags": outcome.flags,
            "corrections": [],
            "setup_changes": [],
        }
    )
    save_sidecar(path, updated)
    return f"{path.name}: {outcome.track.frame_count} frames, {len(outcome.flags)} flags"


def cmd_track(args: argparse.Namespace) -> int:
    from .services.system import app_version

    template = _resolve_template(args.template)
    video_paths = _collect_video_paths(args.paths)
    if not video_paths:
        print("No videos found.", file=sys.stderr)
        return 1

    explicit_trial = (
        (args.start, args.end) if args.start is not None and args.end is not None else None
    )
    version = app_version()
    template_data = json.loads(template.model_dump_json())
    jobs = max(1, args.jobs)

    def trial_for(path: Path) -> tuple[float, float] | None:
        return explicit_trial or _suggest_trial(path, template)

    failures = 0
    if jobs == 1:
        for path in video_paths:
            try:
                print(
                    _track_and_save(str(path), template_data, trial_for(path), version), flush=True
                )
            except Exception as exc:
                failures += 1
                print(f"{path.name}: FAILED — {exc}", file=sys.stderr, flush=True)
    else:
        ctx = multiprocessing.get_context("spawn")
        with ProcessPoolExecutor(max_workers=jobs, mp_context=ctx) as executor:
            futures = {
                executor.submit(
                    _track_and_save, str(path), template_data, trial_for(path), version
                ): path
                for path in video_paths
            }
            for future in as_completed(futures):
                path = futures[future]
                try:
                    print(future.result(), flush=True)
                except Exception as exc:
                    failures += 1
                    print(f"{path.name}: FAILED — {exc}", file=sys.stderr, flush=True)

    return 1 if failures else 0


def cmd_export(args: argparse.Namespace) -> int:
    from .services.export import NoAnalysisToExportError, export_videos
    from .services.library import LibraryService
    from .services.sessions import SessionManager
    from .services.system import app_version
    from .storage.settings import SettingsStore

    video_paths = _collect_video_paths(args.paths)
    if not video_paths:
        print("No videos found.", file=sys.stderr)
        return 1

    library = LibraryService()
    settings = SettingsStore()
    sessions = SessionManager(app_version(), lambda: settings.load().default_in_zone_threshold)
    video_ids = [library.register(path) for path in video_paths]

    try:
        files = export_videos(
            library=library,
            sessions=sessions,
            video_ids=video_ids,
            format=args.format,
            path=Path(args.out),
        )
    except NoAnalysisToExportError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    for file in files:
        print(file)
    return 0


def cmd_openapi(args: argparse.Namespace) -> int:
    from .api.app import create_app
    from .services.container import create_services

    services = create_services()
    try:
        app = create_app(services, token="openapi-export")
        text = json.dumps(app.openapi(), indent=2)
    finally:
        services.shutdown()

    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    else:
        print(text)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="tramus-engine", description="Tramus tracking engine.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve_parser = subparsers.add_parser("serve", help="Run the HTTP API for the Electron app.")
    serve_parser.add_argument("--host", default="127.0.0.1")
    serve_parser.add_argument("--port", type=int, default=0)
    serve_parser.add_argument("--token", required=True)
    serve_parser.add_argument("--no-stdin-watch", action="store_true")
    serve_parser.add_argument(
        "--parent-pid",
        type=int,
        default=None,
        help="Windows: exit when this process (the app) ends. Elsewhere stdin EOF does that.",
    )
    serve_parser.set_defaults(func=cmd_serve)

    track_parser = subparsers.add_parser("track", help="Track one or more videos headlessly.")
    track_parser.add_argument("paths", nargs="+", help="Video files or folders.")
    track_parser.add_argument(
        "--template", required=True, help="Template id or path to a template JSON file."
    )
    track_parser.add_argument(
        "--start", type=float, default=None, help="Trial start, in video seconds."
    )
    track_parser.add_argument(
        "--end", type=float, default=None, help="Trial end, in video seconds."
    )
    track_parser.add_argument("--jobs", type=int, default=1, help="Videos to track in parallel.")
    track_parser.set_defaults(func=cmd_track)

    export_parser = subparsers.add_parser("export", help="Export analysed videos to xlsx or csv.")
    export_parser.add_argument("paths", nargs="+", help="Video files or folders.")
    export_parser.add_argument(
        "--out", required=True, help="Output file (xlsx) or base path (csv)."
    )
    export_parser.add_argument("--format", choices=["xlsx", "csv"], default="xlsx")
    export_parser.set_defaults(func=cmd_export)

    openapi_parser = subparsers.add_parser("openapi", help="Print the engine's OpenAPI schema.")
    openapi_parser.add_argument("--out", default=None, help="Write to this file instead of stdout.")
    openapi_parser.set_defaults(func=cmd_openapi)

    return parser


def main(argv: list[str] | None = None) -> int:
    multiprocessing.freeze_support()
    _configure_logging()
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
