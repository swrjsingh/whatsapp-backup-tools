from pathlib import Path

from wab_viewer.archive_assets import (
    contact_profile_photos,
    group_avatar_file,
    chats_with_group_avatar_files,
)


def test_contact_photos_only_under_output_root(tmp_path: Path):
    outside = tmp_path / "phone-copy" / "WhatsApp" / "Media" / "WhatsApp Profile Photos"
    outside.mkdir(parents=True)
    (outside / "919876543210.jpg").write_bytes(b"x" * 200)
    assert contact_profile_photos(tmp_path / "archive") == {}

    dest = tmp_path / "archive" / "Media" / "WhatsApp Profile Photos"
    dest.mkdir(parents=True)
    (dest / "919876543210 20261018.jpg").write_bytes(b"x" * 200)
    photos = contact_profile_photos(tmp_path / "archive")
    assert "919876543210" in photos


def test_group_avatar_file(tmp_path: Path):
    root = tmp_path / "archive"
    folder = root / "viewer-assets" / "group-avatars"
    folder.mkdir(parents=True)
    (folder / "29590.jpg").write_bytes(b"\xff\xd8" + b"x" * 200)
    assert group_avatar_file(root, 29590) is not None
    assert 29590 in chats_with_group_avatar_files(root)
    assert group_avatar_file(root, 1) is None
