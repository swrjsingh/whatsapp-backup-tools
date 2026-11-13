# Archive viewer feature list

One file. Add a line under the group it belongs to. Each group has three buckets:

- **Implemented** — in the viewer now, from the backup.
- **Not implemented yet** — still to build. The backup has the data, or you asked for it anyway.
- **Omitted** — the Android backup does not store it, or it would change WhatsApp (send, delete, mute, call). Say if you want one of these pulled in later.

Desktop is the live app. This archive stops at the 18 Oct 2026 backup, so counts and “last message” can differ from Desktop on purpose.

### Keeping this file current (required)

While working toward **Desktop clone parity** (see [INTENT.md](./INTENT.md) §3):

1. **Screenshot Desktop read-only** — each meaningful screen/state → `logs/ui-compare/`.
2. **Update this file in the same pass** — move items between buckets; add missing Desktop surfaces; mark **Omitted** when the backup or read-only rules block implementation (not when someone skipped updating the doc).
3. **Implement the viewer** to match references; data from msgstore/archiver only.
4. **Verify** at `http://127.0.0.1:8766` against Desktop / screenshots.

Short visual diffs that do not need a new FEATURES row still go in [DESKTOP_DIVERGENCES.md](./DESKTOP_DIVERGENCES.md).

---

## 1. Window and left pane

### Implemented
- Local page at `http://127.0.0.1:8766`, dark theme aligned to Desktop tokens (`#0b141a`, `#111b21`, `#202c33`, `#00a884`).
- Three columns: **left nav rail** (~72px), **chat list** (~340px), **thread / empty pane**.
- Middle column is the chat list. Right column is the open chat or Desktop-style empty state.
- Left rail: Chats, Updates, Communities, Calls, Media, Meta AI; **More** → Archived, Starred; Settings; profile initial at bottom.
- Chats rail badge from backup unread total. Calls rail badge **13** (Desktop placeholder, not from backup).
- Archived / Starred counts on More rows (backup counts).
- Settings from rail and from **gear in the search row** (does not change phone or live app).
- **Reset session** in Settings (clears browser-only play state; not msgstore).
- Empty pane: WhatsApp-style logo, title, encrypted line, “Select a chat…” hint.
- Sidebar title **Chats**, compose/new-chat placeholder icon, filter pills, search **“Ask Meta AI or Search”**.

### Not implemented yet
- Communities listed **under More in the rail** with chevrons and per-community rows (Desktop layout); viewer uses Communities nav + list/panel instead.
- Community row **expands in place** in the middle column instead of full community panel.
- Real profile photo at bottom of rail (backup has almost no PfPs).
- Rail badge counts on individual community rows in More.
- Overlapping icon when a chat is both a group and sits inside a community.
- macOS window traffic lights and true window chrome.

### Omitted
- Updates / Status tab. Not in this backup.
- Calls tab and call log as a home screen. `call_log` exists (3,675 rows) but it is not a chat surface.
- Meta AI.
- New-chat button that starts a chat.
- Window controls, picture-in-picture, and “open in new window”.

---

## 2. Chat list rows

### Implemented
- Row layout: avatar, name, preview, time on the right.
- Group icon is a green circle with people, until a real photo exists.
- Person row uses a letter if the name is saved, otherwise a person icon.
- Real photo when the backup stored one. That is 26 chats: group icons saved on “photo changed”, plus one profile-photo file.
- Time: today as a clock time, yesterday as “Yesterday”, older as `dd/mm/yy`.
- Preview text, cut short.
- `You:` on your last message.
- `~Name:` on someone else’s last message in a group.
- Photo, video, voice, sticker, gif, document, link labels in the preview.
- Unread count as a green pill.
- Green double-tick, grey double-tick, or single tick in front of `You:` from `message.status`.
- Reaction as the preview when that reaction is newer than the last message (`You reacted ❤️ to "…"` or `Reacted …`). 154 chats.
- Phone numbers shown as `+91 …`, not `Unknown (00…)` and not raw `@s.whatsapp.net`.
- Group title is `chat.subject`, not the raw group id.
- Saved address-book name on 1:1 rows.
- List scrolls. Archived chats are not mixed into All.
- Pinned chats at top of **All** (viewer pin list from subjects: IEEE CompSoc Core 2026/27, S1+S2 ವಿಧಾನ ಸೌಧ, S1+S2 CSE). Backup `pin_timestamp` empty.
- Gray **pin icon** under time on pinned rows (SVG, not emoji).
- Community chevron on a community row; click opens **community panel** (not only announcement thread).
- **Announcements** subtitle on community rows in the list.

### Not implemented yet
- Mute glyph (bell with a slash). No per-chat mute time in msgstore.
- Draft preview in green (`Draft: …`). Drafts are on the live app, not in the backup.
- Missed voice/video call as the preview, with the red phone icon. `call_log` can supply this.
- Unread count in green text instead of only a pill, the way some community rows do it.
- Typing and recording indicators.
- Last-seen or online under a name. Not in the backup.
- Message yourself row.
- Broadcast-list rows.
- Locked-chat badge (`chat_lock` exists; not shown).
- Disappearing-message timer on the row.
- Business account label.
- Newsletter / channel rows.

### Omitted
- Live reorder as new messages arrive after 18 Oct 2026.
- Mark as unread from the list. That writes state.
- Swipe actions.

---

## 3. Filters, archive, starred, favourites

### Implemented
- Chips: All, Unread, **Favourites**, Groups (Desktop order).
- Favourites filter wired to `favorite` table (backup has one favourite contact).
- Unread chip shows the backup count (27). Desktop’s 22 is the live app, left as-is.
- Unread filter keeps chats with `unseen_message_count > 0`.
- Groups filter keeps chats that have a subject.
- Archived row, with the backup count (123). Desktop’s 23 is the live app.
- Archived opens its own list with a back row.
- Starred row, count 48, from `message.starred = 1`.
- Starred opens those messages and jumps to the one you click.
- Leaving a filter returns to All.

### Not implemented yet
- Empty Favourites state copy when filter has zero rows (edge case if favourite removed from backup).
- Favourites sorted by `favorite.sort_order`.
- Starred message keeps the star icon on the bubble itself, not only in the Starred list.
- Archived list still shows the same row layout (ticks, reactions, photos).

### Omitted
- Favourites as a label you can assign now. `labeled_jid` is empty. The Favorites label row exists and has no members.
- Unread and Archived counts matching Desktop after the backup. You said the count gap is fine.

---

## 4. Search

### Implemented
- Sidebar field placeholder is **`Ask Meta AI or Search`** (Desktop wording).
- While searching, the chat list hides.
- Sections: Chats, Groups in common, Media, Messages.
- Chats match name or number.
- Groups in common only if that person is a mapped group member. Up to 12. Subtitle `~Name is also in this group`.
- Media chips: Photos, Links, Videos, Documents, from message hits.
- Message hits show the chat name, date, and the query highlighted.
- Document hits can show as a card.
- In-chat find, with previous / next.
- Jump to a date.
- Clearing the query restores the list.

### Not implemented yet
- Search across every chat without opening it first. A full index of the 1.38M messages was started and was still running.
- Search inside one community only.
- “Groups you’re in” vs name match kept as separate sections the way Desktop does.
- Filter row hidden the same way Desktop hides All / Unread / Favourites while searching.
- Keyboard: Esc leaves search. Enter must not send.
- Recent searches.

### Omitted
- Search that includes messages from after the backup.

---

## 5. Chat header

### Implemented
- Name.
- Group subtitle: saved member names, comma separated. Fam is `Mum, Rimi Di, You`.
- Photo in the header when that chat has one.
- Pinned-message bar under the title when `message_add_on_pin_in_chat` state is 1. Click jumps to it. Fam’s pin is “Hi All…”.
- Buttons: chat info, media, in-chat search.

### Implemented
- Header **video, voice, search, and `…` menu** as placeholder icons (SVG); no real calls.
- Group info opens as a **right-side drawer** with hero avatar.

### Not implemented yet
- 1:1 subtitle is the phone number, or “Click for contact info”.
- Header says `Group · N members` on the info card, and the short name list stays in the header.
- Announcement chats show a megaphone and the label Announcements when opened from a community.
- Community header: picture, name, and the word Community.
- Back control when a community panel replaced the list.
- Encryption notice is only inside info, not the header.
- Disappearing-messages icon in the header.
- Muted icon in the header.

### Omitted
- Call buttons that start a call.
- Edit subject, edit photo, add member.

---

## 6. Message bubbles

### Implemented
- Yours on the right, theirs on the left.
- Dark incoming bubble, green outgoing bubble.
- Time on the bubble is only the clock (`6:39 PM`), not the full date.
- Date chips: Today, Yesterday, otherwise `dd/mm/yyyy`.
- Group sender name, stable color per person.
- Saved contact: name only. Unsaved: phone. If a real push name exists, name on the left and number on the right.
- Masked lid strings (`+91∙∙∙∙`) are not shown as names.
- Reply quote, with the original sender. Click jumps to it.
- `Forwarded` when `origination_flags` has the forwarded bit.
- `Edited`, with the edit time on hover.
- Reactions under the bubble.
- Info control appears when the pointer is on the bubble, not always.
- Album of several photos as one grid.
- Service lines centered (joins, subject changes, and the action types the viewer already formats).
- Scroll up loads older messages. Scroll-to-bottom control.
- Opening a chat lands on the latest messages.
- Subtle **wallpaper-style pattern** on `#message-scroll` (approximation of Desktop doodle).

### Not implemented yet
- “N unread messages” divider.
- Your name in a reply quote inside a group you sent to.
- Forwarded-many-times label. The flag may distinguish it; not split out yet.
- Deleted-message tombstone (“You deleted this message” / “This message was deleted”).
- Star icon on a starred bubble.
- Kept-in-chat / pinned-in-chat marker on the bubble, separate from the header pin bar.
- Hover toolbar: reply, react, forward, star. Read-only viewer can show it and only enable Copy and Message info.
- Selected-message highlight.
- Gap between bubbles from the same person vs a new sender (tighter grouping).
- Tail on the first bubble in a run.
- Link text colored and clickable, opening locally or in the browser without sending.
- `@all` drawn as a mention chip. Raw `@all` still shows as text.
- Phone-number mentions that never mapped to a saved name stay as `@<lid>`.
- Bold, italic, strike, monospace. `waFormat` covers some of this; needs a pass against Desktop.
- Lists and quote blocks inside a message.
- Code block styling.
- Large emoji-only messages, bigger type.
- Text select and copy.
- “Read more” on long messages.

### Omitted
- Sending, editing, or deleting by typing in a composer.
- The Rimi Di draft. Do not type in that box on Desktop.

---

## 7. Receipts and ticks

### Implemented
- Outgoing tick from `message.status`: one grey (sent), two grey (delivered), two blue (read or played).
- Same ticks in the chat-list preview.
- Message info lists Read and Delivered by saved name or phone. No `number@s.whatsapp.net` table. No “copy path”.

### Not implemented yet
- Info popup matches Desktop’s sheet: title Read, then people with times, then Delivered.
- Played (voice) called out separately from Read.
- Remaining “delivered to N” count on big groups.
- Tick on the header pin preview.
- Blue tick color checked against a read message in the browser, not only in the DOM.

### Omitted
- Receipts that arrived after the backup. Desktop can show read while the backup still says delivered.

---

## 8. Polls, events, calls, system lines

### Implemented
- Poll question plus each option and `vote_total`. Example: “Do u guys want IEEE merch to be tech-y?” Yes 17, No 8.
- The usual join / leave / subject service lines that already have a formatter.

### Not implemented yet
- “You voted” in the chat-list preview. Votes are in `message_add_on_poll_vote`.
- See who voted, from `message_add_on_poll_vote_selected_option`.
- Quiz polls vs regular polls (`message_poll.poll_type`).
- Event card: title, time, place. One `message_event` row.
- RSVP counts from `message_add_on_event_response`.
- Missed call, voice call, video call, group call bubbles. `call_log` and `message_system_linked_group_call`.
- “Joined from the community” system line, worded like Desktop.
- “X added the group Y” / “X removed the group Y”.
- Number-changed line (`message_system_number_change`, 1,447 rows).
- Photo-changed line, and use that JPEG as the then-current icon.
- Disappearing-messages on/off line.
- Encryption system line at the start of a chat.
- Business greeting / away message.

### Omitted
- Casting a vote, RSVP, or joining a call.

---

## 9. Media, links, voice, documents

### Implemented
- Image, video, sticker, gif, audio, document, from the archived file when `file_path` is present.
- Missing file shows a short “not available” line instead of a broken image.
- Link card: title, description, and JPEG from `message_thumbnail` when that row exists (the Fam reel card matches Desktop’s title).
- Per-chat media gallery.
- vCard as a contact card, with a `.vcf` download.
- Voice message as an audio control.

### Not implemented yet
- Link card also shows the site host (`facebook.com`) and the small site icon.
- Video length (`0:19`) and a play button on the still.
- Voice waveform, not only a browser audio bar. Duration and playback speed.
- Document row: file name, size, type icon, page count.
- Gallery inside the chat: Photos, Videos, GIFs, Links, Docs, Audio, with the counts Desktop shows (Fam’s “Media, links and docs · 967”).
- Starred filter inside that gallery.
- Open an image larger, then next / previous.
- Sticker without a bubble background.
- GIF labeled as GIF, animated.
- Once-view / view-once placeholder. Opening it must not burn a view on a live account; this archive can just show the file.
- Album caption under the grid.
- Streaming video instead of download-then-play.
- Map / location bubble (`message` location rows, if present).
- Contact card opens that person’s chat.

### Omitted
- Save to camera roll as a write to the phone.
- Auto-download rules.

---

## 10. Contacts, names, photos

### Implemented
- Address book is the union of the Google, phone, and SIM contacts that were read off the phone. About 2,037 numbers. Nothing was written back.
- Chat list and group senders use that name.
- `@mention` becomes `@Saved Name` when `message_mentions` maps the jid and the address book has the name.
- Header lists those saved member names.
- One profile photo file, and group JPEGs stored on icon-change messages.

### Not implemented yet
- Photos for everyone else. Desktop has them because the live app downloaded them. The backup’s profile-photo folder has one file. Private app storage was not in the copy.
- Push names for unsaved people (`~Name` on the left, number on the right). `lid_display_name` is only a masked number. `wa.db` was not readable without root.
- “You” when the participant is your own jid, everywhere, not only when the address book says You.
- About / status text under a person (`Just chillin at the beachhhh`). Not seen as a column we render.
- Business name and category.
- Click a sender name to open that 1:1 chat.
- Click a mention to open that person.

### Omitted
- Editing a contact.
- Syncing contacts to the new phone. Out of this viewer.

---

## 11. Groups

### Implemented
- Subject as the title.
- Member list in chat info, saved name or phone, with “N more”.
- Member names in the header.
- Group vs person avatar shape.
- In-common groups on search.

### Not implemented yet
- Description under the title in info (`Add group description` stays empty unless `groups.description` or the system text has one).
- Created-by line and created date.
- Admin and owner labels. `group_participant_user.rank` is the column.
- Member count in the header and in info (`24 members`, `135 members`).
- “Group in &lt;Community&gt;” row on the group info card, opening that community. CompSoc Core is in IEEE Core Community 2026/27.
- Invite link row, from `message_group_invite`, shown as text, not as a join button.
- Pending participants vs joined (`group_participant_user.pending`).
- Only show current members, not people who left, if the table stores that.
- Group permissions screen (send messages, edit info). Read-only display if the columns exist.
- Announcement-only groups: you see the history and no composer.

### Omitted
- Add member, remove member, promote, demote, exit group.
- Change photo, subject, or description.
- Group call.

---

## 12. Communities

Desktop’s community screen is required, not optional. The backup has no `parent_group_participants` rows. Links that do exist are in `message_system_with_group_nodes` (a message in one chat points at another group). `community_chat` plus `chat.group_type` says which chats are communities.

`group_type` 3 and `community_chat.closed = 0` is the live community (also the announcements thread). `group_type` 1 with the same subject is the paired community jid subgroups point at. `group_type` 2 is a subgroup you are in. `group_type` 6 is often General.

### Implemented
- Community list via **Communities** nav; open `group_type` 3 communities from chat list (community rows).
- **Community panel** over the thread pane: back, title, menu placeholder.
- **Announcements** row (megaphone) opening the type-3 announcement chat.
- **Groups you’re in** from `message_system_with_group_nodes` + membership (latest link/unlink semantics).
- **Groups you can join** bucket when API finds linked groups you are not in (may be empty if backup has no unjoined links).
- **Community info** section (description when stored, group count).
- Verified against Desktop for **S1+S2 CSE** (subgroups present when link rows exist).
- Subgroup **“Group in …”** link from group info when `/api/chat-community` finds a parent.

### Not implemented yet
- Panel header matches Desktop pixel-perfect (Community label, photo, toolbar).
- `…` menu: Community info only (Edit community omitted — writes).
- Row preview, time, mute icon, and unread pill on community subgroup rows identical to main list.
- General subgroup speech-bubble icon when no photo.
- Community info member list sorted owner → admins → members from `rank`.
- Search inside the community only.
- Communities with `community_chat.closed = 1` hidden from main list (unless requested).
- Rail **More** layout listing each community with chevron (Desktop 2.26).

### Omitted
- Add members, add groups, edit community, exit community.
- Links that were never written into `message_system_with_group_nodes`. SIH 2026 and some “you can join” groups show on Desktop and have no link row in this backup. They stay unlinked until a real row exists. Do not paste them in from a screenshot.
- Nested communities. `nesting_state` is null on every `community_chat` row.

---

## 13. Chat info sheet

### Implemented
- Opens from the header.
- Group: description if stored, members, media size, first and last message time, sent / received counts.
- 1:1: name, number, media size, dates.

### Not implemented yet
- Desktop’s card: big photo, name, “Group · N members” or phone.
- Media, links and docs with a count, then the filtered gallery.
- Starred, with a count or None.
- Mute state, notify-for, disappearing messages, encryption line. Show the stored value. Tapping must not change it.
- Encryption copy: “Messages and calls are end-to-end encrypted.”
- Community block on a group card.
- Shared groups on a 1:1 card (same query as groups-in-common).
- Tabs on community info: Community and Announcements.

### Omitted
- Mute, notify, theme, save-to-downloads, wallpaper, report, block, clear, exit.
- Add members, add groups.

---

## 14. Right-click and other menus

### Implemented
- **Right-click** on chat list rows and messages opens a **Desktop-shaped context menu** (session-only or placeholder for write actions).
- Message info via hover control and menu where wired.

### Not implemented yet
- Right-click menu **pixel-perfect** match to Desktop (icons, dividers, disabled rows).
- From that sheet, only the read-only rows do anything: Copy, and Message info (starred state can be shown, not toggled).
- Select messages: highlight several, then copy. No delete.
- Right-click a chat in the list.
- From that menu, only Group info / Contact info and Export (a local copy) do anything.
- Header `…` for a group: Group info, Search, Select messages.
- Header `…` for a community: Community info.
- Header `…` for a person: Contact info, Search, Select messages.

### Omitted
- Reply, React, Star (as a write), Pin (as a write), Forward, Report, Delete.
- Mark as unread, Archive (as a write), Pin chat (as a write), Mute, Clear chat, Exit group.
- New group call, send call link, schedule call, video call, voice call.
- Open in new window, close chat (Desktop window management).
- Add members, Add groups, Edit community.

---

## 15. Composer

### Implemented
- No composer. This is a reader.

### Not implemented yet
- Nothing. A fake compose box would invite sending.

### Omitted
- Type, attach, emoji, sticker, voice note, send.
- The existing Desktop draft on Rimi Di. Do not focus that field and do not press Enter.

---

## 16. Behaviour details

### Implemented
- Read-only. The viewer does not send, and does not write the phone.
- Chat id for a group is `chat._id`. Chat id for a person is the phone number.
- Names come from the address book joined to jids, including lid-to-phone via `jid_map`.
- Opening a chat re-resolves sender names, so a contact imported later still shows inside old bubbles.
- Pinned message, poll, link card, and mentions are filled when the page of messages is served, including the cached recent page.
- Starred messages are the `starred = 1` rows.
- Archive split uses `chat.archived`.

### Implemented
- **Session overlay** (`localStorage`): reply bar, react/star/pin/archive toggles in UI; **Reset** in Settings.
- Favourites chip wired to `favorite` table.
- Pinned-chat order for three Desktop pins (viewer-side list).
- Community panel wired to `message_system_with_group_nodes` + community APIs.

### Not implemented yet
- Full-text index finished, then search hits every chat without per-chat open.
- Every Desktop screen from latest `logs/ui-compare/` pass captured as rows in this file.

### Omitted
- Any write to msgstore, the phone, or the live Desktop database.
- Hard-coding “this group is inside that community” because a screenshot showed it once, when no link row exists.
