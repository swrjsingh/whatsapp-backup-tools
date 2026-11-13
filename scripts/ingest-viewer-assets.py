#!/usr/bin/env python3
"""Copy WhatsApp profile assets into an archive folder for offline viewer use.

Copies contact profile photos from a phone media tree and optional Desktop
Profile cache into paths under <archive>/ that wab-viewer reads at runtime.
Does not modify msgstore or touch the live Desktop app after copy.

Usage:
    python scripts/ingest-viewer-assets.py \\
        --archive /path/to/WhatsApp-Archive-2026-10-18/archive \\
        --phone-profile-photos /path/to/phone-copy/WhatsApp/Media/WhatsApp\\ Profile\\ Photos

    python scripts/ingest-viewer-assets.py \\
        --archive /path/to/archive \\
        --desktop-profile ~/Library/Group\\ Containers/group.net.whatsapp.WhatsApp.shared/Media/Profile
"""

from __future__ import annotations

import argparse
import re
import shutil
import sqlite3
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from wab_viewer.archive_assets import (  # noqa: E402
    contact_avatars_dir,
    contact_profile_photos_dir,
    group_avatars_by_jid_dir,
    group_avatars_dir,
)


def _find_msgstore(archive: Path) -> Path | None:
    """Locate msgstore.db under the archive output root."""
    for base in (archive / "Whatsapp Databases", archive):
        candidate = base / "msgstore.db"
        if candidate.is_file() and candidate.stat().st_size > 1024:
            return candidate
    return None


def _jid_user_chat_map(msgstore: Path) -> dict[str, list[tuple[int, str]]]:
    """Map jid.user digits to every (chat_row_id, 'group'|'contact') using that jid."""
    conn = sqlite3.connect(str(msgstore))
    try:
        rows = conn.execute(
            """
            SELECT c._id, j.user,
                   CASE WHEN c.subject IS NOT NULL THEN 'group' ELSE 'contact' END AS kind
            FROM chat c
            JOIN jid j ON j._id = c.jid_row_id
            WHERE j.user IS NOT NULL AND TRIM(j.user) != ''
            """
        ).fetchall()
    finally:
        conn.close()
    out: dict[str, list[tuple[int, str]]] = {}
    for chat_id, user, kind in rows:
        digits = re.sub(r"\D", "", str(user))
        if not digits:
            continue
        out.setdefault(digits, []).append((int(chat_id), kind))
    return out


def _desktop_profile_entries(profile_dir: Path) -> dict[str, Path]:
    """Pick best Desktop Profile file per jid user prefix (prefer .jpg over .thumb)."""
    best: dict[str, tuple[int, Path]] = {}
    pat = re.compile(r"^(\d+)-(\d+)\.(jpg|jpeg|thumb)$", re.I)
    for path in profile_dir.iterdir():
        if not path.is_file():
            continue
        m = pat.match(path.name)
        if not m:
            continue
        user, ts, ext = m.group(1), int(m.group(2)), m.group(3).lower()
        rank = (0 if ext in ("jpg", "jpeg") else 1, -ts)
        prev = best.get(user)
        if prev is None or rank < prev[0]:
            best[user] = (rank, path)
    return {user: t[1] for user, t in best.items()}


def ingest_phone_profile_photos(archive: Path, source: Path) -> int:
    """Copy Android Profile Photos files into archive/Media/WhatsApp Profile Photos."""
    if not source.is_dir():
        print(f"skip phone profile photos (not a dir): {source}", file=sys.stderr)
        return 0
    dest = contact_profile_photos_dir(archive)
    dest.mkdir(parents=True, exist_ok=True)
    n = 0
    for path in source.iterdir():
        if not path.is_file():
            continue
        target = dest / path.name
        if target.exists() and target.stat().st_size == path.stat().st_size:
            continue
        shutil.copy2(path, target)
        n += 1
    return n


def ingest_desktop_profile(archive: Path, profile_dir: Path, msgstore: Path) -> tuple[int, int]:
    """Copy Desktop Profile cache files into viewer-assets group/contact avatar dirs."""
    entries = _desktop_profile_entries(profile_dir)
    if not entries:
        return 0, 0
    jid_map = _jid_user_chat_map(msgstore)
    g_dir = group_avatars_dir(archive)
    gj_dir = group_avatars_by_jid_dir(archive)
    c_dir = contact_avatars_dir(archive)
    g_dir.mkdir(parents=True, exist_ok=True)
    gj_dir.mkdir(parents=True, exist_ok=True)
    c_dir.mkdir(parents=True, exist_ok=True)
    groups = contacts = 0
    for user, src in entries.items():
        mapped = jid_map.get(user)
        if mapped is None:
            continue
        by_jid = gj_dir / f"{user}.jpg"
        if not by_jid.exists() or by_jid.stat().st_size != src.stat().st_size:
            shutil.copy2(src, by_jid)
        for chat_id, kind in mapped:
            if kind == "group":
                dest = g_dir / f"{chat_id}.jpg"
            else:
                dest = c_dir / f"{user}.jpg"
            if dest.exists() and dest.stat().st_size == src.stat().st_size:
                continue
            shutil.copy2(src, dest)
            if kind == "group":
                groups += 1
            else:
                contacts += 1
    return groups, contacts


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy profile assets into archive output_root")
    parser.add_argument(
        "--archive",
        type=Path,
        required=True,
        help="Archive output folder passed to wab-viewer (contains msgstore or Whatsapp Databases/)",
    )
    parser.add_argument(
        "--phone-profile-photos",
        type=Path,
        default=None,
        help="Source WhatsApp/Media/WhatsApp Profile Photos from phone copy",
    )
    parser.add_argument(
        "--desktop-profile",
        type=Path,
        default=None,
        help="One-time source: WhatsApp Desktop Media/Profile (copied in, not read at runtime)",
    )
    args = parser.parse_args()
    archive = args.archive.expanduser().resolve()
    if not archive.is_dir():
        print(f"archive not found: {archive}", file=sys.stderr)
        return 1

    phone_n = 0
    if args.phone_profile_photos:
        phone_n = ingest_phone_profile_photos(archive, args.phone_profile_photos.expanduser().resolve())
        print(f"phone profile photos copied: {phone_n}")

    if args.desktop_profile:
        msgstore = _find_msgstore(archive)
        if msgstore is None:
            print("msgstore.db not found under archive; cannot map Desktop group icons", file=sys.stderr)
            return 1
        g, c = ingest_desktop_profile(
            archive, args.desktop_profile.expanduser().resolve(), msgstore
        )
        print(f"desktop group avatars copied: {g}")
        print(f"desktop contact avatars copied: {c}")

    if not args.phone_profile_photos and not args.desktop_profile:
        print("nothing to do; pass --phone-profile-photos and/or --desktop-profile", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
