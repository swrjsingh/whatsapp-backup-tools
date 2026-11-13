"""Paths and lookups for viewer assets stored inside the archive output folder.

Profile photos and group icons must live under output_root only. Use
scripts/ingest-viewer-assets.py to copy files from phone media or a one-time
Desktop export into the archive — the running viewer never reads live app data.

Usage (library only):
    from wab_viewer.archive_assets import contact_profile_photos_dir, group_avatar_file
"""

from __future__ import annotations

import re
from pathlib import Path


def contact_profile_photos_dir(output_root: Path) -> Path:
    """Android-style contact profile photo folder inside the archive."""
    return output_root / "Media" / "WhatsApp Profile Photos"


def contact_avatars_dir(output_root: Path) -> Path:
    """Ingested 1:1 profile icons keyed by phone digits (from Desktop export)."""
    return output_root / "viewer-assets" / "contact-avatars"


def group_avatars_dir(output_root: Path) -> Path:
    """Ingested group icons keyed by msgstore chat row id."""
    return output_root / "viewer-assets" / "group-avatars"


def group_avatars_by_jid_dir(output_root: Path) -> Path:
    """Ingested group icons keyed by jid.user (WhatsApp group id digits)."""
    return group_avatars_dir(output_root) / "by-jid"


def contact_profile_photos(output_root: Path) -> dict[str, Path]:
    """Map normalized phone digits to profile photo files under output_root."""
    photos: dict[str, Path] = {}
    for folder in (contact_profile_photos_dir(output_root), contact_avatars_dir(output_root)):
        if not folder.is_dir():
            continue
        for path in folder.iterdir():
            if not path.is_file():
                continue
            if folder == contact_avatars_dir(output_root):
                digits = re.sub(r"\D", "", path.stem)
                if 8 <= len(digits) <= 15:
                    photos.setdefault(digits, path)
                continue
            matched = re.search(r"(\d[\d\s]{6,22}?)\s+\d{8}", path.name)
            digits = re.sub(r"\D", "", matched.group(1) if matched else path.stem)
            if 8 <= len(digits) <= 15:
                photos.setdefault(digits, path)
    return photos


def _valid_avatar_file(path: Path) -> bool:
    return path.is_file() and path.stat().st_size > 100


def group_avatar_file(output_root: Path, chat_row_id: int) -> Path | None:
    """Return ingested group avatar path when a JPEG was copied into the archive."""
    for name in (f"{chat_row_id}.jpg", f"{chat_row_id}.jpeg"):
        path = group_avatars_dir(output_root) / name
        if _valid_avatar_file(path):
            return path
    return None


def group_avatar_by_jid_file(output_root: Path, jid_user: str) -> Path | None:
    """Return ingested group avatar for a WhatsApp group jid.user string."""
    if not jid_user:
        return None
    folder = group_avatars_by_jid_dir(output_root)
    for name in (f"{jid_user}.jpg", f"{jid_user}.jpeg"):
        path = folder / name
        if _valid_avatar_file(path):
            return path
    return None


def jid_users_with_group_avatar_files(output_root: Path) -> set[str]:
    """jid.user values that have a copied group avatar under by-jid/."""
    folder = group_avatars_by_jid_dir(output_root)
    if not folder.is_dir():
        return set()
    out: set[str] = set()
    for path in folder.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in (".jpg", ".jpeg"):
            continue
        if path.stem.isdigit() and len(path.stem) >= 10:
            out.add(path.stem)
    return out


def chats_with_group_avatar_files(output_root: Path) -> set[int]:
    """Chat row ids that have a copied group avatar file in the archive."""
    folder = group_avatars_dir(output_root)
    if not folder.is_dir():
        return set()
    out: set[int] = set()
    for path in folder.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in (".jpg", ".jpeg"):
            continue
        if path.stem.isdigit() and path.stat().st_size > 100:
            out.add(int(path.stem))
    return out
