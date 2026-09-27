"""Sidecar round-trip + atomic write, settings store, template store."""

from __future__ import annotations

from pathlib import Path

from tests.app.conftest import make_document
from tramus_engine.domain import AppSettings, ProcessingDevice, Template, ThemePreference, utc_now
from tramus_engine.storage import paths as storage_paths
from tramus_engine.storage.paths import settings_path, sidecar_path, templates_dir
from tramus_engine.storage.settings import SettingsStore
from tramus_engine.storage.sidecar import atomic_write_text, load_sidecar, save_sidecar
from tramus_engine.storage.templates import TemplateStore


def test_sidecar_path_naming(tmp_path: Path) -> None:
    video = tmp_path / "M12.mp4"
    assert sidecar_path(video) == tmp_path / "M12.mp4.tramus.json"


def test_sidecar_round_trip(tmp_path: Path) -> None:
    video = tmp_path / "mouse.mp4"
    video.write_bytes(b"not a real video")
    document = make_document()

    path = save_sidecar(video, document)
    assert path.exists()
    assert path == sidecar_path(video)

    loaded = load_sidecar(video)
    assert loaded is not None
    assert loaded.video.file_name == document.video.file_name
    assert loaded.setup.arena is not None


def test_load_sidecar_missing_returns_none(tmp_path: Path) -> None:
    assert load_sidecar(tmp_path / "missing.mp4") is None


def test_sidecar_is_pretty_printed(tmp_path: Path) -> None:
    video = tmp_path / "mouse.mp4"
    save_sidecar(video, make_document())
    text = sidecar_path(video).read_text(encoding="utf-8")
    assert text.startswith("{\n")
    assert '"schema_version": 1' in text


def test_atomic_write_replaces_existing_file(tmp_path: Path) -> None:
    target = tmp_path / "file.txt"
    atomic_write_text(target, "first")
    atomic_write_text(target, "second")
    assert target.read_text() == "second"
    # No leftover temp files.
    assert list(tmp_path.iterdir()) == [target]


def test_config_dir_uses_env_override(config_dir: Path) -> None:
    resolved = storage_paths.config_dir()
    assert resolved.samefile(config_dir)
    assert resolved.is_dir()


def test_settings_store_defaults(config_dir: Path) -> None:
    store = SettingsStore()
    settings = store.load()
    assert isinstance(settings, AppSettings)
    assert settings.device == ProcessingDevice.AUTO
    assert settings.recent_folders == []


def test_settings_store_save_round_trip(config_dir: Path) -> None:
    store = SettingsStore()
    updated = store.load().model_copy(update={"theme": ThemePreference.LIGHT, "parallel_jobs": 4})
    store.save(updated)

    reloaded = SettingsStore(path=settings_path())
    loaded = reloaded.load()
    assert loaded.theme == ThemePreference.LIGHT
    assert loaded.parallel_jobs == 4


def test_settings_store_recent_folders_dedupe_and_cap(config_dir: Path) -> None:
    store = SettingsStore()
    for i in range(15):
        store.add_recent_folder(f"/videos/folder-{i % 5}", f"folder-{i % 5}", i)
    settings = store.load()
    assert len(settings.recent_folders) == 5  # only 5 distinct paths were added
    assert settings.recent_folders[0].path == "/videos/folder-4"  # most recently opened first

    store.add_recent_folder("/videos/folder-0", "folder-0", 99)
    settings = store.load()
    assert settings.recent_folders[0].path == "/videos/folder-0"
    assert len({f.path for f in settings.recent_folders}) == len(settings.recent_folders)


def test_settings_store_recent_folders_capped_at_12(config_dir: Path) -> None:
    store = SettingsStore()
    for i in range(20):
        store.add_recent_folder(f"/videos/folder-{i}", f"folder-{i}", i)
    assert len(store.load().recent_folders) == 12


def test_template_store_round_trip(config_dir: Path) -> None:
    store = TemplateStore()
    now = utc_now()
    template = Template(
        id="tpl-1",
        name="Three-chamber",
        created_at=now,
        updated_at=now,
        created_by="jdoe",
        reference_width=1600,
        reference_height=1362,
    )
    store.save(template)

    assert store.get("tpl-1") == template
    assert store.get("missing") is None
    assert [t.id for t in store.list()] == ["tpl-1"]

    assert store.delete("tpl-1") is True
    assert store.get("tpl-1") is None
    assert store.delete("tpl-1") is False


def test_template_store_lists_newest_first(config_dir: Path) -> None:
    store = TemplateStore()
    older = Template(
        id="old",
        name="Old",
        created_at=utc_now(),
        updated_at=utc_now(),
        created_by="a",
        reference_width=100,
        reference_height=100,
    )
    store.save(older)
    newer = older.model_copy(update={"id": "new", "updated_at": utc_now()})
    store.save(newer)
    assert [t.id for t in store.list()] == ["new", "old"]


def test_templates_dir_is_under_config_dir(config_dir: Path) -> None:
    assert templates_dir().parent == config_dir
