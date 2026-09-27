# PyInstaller spec for the Tramus engine (one-folder build; Electron ships it as a resource).
# Build: engine/.venv/bin/pyinstaller packaging/tramus-engine.spec --noconfirm
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = (
    collect_submodules("tramus_engine")
    + collect_submodules("uvicorn")
    + collect_submodules("websockets")
)

a = Analysis(
    ["entry.py"],
    pathex=["../src"],
    hiddenimports=hiddenimports,
    excludes=["tkinter", "matplotlib", "PyQt5", "PyQt6", "PySide6", "IPython"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="tramus-engine",
    console=True,  # stdout carries the ready handshake; Electron spawns it hidden
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="tramus-engine", upx=False)
