# Your intent (archive viewer project)

This file captures what you want, as understood from our work together. Use it to check that a model or session change did not drop requirements. It is **intent and constraints**, not a feature checklist — see [FEATURES.md](./FEATURES.md) for implemented / not yet / omitted UI items.

Last updated: 18 Oct 2026 (Desktop clone loop + FEATURES.md sync).

---

## 1. What you are trying to accomplish

You are moving from **Android WhatsApp (Samsung A32)** to a **fresh official WhatsApp on iPhone and macOS**, starting **18 Oct 2026**. You still want a **local, read-only historical archive** of roughly **six years** of Android chat history **through that backup date**.

That archive should:

- **Look and behave like WhatsApp Desktop/Web** for browsing: chat list, search, threads, media, groups, communities (where the backup supports them), receipts, reactions, etc.
- **Run on macOS** today (Flask viewer on `127.0.0.1:8766`) and later be usable as a **responsive web app / PWA**.
- **Never modify** the live phone, the live WhatsApp app, or the decrypted backup DB as part of normal “using” the archive — except where you explicitly asked for **local viewer-only** side effects (search index, contact import into archiver DB, session-only UI play).

Success means: you can **skim all WhatsApp data until Oct 2026** with UX close enough to Desktop that differences feel like bugs, not “a different product.” For chrome and layout, the target is **clone-level parity**: colors, icons, spacing, and screen structure should match WhatsApp Desktop **2.26.41.28** when compared side-by-side (screenshots), while behavior stays **read-only** and **DB-grounded** per §2.

---

## 2. Hard constraints (non‑negotiable)

### Phone and live WhatsApp

- **Read-only** access to the phone when connected (e.g. MacDroid). No hashing, writes, deletes, or anything that changes device state.
- **Do not corrupt** the running WhatsApp app on phone or Desktop.
- **Do not send messages** during Desktop exploration: no Send, no Enter in composer, no actions that post or change live data.
- Known hazard: a **draft** on “Rimi Di” (`Draft: https://www.youtube.com...`) — **do not type in that composer or press Enter/Send** when using computer control on Desktop.

### Backup and crypto

- Primary message store: **crypt15** `msgstore.db.crypt15` opened with your **64-digit E2E key** (in `.env` / key file — **never print or commit the key**).
- **745 MB backup file ≠ full backup**: message DB only; **media is separate** (you wanted **≥8.5 GB**, full local media, no loss).
- Archive root and viewer venv live under **`/Users/swaraj/Desktop/WhatsApp-Archive-2026-10-18/`** (paths may vary slightly but that is the working archive).

### Data fidelity

- **“Do whatever the DB backup supports; do not hardcode anything — it must be from the DB.”**
- **Do not** infer community membership or subgroup links from **one-off Desktop screenshots** if there is **no row** in the backup (e.g. `message_system_with_group_nodes`). List those gaps; do not fake links.
- You **later reversed** “omit communities”: you **want the full community UI**, built from **proper DB relations** (and viewer-side relations only where the backup truly has no column, e.g. chat pins).

### Reverse engineering

- **Do not** reverse-engineer the WhatsApp `.dmg` or the separate RE repo **unless** a UI gap cannot be closed from **DB + Desktop exploration**.

### Git

- Repo: private **`whatsapp-backup-tools`** (`git@github-swrjsingh:swrjsingh/whatsapp-backup-tools.git`).
- Snapshot commit **`deae7f6`** was the “working viewer before UI changes” baseline — **pushed**.
- **Do not commit** until you explicitly ask; when you do, only after a **major change still works**.
- No git config changes, no force push to main, no amend unless your rules allow.

### Pre‑2022 gap

- Pre‑2022 chats were lost on device after scoped-storage / phone loan; leftover **`/storage/emulated/0/WhatsApp`** (~2022) is **recovery for later**, **not** part of finishing the 2026 viewer first.

---

## 3. Primary active goal (Desktop clone loop)

**Read-only deep exploration of WhatsApp Desktop**, with screenshots and clicking, in a repeating loop until the viewer looks and navigates like a **clone** of Desktop for archive scope:

| Step | What to do |
|------|------------|
| **Capture** | Click through **every screen and state** reachable without sending messages or changing live data (no composer focus on drafts, no Enter/Send). Save reference screenshots under **`logs/ui-compare/`** (name: screen + date, e.g. `desk-chats-empty-2026-10-18.png`). |
| **Catalog** | For each reference, update **`docs/FEATURES.md`**: move lines between **Implemented / Not implemented yet / Omitted**; add missing rows when Desktop shows something not listed yet. Log remaining **visual** gaps in **`docs/DESKTOP_DIVERGENCES.md`**. |
| **Implement** | Change the viewer at `http://127.0.0.1:8766` to match references (tokens, icons, spacing, panels). Data and links **only from the backup** (§2); placeholders and session-only UI where this file already allows; never fake DB rows from a screenshot. |
| **Verify** | Compare **browser vs Desktop** (and vs saved screenshots), not code review alone. Restart the viewer when Python/template change; hard-refresh static assets. |

The loop is **not done** while FEATURES.md still lists clone-scope chrome as “not implemented” without an **Omitted** reason, or while DESKTOP_DIVERGENCES.md shows open **Partial** rows you care about for look-and-feel.

You accepted that **Archived / Unread counts** can differ from Desktop (backup frozen vs live app): *“Archived works but count is wrong, my bad” / “Lite on the count I guess.”*

---

## 4. UI/UX parity — what “same as Desktop” means

### Layout and chrome

- **Left icon rail** like Desktop: Chats, Updates, Communities, Calls, Media, Meta AI, Settings/More — including **placeholder** controls where the archive cannot implement real behavior (calls, Meta AI, etc.) so the **shell looks right**.
- **Middle column**: search, filters, chat list (Archived, Starred, pinned rows, communities).
- **Right column**: open chat, header, messages, panels.

You asked for **placeholder buttons** for read-only-adjacent chrome (calls, Meta AI, menus, etc.) that **do not have to function**, except where noted below for **session-only interaction**.

You also said **exclude** from full parity (or keep minimal):

- **Bottom chat composer** and **voice note** bar as on live WhatsApp — i.e. not a real messaging surface tied to WhatsApp servers.

### Filters and list behavior

- Filter row: **`All · Unread · Favourites · Groups`** (Favourites **at top** with All/Unread/Groups — your explicit order).
- **Favourites** from DB (`favorite` table; you have **one** favourite contact today — do not invent more from Desktop).
- **Pinned chats at top of All** (above Archived), with pin glyph — the three you named repeatedly:
  - **IEEE CompSoc Core 2026/27**
  - **S1+S2 ವಿಧಾನ ಸೌಧ** (Kannada / “vidhan soudha”)
  - **S1+S2 CSE** (community / announcements context)
- Android backup has **no reliable chat-pin column** (`thread_id.pin_timestamp` empty; Desktop `ZFLAGS` bit is **not** a clean pin flag). Pins may require a **viewer-side relation** resolved from **subjects → chat ids**, not magic strings scattered in JS.

### Communities (must not be omitted)

Full Desktop-style **community panel**:

- List/open communities (`group_type` 3, `community_chat.closed = 0`).
- **Announcements** row (the type-3 community chat).
- **Groups you're in** vs **Groups you can join** from **`message_system_with_group_nodes`** + latest link/unlink semantics — not screenshot guessing.
- **Community info**: description if present, group count, members/admins where **`group_participant_user.rank`** (or equivalent) allows.
- Subgroup **Group info**: line like **“Group in {community}”** when a DB link exists.

Known **backup gaps** (show on Desktop, weak/no node rows): e.g. some SIH / IEEE Executive subgroups — **leave unlinked**, document in FEATURES.md.

### Contacts and names

- **Saved contacts** must show in **left pane and inside chat bubbles** (you flagged Vishruth: saved in list but not in thread — that was a real bug).
- **Unsaved**: show **~push name on the left, number on the right** only when the DB has a **real** name — **not** masked lid strings (`+91∙∙∙∙`, U+2219, etc.).
- Address book: **union** of Google + phone + SIM contacts pulled **read-only** from device; merged into **arch.contacts** in archiver DB — **nothing written back to phone**.

### Search

- Desktop-like sidebar search: Chats, Groups in common (only when member is **mapped** in backup), Media filters, Messages with highlights.
- Full-text index over ~1.38M messages into **`.wa_viewer.db`** (viewer-only write); do not run duplicate bulk indexes.

### Receipts and ticks

- **No raw JID tables** in receipt popups — **Read/Delivered by names** like Desktop.
- Outgoing **✓ / ✓✓ / blue ✓✓** from `message.status` in list and bubbles.

### Media and PfPs

- Serve media from archived paths when files exist; honest missing-file state when not (~2,786 DB paths without files).
- **Most profile photos** are **not** in backup (app-private avatars) — do not invent; use DB JPEGs where stored (group photo-change, copied profile photo folder).
- **Viewer reads PfPs only from `<archive>/`** (`Media/WhatsApp Profile Photos`, `viewer-assets/*`). To add icons from phone media or a **one-time** Desktop export, run `scripts/ingest-viewer-assets.py` — the running app must **not** read live Desktop or sibling `phone-copy` paths.

### Menus

- **Right-click / header / list menus** should **look** like Desktop.
- **Write actions** (Reply/Send to server, React persist, Star/Pin/Forward/Delete/Report, Mute, Archive/Clear/Exit, calls, Edit community, Add members) are either **placeholders**, **session-only**, or **omitted** — see §5.

### Documentation you asked for

- **One** markdown feature catalog: **`docs/FEATURES.md`** — many items (100+), grouped, each with **Implemented / Not implemented yet / Omitted**. **Update it in the same session as Desktop screenshots and viewer UI work** so it stays the ground truth for what is cloned vs deferred.
- **`docs/DESKTOP_DIVERGENCES.md`**: short **working diff** (Desktop vs viewer); shrink it as parity improves.
- **This file (`INTENT.md`)**: your **intent and constraints** for review when the model changes.
- **Reference screenshots**: **`logs/ui-compare/desktop-2.26.41.28/`** in this repo (indexed in **`docs/1) UI_GROUND_TRUTH.txt`**). Add new Desktop captures there when exploring; commit when you want them versioned.

---

## 5. Interactive “play mode” vs real WhatsApp (your newer ask)

You want the site to feel **more realistic and interactive** without polluting the backup:

- **Reply, react, star, pin (message), mark unread, archive, mute, etc.** can work in the **UI** as **session-only** changes stored in the browser (e.g. `localStorage`), **not** written to `msgstore` or phone by default.
- A **Reset** control (e.g. in **Settings**) clears **all** such session interactions and returns the UI to **pure backup state**.
- Placeholder toasts for things that must never write (Export, Clear chat, Exit group, real calls, Meta AI, Updates feed, etc.) are acceptable if labeled as preview/archive.

**Still excluded from “real” implementation:** bottom **composer + voice note** as live WhatsApp (you can use a **temporary reply bar** or similar for session replies without implying server send).

---

## 6. Technical environment you care about

- Viewer: **`wab-viewer`** from this repo, Python **3.14** venv on archive machine, port **8766** (5000 = macOS Control Center; 8765 was busy).
- Static **JS/CSS** hot from disk; **template + Python** need **process restart**.
- Desktop automation: **Accessibility** on; AppleScript System Events may be denied — **CGEvent** clicks work; capture WhatsApp window by **window id**, not full screen (wrong app risk).
- Phone **not always connected** (`adb devices` empty) — contact pull when allowed, read-only.

---

## 7. Explicit “do not” list (easy intent collapse points)

| Do not | Why |
|--------|-----|
| Commit/push without your prompt | You own version cadence |
| Send messages or submit drafts on Desktop | Live app safety |
| Write phone or live Desktop DBs | Read-only archive |
| Hardcode community graphs from screenshots | DB-only rule |
| Show masked lids as contact names | You called this out |
| Treat Desktop pin flag as ground truth for 3 pins | Backup has no pin bit; 105 chats share a flag |
| Replace FEATURES.md with numbered doc series | You wanted **one** feature file |
| Mark the parity goal “done” while communities/favourites/pins/menus/rails still diverge | Your standing instruction |
| Skip updating FEATURES.md after Desktop exploration or UI changes | FEATURES.md is the checklist; stale docs hide gaps |
| Implement UI from screenshots when the backup has no row | §2 data fidelity |

---

## 8. Priority order (when implementing)

1. **Desktop clone loop (§3)** — screenshot → **FEATURES.md** + **DESKTOP_DIVERGENCES.md** → viewer → browser verify.
2. **INTENT.md** (this file) and **FEATURES.md** kept accurate after each parity pass.
3. **Desktop-like shell**: left rail, middle list, empty/right pane tokens (colors, icons, spacing), filters including **Favourites**, **Reset** + session overlay.
4. **Pinned three chats** at top (viewer relation from subjects/ids).
5. **Community UI** from `message_system_with_group_nodes` + `community_chat` / `group_type`.
6. **Subgroup → community** link in group info.
7. Read-only **Copy / Message info** in context menus; other menu rows placeholder or session-only as above.
8. Repeat until clone-scope items in FEATURES.md are **Implemented** or **Omitted** with a stated reason.

---

## 9. What you will review

- Does the viewer still **never** touch live WhatsApp data?
- Do names, ticks, reactions, search, archived/starred, polls, link cards match what you remember from Desktop **for the backup date**?
- Are **Favourites**, **three pins**, and **community panels** present and **DB-backed**?
- Does **Reset** truly wipe fake sends/reactions/archive toggles?
- Are remaining gaps **listed in FEATURES.md** as omitted or not implemented, not silently ignored?

If anything in this file is wrong or missing, edit it or tell the agent — it is the intent anchor when the model changes.
