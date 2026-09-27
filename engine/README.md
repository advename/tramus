# tramus-engine

The Python engine behind [Tramus](../README.md): video decoding (PyAV), background-subtraction
mouse tracking (OpenCV), zone analysis, sidecar files, Excel/CSV export, a local HTTP API
(FastAPI) used by the desktop app, and a CLI for headless batch runs.

```bash
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/python -m pytest
.venv/bin/tramus-engine --help
```

Design, algorithms and API: [docs/architecture.md](../docs/architecture.md).
