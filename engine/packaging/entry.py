"""PyInstaller entry point (a plain script, so no relative imports)."""

import multiprocessing

from tramus_engine.cli import main

if __name__ == "__main__":
    multiprocessing.freeze_support()  # tracking workers are spawned processes
    main()
