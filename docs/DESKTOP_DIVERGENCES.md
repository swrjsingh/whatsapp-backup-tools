# Desktop vs archive viewer — working divergence log

Compared against WhatsApp Desktop **2.26.41.28** (reference shots in `logs/ui-compare/`). Viewer: `http://127.0.0.1:8766`.

**Process:** each read-only Desktop pass → new screenshots → update this file + [FEATURES.md](./FEATURES.md) → implement viewer → browser verify ([INTENT.md](./INTENT.md) §3).

## Left rail

| Desktop | Viewer | Status |
|---------|--------|--------|
| Chats icon badge (e.g. 20) | Chats rail badge from backup unread count | **Fixed** (session may override unread) |
| Calls badge (13) | Placeholder toast | Open |
| More → Archived (21) in rail | More → Archived + count (backup 123) in rail + list row | **Partial** (counts differ: backup vs live) |
| More → Starred in rail | More → Starred + count in rail + list row | **Partial** |
| Communities listed under More with chevrons | Communities nav tab + list | **Partial** — placement differs |
| Profile + pencil at bottom | “S” circle at bottom; **Reset** moved to Settings | **Partial** (no pencil; no real PfP) |

## Chat list column

| Desktop | Viewer | Status |
|---------|--------|--------|
| Title “Chats” + new chat | “Chats” + compose icon (no left ⋮ menu) | **Partial** |
| Search “Ask Meta AI or Search” + gear | Same placeholder + settings gear opens Settings | **Fixed** |
| Rail `#111b21`, list `#202c33` | Tokens swapped to match Desktop column backgrounds | **Fixed** (verify in browser) |
| All / Unread / Favourites / Groups | Same | OK |
| Pinned: CompSoc, ವಿಧಾನ, S1+S2 CSE | Same three (viewer pin table) | OK |
| Single pin glyph under time | Was double (CSS + JS); now one pin under time | **Fixed** |
| Green draft previews | Not in backup | Omitted |
| Archived “Edit” header | No Edit | Open (read-only OK as placeholder) |
| Community row subtitle “Announcements” | Added for `is_community` | **Fixed** |

## Empty / no chat selected

| Desktop | Viewer | Status |
|---------|--------|--------|
| WhatsApp logo + version string | Logo + “WhatsApp Backup Viewer” + encrypted + hint | **Partial** (no Desktop build string) |
| End-to-end encrypted footer | Lock icon + line on empty pane | **Fixed** |

## Thread pane

| Desktop | Viewer | Status |
|---------|--------|--------|
| Doodle wallpaper | Subtle pattern on `#message-scroll` | **Fixed** (approximation) |
| Header video/voice/search/menu | Placeholder icons | OK |
| Bottom composer + mic | No composer (intent); reply bar for session | By design |
| Message context menus | Right-click menu + session actions | **Partial** |

## Communities

| Desktop | Viewer | Status |
|---------|--------|--------|
| S1+S2 CSE panel sections | Announcements + groups you’re in + info | Verified in browser |
| Groups you can join (when linked in DB) | API bucket; may be empty if all member groups | Data-dependent |
| SIH / IEEE Executive extras on Desktop | Missing node rows in backup | Omitted per INTENT |

## Counts / time

| Desktop | Viewer | Status |
|---------|--------|--------|
| Unread 22 vs Archived 23 (live) | Unread 27, Archived 123 (backup) | Accepted |

---

Next Desktop passes (read-only): Chats home (not Archived), open IEEE CompSoc + S1+S2 CSE side-by-side with viewer, search UI, group info sheet, message receipt popup styling.
