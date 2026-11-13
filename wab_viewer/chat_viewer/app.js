(function () {
  'use strict';

  const SVG_ARCHIVE = '<span class="archived-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h18v2H3zM5 9v10l7-3 7 3V9"/></svg></span>';
  const SVG_STAR = '<span class="archived-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg></span>';
  const SVG_PIN = '<span class="pin-ico" title="Pinned chat"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.93 2.07a1 1 0 0 0-1.07.2L8.5 7.63 4.41 6.3a1 1 0 0 0-1.17 1.17l1.33 4.09-5.36 5.36a1 1 0 0 0 0 1.41l1.41 1.41a1 1 0 0 0 1.41 0l5.36-5.36 4.09 1.33a1 1 0 0 0 1.17-1.17l-1.33-4.09 5.36-5.36a1 1 0 0 0-.2-1.07 1 1 0 0 0-.86-.3h-2.74l-.55-2.09a1 1 0 0 0-.97-.77H9.74a1 1 0 0 0-.97.77L8.22 5.04H5.48a1 1 0 0 0-.96.77z"/></svg></span>';

  const outputRoot = window.OUTPUT_ROOT;
  const SESSION_KEY = 'wab_viewer_session_v1';
  const Session = {
    load() {
      try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}') || {};
      } catch (_) {
        return {};
      }
    },
    save(data) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    },
    reset() {
      localStorage.removeItem(SESSION_KEY);
    },
    ensure() {
      const d = this.load();
      if (!d.chats) d.chats = {};
      if (!d.messages) d.messages = {};
      if (!d.sent) d.sent = [];
      if (!d.drafts) d.drafts = {};
      return d;
    },
    chatKey(chat) {
      return (chat.type || 'contact') + ':' + chat.id;
    },
    chat(chat) {
      const d = this.ensure();
      return d.chats[this.chatKey(chat)] || {};
    },
    setChat(chat, patch) {
      const d = this.ensure();
      const k = this.chatKey(chat);
      d.chats[k] = Object.assign({}, d.chats[k] || {}, patch);
      this.save(d);
    },
    msg(msgId) {
      const d = this.ensure();
      return d.messages[String(msgId)] || {};
    },
    setMsg(msgId, patch) {
      const d = this.ensure();
      const k = String(msgId);
      d.messages[k] = Object.assign({}, d.messages[k] || {}, patch);
      this.save(d);
    },
    addSent(chat, payload) {
      const d = this.ensure();
      d.sent.push(Object.assign({ ts: Date.now(), chat_id: chat.id, chat_type: chat.type }, payload));
      this.save(d);
    },
    sentForChat(chat) {
      return this.ensure().sent.filter(s => s.chat_id === chat.id && s.chat_type === chat.type);
    },
  };

  let pinnedChatOrder = [];
  let allChats = [];
  let currentChat = null;
  let replyTarget = null;
  let contextMsg = null;
  let msgList = [];
  let suppressScroll = false;
  let prefs = { theme: 'dark', date_format: 'DD/MM/YYYY', font_size: 'medium' };

  async function loadPrefs() {
    const res = await fetch('/api/preferences');
    prefs = await res.json();
    applyPrefs();
  }

  function applyPrefs() {
    document.documentElement.dataset.theme = prefs.theme;
    const scheme = prefs.theme === 'light' ? 'light' : 'dark';
    document.documentElement.style.colorScheme = scheme;
    document.getElementById('meta-color-scheme').content = scheme;
    document.getElementById('date-picker-input').style.colorScheme = scheme;
    const sizeMap = { small: '13px', medium: '15px', large: '17px' };
    document.documentElement.style.setProperty('--font-size', sizeMap[prefs.font_size] || '15px');
    document.querySelectorAll('.pref-btn').forEach(btn => {
      btn.classList.toggle('active', prefs[btn.dataset.pref] === btn.dataset.value);
    });
  }
  const MAX_WINDOW = 150;

  // ---- util ----------------------------------------------------------------

  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function fmtBubbleTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  const SENDER_COLORS = ['#e542a3', '#53bdeb', '#ffb938', '#06cf9c', '#7f66ff', '#ff6b6b', '#35cd96', '#dfb610'];
  function senderColor(key) {
    let hash = 0;
    for (const ch of String(key || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return SENDER_COLORS[hash % SENDER_COLORS.length];
  }

  function fmtListWhen(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(2);
    return dd + '/' + mm + '/' + yy;
  }

  function formatPhoneDigits(digits) {
    let d = String(digits || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.replace(/^0+/, '');
    if (d.length < 8) return d ? '+' + d : '';
    if (d.startsWith('91') && d.length === 12) return '+91 ' + d.slice(2, 7) + ' ' + d.slice(7);
    if (d.length > 10) {
      const cc = d.slice(0, d.length - 10);
      const nat = d.slice(d.length - 10);
      return '+' + cc + ' ' + nat.slice(0, 5) + ' ' + nat.slice(5);
    }
    return '+' + d;
  }

  function prettyLabel(name) {
    if (!name) return '';
    const text = String(name).trim();
    const unk = text.match(/^Unknown \((0*)(\d+)\)$/i);
    if (unk) return formatPhoneDigits(unk[2]);
    const jid = text.match(/^(\d+)@(s\.whatsapp\.net|lid)$/i);
    if (jid) return formatPhoneDigits(jid[1]);
    const compact = text.replace(/[\s()-]/g, '');
    if (/^\+?\d{8,15}$/.test(compact)) return formatPhoneDigits(compact);
    return text;
  }

  const GROUP_AVATAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 11a3 3 0 1 0-2.83-4H13a3 3 0 0 0 .17 4.1A5 5 0 0 0 9 16h1.1A4.9 4.9 0 0 1 16 11zm-6 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.67 0-8 1.34-8 4v1h11.1A6.5 6.5 0 0 1 10 14z"/></svg>';
  const PERSON_AVATAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.33 0-8 1.67-8 4v2h16v-2c0-2.33-4.67-4-8-4z"/></svg>';

  function fillSender(el, msg) {
    el.className = 'msg-sender';
    el.replaceChildren();
    el.style.color = senderColor(msg.sender_phone || msg.sender || '');
    const phone = msg.sender_phone ? prettyLabel(msg.sender_phone) : '';
    if (msg.sender_saved) {
      el.textContent = msg.sender || '';
      return;
    }
    const senderDigits = String(msg.sender || '').replace(/\D/g, '');
    const phoneDigits = String(msg.sender_phone || '').replace(/\D/g, '');
    const push = msg.sender && senderDigits !== phoneDigits ? String(msg.sender) : '';
    if (push && phone) {
      const name = document.createElement('span');
      name.className = 'msg-sender-name';
      name.textContent = push.startsWith('~') ? push : '~' + push;
      const num = document.createElement('span');
      num.className = 'msg-sender-phone';
      num.textContent = phone;
      el.append(name, num);
      return;
    }
    el.textContent = prettyLabel(msg.sender || phone || '');
  }

  function avatarHtml(name, isGroup, chat) {
    if (chat && chat.has_avatar) {
      const url = '/api/avatar?' + new URLSearchParams({
        chat_id: chat.id,
        chat_type: chat.type || (isGroup ? 'group' : 'contact'),
      });
      return `<div class="chat-avatar has-photo"><img src="${esc(url)}" alt=""></div>`;
    }
    const label = prettyLabel(name);
    const letter = label && !label.startsWith('+') && !/^\d/.test(label) ? [...label][0].toUpperCase() : '';
    const inner = isGroup ? GROUP_AVATAR : (letter ? esc(letter) : PERSON_AVATAR);
    return `<div class="chat-avatar${isGroup ? ' group' : ''}">${inner}</div>`;
  }

  function renderText(text, mentions) {
    let html = highlight(text || '', '');
    for (const mention of mentions || []) {
      if (!mention.raw) continue;
      const label = mention.label || (mention.phone ? prettyLabel(mention.phone) : '');
      if (!label) continue;
      html = html.split(esc('@' + mention.raw)).join('<span class="mention">@' + esc(label) + '</span>');
    }
    return html;
  }

  function fmtDateSep(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    if (prefs.date_format === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
    if (prefs.date_format === 'YYYY/MM/DD') return `${yyyy}/${mm}/${dd}`;
    return `${dd}/${mm}/${yyyy}`;
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function monthKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() * 100 + (d.getMonth() + 1);
  }

  function fmtMonthHeader(ts) {
    const d = new Date(ts);
    if (d.getFullYear() === new Date().getFullYear()) {
      return d.toLocaleString('default', { month: 'long' });
    }
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  function activeArchiveDir() {
    // Returns the selected Sent/Received direction, or null for group chats (no tabs)
    if (!currentChat || currentChat.type !== 'contact') return null;
    const active = document.querySelector('.archive-tab.active');
    return active ? active.dataset.dir : null;
  }

  function archiveSegments(archivePath) {
    const parts = archivePath.split('/');
    // Contacts/<name>/<year>/Sent|Received/<file>  → parts[0]='Contacts'
    // Groups/<name>/<year>/<file>                  → parts[0]='Groups'
    if (parts[0] === 'Groups') return { year: parts[2], direction: null };
    return { year: parts[2], direction: parts[3] };
  }

  function buildArchiveView(items, direction) {
    const tree = document.getElementById('media-archive-tree');
    tree.innerHTML = '';
    if (archiveMediaObserver) {
      archiveMediaObserver.disconnect();
      archiveMediaObserver = null;
    }
    const observer = getArchiveMediaObserver();

    const filtered = items.filter(m => m.archive_path &&
      (direction === null || archiveSegments(m.archive_path).direction === direction));

    if (!filtered.length) {
      tree.innerHTML = galleryAllLoaded
        ? '<div class="archive-empty-notice" style="color:var(--text-muted);padding:16px">No media in this chat.</div>'
        : '<div class="archive-empty-notice" style="color:var(--text-muted);padding:16px">Loading…</div>';
      return;
    }

    const byYear = {};
    for (const msg of filtered) {
      const { year } = archiveSegments(msg.archive_path);
      (byYear[year] = byYear[year] || []).push(msg);
    }

    for (const year of Object.keys(byYear).sort((a, b) => b - a)) {
      const block = _createArchiveYearBlock(year);
      const grid = block.querySelector('.archive-year-grid');
      const countEl = block.querySelector('.archive-year-count');
      countEl.textContent = byYear[year].length;

      let lastMonth = null;
      for (const msg of byYear[year]) {
        const mk = monthKey(msg.timestamp_ms);
        if (mk !== lastMonth) {
          const mhdr = document.createElement('div');
          mhdr.className = 'gallery-month-header';
          mhdr.dataset.month = mk;
          mhdr.textContent = new Date(msg.timestamp_ms).toLocaleString('default', { month: 'long' });
          grid.appendChild(mhdr);
          lastMonth = mk;
        }
        const cell = renderGalleryItem(msg);
        if (activeTypes.size > 0 && !activeTypes.has(msg.media_type)) {
          cell.classList.add('type-hidden');
        }
        grid.appendChild(cell);
        if (cell.dataset.src && observer) {
          observer.observe(cell);
        }
      }

      tree.appendChild(block);
    }
  }

  function _createArchiveYearBlock(year) {
    const block = document.createElement('div');
    block.className = 'archive-year open';
    block.dataset.year = year;
    const hdr = document.createElement('div');
    hdr.className = 'archive-year-header';
    hdr.innerHTML =
      `<span class="archive-year-chevron">&#9658;</span><span>${year}</span>` +
      `<span class="archive-year-count" style="margin-left:auto;font-weight:400;color:var(--text-muted);font-size:12px">0</span>`;
    hdr.addEventListener('click', () => block.classList.toggle('open'));
    const grid = document.createElement('div');
    grid.className = 'archive-year-grid';
    block.appendChild(hdr);
    block.appendChild(grid);
    return block;
  }

  function _appendToArchiveView(items, direction) {
    const tree = document.getElementById('media-archive-tree');
    // clear empty notice placeholder if present
    tree.querySelectorAll('.archive-empty-notice').forEach(el => el.remove());

    const filtered = items.filter(m => m.archive_path &&
      (direction === null || archiveSegments(m.archive_path).direction === direction));
    if (!filtered.length) return;

    for (const msg of filtered) {
      const { year } = archiveSegments(msg.archive_path);

      let block = tree.querySelector(`.archive-year[data-year="${year}"]`);
      if (!block) {
        block = _createArchiveYearBlock(year);
        // insert in descending year order
        const after = [...tree.querySelectorAll('.archive-year')]
          .find(el => parseInt(el.dataset.year) < parseInt(year));
        tree.insertBefore(block, after || null);
      }

      const grid = block.querySelector('.archive-year-grid');
      const countEl = block.querySelector('.archive-year-count');
      countEl.textContent = parseInt(countEl.textContent || '0') + 1;

      const mk = monthKey(msg.timestamp_ms);
      let monthHdr = grid.querySelector(`.gallery-month-header[data-month="${mk}"]`);
      if (!monthHdr) {
        monthHdr = document.createElement('div');
        monthHdr.className = 'gallery-month-header';
        monthHdr.dataset.month = mk;
        monthHdr.textContent = new Date(msg.timestamp_ms).toLocaleString('default', { month: 'long' });
        // insert before the first section with an older month key
        const olderHdr = [...grid.querySelectorAll('.gallery-month-header')]
          .find(el => parseInt(el.dataset.month) < mk);
        grid.insertBefore(monthHdr, olderHdr || null);
      }
      // insert item after its month header, before the next month header
      const nextSection = [...grid.querySelectorAll('.gallery-month-header')]
        .find(el => parseInt(el.dataset.month) < mk) || null;
      const cell = renderGalleryItem(msg);
      if (activeTypes.size > 0 && !activeTypes.has(msg.media_type)) {
        cell.classList.add('type-hidden');
      }
      grid.insertBefore(cell, nextSection);
      if (cell.dataset.src) {
        getArchiveMediaObserver()?.observe(cell);
      }
    }
  }

  function showPlaceholderToast(text) {
    const el = document.getElementById('placeholder-toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(showPlaceholderToast._t);
    showPlaceholderToast._t = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function chatKeyFor(chat) {
    return Session.chatKey(chat);
  }

  function effectiveChatFlags(chat) {
    const o = Session.chat(chat);
    const archived = o.archived != null ? !!o.archived : !!chat.archived;
    const unseen = o.unseen_count != null ? o.unseen_count : (chat.unseen_count || 0);
    const pinned = o.pinned != null ? !!o.pinned : !!chat.is_pinned;
    const favorite = o.favorite != null ? !!o.favorite : !!chat.is_favorite;
    const muted = !!o.muted;
    return { archived, unseen_count: unseen, pinned, favorite, muted };
  }

  function hideContextMenu() {
    const m = document.getElementById('context-menu');
    if (m) m.hidden = true;
  }

  function showContextMenu(x, y, items) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    menu.innerHTML = '';
    items.forEach(it => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ctx-item' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : '');
      btn.textContent = it.label;
      btn.disabled = !!it.disabled;
      if (!it.disabled && it.action) btn.addEventListener('click', e => {
        e.stopPropagation();
        hideContextMenu();
        it.action();
      });
      menu.appendChild(btn);
    });
    menu.hidden = false;
    menu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 280) + 'px';
  }

  document.addEventListener('click', () => hideContextMenu());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideContextMenu();
      document.getElementById('emoji-picker').hidden = true;
      document.getElementById('reply-bar').hidden = true;
    }
  });

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function linkify(text) {
    if (!text) return '';
    const urlRe = /https?:\/\/[^\s<>"]+/g;
    let result = '';
    let last = 0;
    let m;
    while ((m = urlRe.exec(text)) !== null) {
      result += esc(text.slice(last, m.index));
      let url = m[0];
      // strip trailing punctuation that is unlikely to be part of the URL
      url = url.replace(/[.,;:!?)\\]'"]+$/, '');
      result += '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>';
      last = m.index + url.length;
      // advance past trailing chars we stripped so they get picked up as plain text
      urlRe.lastIndex = m.index + m[0].length;
    }
    result += esc(text.slice(last));
    return result;
  }

  function waFormat(text) {
    if (!text) return '';

    // 1. Extract ``` code blocks — protect from any inner formatting
    const codeBlocks = [];
    text = text.replace(/```([\s\S]*?)```/g, (_, content) => {
      codeBlocks.push(content);
      return '\x00CB' + (codeBlocks.length - 1) + '\x00';
    });

    // 2. Split on URLs so they bypass formatting but still become links
    const urlRe = /https?:\/\/[^\s<>"]+/g;
    const parts = [];
    let last = 0;
    let m;
    while ((m = urlRe.exec(text)) !== null) {
      if (m.index > last) parts.push({ type: 'text', val: text.slice(last, m.index) });
      let url = m[0].replace(/[.,;:!?)\\]'"]+$/, '');
      parts.push({ type: 'url', val: url });
      last = m.index + m[0].length;
      urlRe.lastIndex = last;
    }
    if (last < text.length) parts.push({ type: 'text', val: text.slice(last) });

    // 3. Format each non-URL segment
    const codespans = [];
    const formatted = parts.map(p => {
      if (p.type === 'url') {
        const u = esc(p.val);
        return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>';
      }
      let s = esc(p.val);

      // Protect inline code spans from inner formatting
      s = s.replace(/`([^`]+)`/g, (_, inner) => {
        codespans.push(inner);
        return '\x00CS' + (codespans.length - 1) + '\x00';
      });

      // Inline: bold *text*, italic _text_, strikethrough ~text~
      // Markers must touch non-space on both inner sides
      s = s.replace(/\*(\S(?:[^*]*\S)?)\*/g, '<strong>$1</strong>');
      s = s.replace(/_(\S(?:[^_]*\S)?)_/g, '<em>$1</em>');
      s = s.replace(/~(\S(?:[^~]*\S)?)~/g, '<s>$1</s>');

      // Restore inline code spans
      s = s.replace(/\x00CS(\d+)\x00/g, (_, i) => '<code>' + esc(codespans[+i]) + '</code>');

      // Block-level: process line by line
      const lines = s.split('\n');
      let inUl = false, inOl = false;
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        let ln = lines[i];
        const next = lines[i + 1];

        if (/^###\s/.test(ln))      { closeLists(); out.push('<h3>' + ln.slice(4) + '</h3>'); continue; }
        if (/^##\s/.test(ln))       { closeLists(); out.push('<h2>' + ln.slice(3) + '</h2>'); continue; }
        if (/^#\s/.test(ln))        { closeLists(); out.push('<h1>' + ln.slice(2) + '</h1>'); continue; }
        if (/^&gt;\s?/.test(ln))    { closeLists(); out.push('<blockquote>' + ln.replace(/^&gt;\s?/, '') + '</blockquote>'); continue; }

        if (/^[-*]\s/.test(ln)) {
          if (!inUl) { inUl = true; out.push('<ul>'); }
          out.push('<li>' + ln.slice(2) + '</li>');
          if (!next || !/^[-*]\s/.test(next)) { inUl = false; out.push('</ul>'); }
          continue;
        }
        if (/^\d+\.\s/.test(ln)) {
          if (!inOl) { inOl = true; out.push('<ol>'); }
          out.push('<li>' + ln.replace(/^\d+\.\s/, '') + '</li>');
          if (!next || !/^\d+\.\s/.test(next)) { inOl = false; out.push('</ol>'); }
          continue;
        }

        closeLists();
        out.push(ln);
      }
      closeLists();
      return out.join('<br>');

      function closeLists() {
        if (inUl) { inUl = false; out.push('</ul>'); }
        if (inOl) { inOl = false; out.push('</ol>'); }
      }
    }).join('');

    // 4. Restore code blocks
    return formatted.replace(/\x00CB(\d+)\x00/g, (_, i) =>
      '<pre><code>' + esc(codeBlocks[+i]) + '</code></pre>'
    );
  }

  function highlightPlain(text, q) {
    let flat = String(text || '').replace(/\s+/g, ' ').trim();
    if (flat.length > 110) flat = flat.slice(0, 110) + '…';
    let html = esc(flat);
    if (!q || !flat) return html;
    for (const w of q.trim().split(/\s+/)) {
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      html = html.replace(re, mm => '<mark>' + mm + '</mark>');
    }
    return html;
  }

  function highlight(text, q) {
    if (!q || !text) return waFormat(text || '');
    const words = q.trim().split(/\s+/);
    let result = waFormat(text);
    for (const w of words) {
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      result = result.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, txt) =>
        tag ? tag : txt.replace(re, mm => '<mark>' + mm + '</mark>')
      );
    }
    return result;
  }

  function makeDateSeparator(ts) {
    const el = document.createElement('div');
    el.className = 'date-separator';
    el.dataset.dayKey = dayKey(ts);
    el.innerHTML = `<span>${fmtDateSep(ts)}</span>`;
    return el;
  }

  // ---- load chats ----------------------------------------------------------

  async function loadChats() {
    document.getElementById('chat-list').innerHTML = '<div id="chat-list-notice"><div class="loading-spinner"></div>Loading Chats…</div>';
    const [res, pinRes] = await Promise.all([
      fetch('/api/chats'),
      fetch('/api/pinned-chats').catch(() => null),
    ]);
    allChats = await res.json();
    if (pinRes && pinRes.ok) {
      const pinData = await pinRes.json();
      pinnedChatOrder = pinData.ids || [];
    }
    for (const c of allChats) {
      c.display_name = prettyLabel(c.display_name) || prettyLabel(c.id) || c.display_name || c.id;
      if (c.last_msg_sender) c.last_msg_sender = prettyLabel(c.last_msg_sender);
      const flags = effectiveChatFlags(c);
      c.archived = flags.archived;
      c.unseen_count = flags.unseen_count;
      c.is_pinned = flags.pinned ? 1 : 0;
      c.is_favorite = flags.favorite ? 1 : 0;
      c.is_muted = flags.muted ? 1 : 0;
    }
    const unreadN = allChats.filter(c => !c.archived && c.unseen_count > 0).length;
    const chatsNavBtn = document.querySelector('.nav-rail-btn[data-nav="chats"]');
    if (chatsNavBtn) {
      chatsNavBtn.querySelector('.rail-badge')?.remove();
      if (unreadN > 0) {
        const b = document.createElement('span');
        b.className = 'rail-badge';
        b.textContent = unreadN > 99 ? '99+' : String(unreadN);
        chatsNavBtn.appendChild(b);
      }
    }
    const favN = allChats.filter(c => !c.archived && c.is_favorite).length;
    const favBtn = document.querySelector('.filter-btn[data-filter="favorites"]');
    if (favBtn) favBtn.textContent = favN ? 'Favourites ' + favN : 'Favourites';
    const unreadBtn = document.querySelector('.filter-btn[data-filter="unread"]');
    if (unreadBtn) unreadBtn.textContent = unreadN ? 'Unread ' + unreadN : 'Unread';
    renderChatList();
    fetch('/api/starred').then(r => r.json()).then(data => {
      starredItems = data.items || [];
      const countEl = document.getElementById('starred-count');
      if (countEl) countEl.textContent = starredItems.length ? String(starredItems.length) : '';
      const railStar = document.getElementById('rail-starred-count');
      if (railStar) railStar.textContent = starredItems.length ? String(starredItems.length) : '';
    }).catch(() => {});
    const archivedCount = allChats.filter(c => c.archived).length;
    const railArch = document.getElementById('rail-archived-count');
    if (railArch) railArch.textContent = archivedCount ? String(archivedCount) : '';
    const callsBtn = document.querySelector('.nav-rail-btn[data-nav="calls"]');
    if (callsBtn && !callsBtn.querySelector('.rail-badge')) {
      const b = document.createElement('span');
      b.className = 'rail-badge calls-badge';
      b.textContent = '13';
      b.title = 'Live Desktop count (preview)';
      callsBtn.appendChild(b);
    }
  }

  let currentFilter = 'all';

  let showingArchived = false;
  let showingStarred = false;
  let starredItems = null;

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      showingArchived = false;
      showingStarred = false;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChatList();
    });
  });

  function resetFilterTo(filter) {
    if (currentFilter === filter) return;
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    renderChatList();
  }

  let _indexPollGen = 0;

  function _startIndexPoll(chat) {
    const gen = ++_indexPollGen;
    const params = new URLSearchParams({chat_id: chat.id, chat_type: chat.type});
    async function poll() {
      if (gen !== _indexPollGen) return;
      try {
        const r = await fetch('/api/chat-index-status?' + params);
        const d = await r.json();
        if (gen !== _indexPollGen) return;
        if (d.status === 'done') {
          document.querySelector(`.chat-item[data-id="${chat.id}"][data-type="${chat.type}"] .index-spinner`)?.remove();
          return;
        }
        const liveEl = document.querySelector(`.chat-item[data-id="${chat.id}"][data-type="${chat.type}"]`);
        if (liveEl && !liveEl.querySelector('.index-spinner')) {
          const sp = document.createElement('span');
          sp.className = 'index-spinner';
          liveEl.querySelector('.chat-name').appendChild(sp);
        }
        setTimeout(poll, 500);
      } catch (_) {
        setTimeout(poll, 1000);
      }
    }
    poll();
  }

  const MEDIA_LABELS = {image:'📷 Photo', video:'🎥 Video', audio:'🎵 Voice message',
                        gif:'🎞 GIF', sticker:'🎭 Sticker', document:'📄 Document', link:'🔗 Link'};
  function tickHtml(receipt) {
    if (receipt === 'read' || receipt === 13 || receipt === 8) return '<span class="tick read">✓✓</span> ';
    if (receipt === 'delivered' || receipt === 5) return '<span class="tick">✓✓</span> ';
    if (receipt === 'sent' || receipt === 0 || receipt === 4) return '<span class="tick">✓</span> ';
    return '';
  }

  function appendReceipt(meta, msg) {
    if (!msg.receipt) return;
    const tick = document.createElement('span');
    tick.className = 'tick' + (msg.receipt === 'read' ? ' read' : '');
    tick.textContent = msg.receipt === 'sent' ? '✓' : '✓✓';
    meta.appendChild(tick);
  }

  function chatPreview(chat) {
    let prefix = '';
    if (chat.last_msg_type !== 'service') {
      if (chat.last_msg_from_me) prefix = tickHtml(chat.last_msg_status) + 'You: ';
      else if (chat.type === 'group' && chat.last_msg_sender) prefix = '~' + esc(prettyLabel(chat.last_msg_sender)) + ': ';
    }
    if (chat.last_msg_type === 'service') {
      return esc(chat.last_msg_preview || '…');
    }
    if (chat.last_msg_type !== 'text') {
      return prefix + (MEDIA_LABELS[chat.last_msg_type] || '📎 Media');
    }
    const text = chat.last_msg_preview || '';
    return (prefix + esc(text.slice(0, 80))) || '…';
  }

  function renderChatList() {
    const list = document.getElementById('chat-list');
    list.innerHTML = '';
    const archivedCount = allChats.filter(c => c.archived).length;
    let visible = allChats.filter(c => showingArchived ? c.archived : !c.archived);
    if (currentFilter === 'group' || currentFilter === 'contact') {
      visible = visible.filter(c => c.type === currentFilter);
    } else if (currentFilter === 'unread') {
      visible = visible.filter(c => c.unseen_count > 0);
    } else if (currentFilter === 'favorites') {
      visible = visible.filter(c => c.is_favorite);
    }

    if (currentFilter === 'all' && !showingArchived && !showingStarred && pinnedChatOrder.length) {
      const pinIndex = id => {
        const i = pinnedChatOrder.indexOf(String(id));
        return i === -1 ? 9999 : i;
      };
      visible.sort((a, b) => {
        const pa = a.is_pinned ? pinIndex(a.id) : 9999;
        const pb = b.is_pinned ? pinIndex(b.id) : 9999;
        if (pa !== pb) return pa - pb;
        return (b.newest_ts || 0) - (a.newest_ts || 0);
      });
    } else {
      visible.sort((a, b) => (b.newest_ts || 0) - (a.newest_ts || 0));
    }

    if (showingStarred) {
      const back = document.createElement('div');
      back.className = 'archived-row';
      back.innerHTML = '<span class="archived-ico">&#8592;</span><span class="archived-label">Starred</span>';
      back.addEventListener('click', () => { showingStarred = false; renderChatList(); });
      list.appendChild(back);
      (starredItems || []).forEach(item => {
        const el = document.createElement('div');
        el.className = 'chat-item';
        const name = prettyLabel(item.chat_name) || item.chat_name;
        const preview = item.text ? esc(item.text.slice(0, 80)) : 'Starred message';
        el.innerHTML =
          avatarHtml(name, item.chat_type === 'group') +
          `<div class="chat-body"><div class="chat-top"><div class="chat-name">${esc(name)}</div><div class="chat-when">${esc(fmtListWhen(item.timestamp_ms))}</div></div><div class="chat-meta-row"><div class="chat-meta">${preview}</div></div></div>`;
        el.addEventListener('click', () => openStarred(item, el));
        list.appendChild(el);
      });
      return;
    }

    if (showingArchived) {
      const back = document.createElement('div');
      back.className = 'archived-row';
      back.innerHTML = '<span class="archived-ico">&#8592;</span><span class="archived-label">Archived</span>';
      back.addEventListener('click', () => { showingArchived = false; renderChatList(); });
      list.appendChild(back);
    } else if (currentFilter === 'all' && archivedCount) {
      const row = document.createElement('div');
      row.className = 'archived-row';
      row.innerHTML = `${SVG_ARCHIVE}<span class="archived-label">Archived</span><span class="archived-count">${archivedCount}</span>`;
      row.addEventListener('click', () => { showingArchived = true; showingStarred = false; renderChatList(); });
      list.appendChild(row);
      const star = document.createElement('div');
      star.className = 'archived-row';
      star.innerHTML = `${SVG_STAR}<span class="archived-label">Starred</span><span class="archived-count" id="starred-count"></span>`;
      star.addEventListener('click', () => openStarredList());
      list.appendChild(star);
    }

    visible.forEach(chat => {
      const el = document.createElement('div');
      let cls = 'chat-item' + (chat.type === 'group' ? ' group' : '');
      if (chat.is_pinned) cls += ' pinned-chat';
      if (chat.is_community) cls += ' community-row';
      el.className = cls;
      el.dataset.id = chat.id;
      el.dataset.type = chat.type;
      const name = prettyLabel(chat.display_name) || prettyLabel(chat.id) || chat.id;
      let previewHtml = chatPreview(chat);
      if (chat.is_community) {
        previewHtml = '<span class="community-sub">Announcements</span>';
      }
      const badge = chat.unseen_count > 0
        ? `<span class="unread-badge">${chat.unseen_count > 99 ? '99+' : chat.unseen_count}</span>`
        : '';
      const whenCol = chat.is_pinned
        ? `<div class="chat-when-col"><div class="chat-when">${esc(fmtListWhen(chat.newest_ts))}</div>${SVG_PIN}</div>`
        : `<div class="chat-when">${esc(fmtListWhen(chat.newest_ts))}</div>`;
      el.innerHTML =
        avatarHtml(name, chat.type === 'group' || chat.is_community, chat) +
        `<div class="chat-body"><div class="chat-top"><div class="chat-name">${esc(name)}${chat.is_community ? ' <span class="community-chev">›</span>' : ''}</div>${whenCol}</div><div class="chat-meta-row"><div class="chat-meta">${previewHtml}</div>${badge}</div></div>`;
      el.addEventListener('click', () => {
        if (chat.is_community) openCommunityPanel(chat.id);
        else selectChat(chat, el);
      });
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        showChatListContextMenu(e.clientX, e.clientY, chat, el);
      });
      list.appendChild(el);
    });
  }

  function showChatListContextMenu(x, y, chat, el) {
    showContextMenu(x, y, [
      { label: 'Open in new window', action: () => showPlaceholderToast('Open in new window (archive preview only)') },
      { label: 'Mark as unread', action: () => { Session.setChat(chat, { unseen_count: Math.max(1, chat.unseen_count || 0) }); loadChats(); } },
      { label: 'Archive chat', action: () => { Session.setChat(chat, { archived: true }); loadChats(); } },
      { label: chat.is_pinned ? 'Unpin chat' : 'Pin chat', action: () => { Session.setChat(chat, { pinned: !chat.is_pinned }); loadChats(); } },
      { label: chat.is_muted ? 'Unmute notifications' : 'Mute notifications', action: () => { Session.setChat(chat, { muted: !chat.is_muted }); showPlaceholderToast(chat.is_muted ? 'Unmuted (session only)' : 'Muted (session only)'); loadChats(); } },
      { label: chat.type === 'group' ? 'Group info' : 'Contact info', action: () => selectChat(chat, el).then(() => openChatInfo()) },
      { label: 'Export chat', action: () => showPlaceholderToast('Export is not wired yet') },
      { label: 'Clear chat', danger: true, action: () => showPlaceholderToast('Clear chat is disabled in the archive') },
      { label: 'Exit group', danger: true, disabled: chat.type !== 'group', action: () => showPlaceholderToast('Exit group is disabled in the archive') },
    ]);
  }

  async function openStarredList() {
    if (!starredItems) {
      const data = await fetch('/api/starred').then(r => r.json());
      starredItems = data.items || [];
    }
    showingArchived = false;
    showingStarred = true;
    renderChatList();
  }

  async function openStarred(item, el) {
    const chat = allChats.find(c => String(c.id) === String(item.chat_id) && c.type === item.chat_type);
    if (!chat) return;
    await selectChat(chat, el);
    jumpToTimestamp(item.timestamp_ms, item.msg_id);
  }

  // ---- select chat ---------------------------------------------------------

  async function selectChat(chat, el) {
    _indexPollGen++;
    const gen = ++_loadGen;
    loading = false;
    document.querySelectorAll('.chat-item').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    closeChatInfo();
    closeCommunityPanel();
    currentChat = chat;
    msgList = [];
    noMoreOlder = false;
    noMoreNewer = true;

    const scroll = document.getElementById('message-scroll');
    scroll.innerHTML = '';
    document.getElementById('scroll-to-bottom').classList.remove('visible');

    document.getElementById('chat-header').style.display = 'flex';
    document.getElementById('chat-title').textContent = prettyLabel(chat.display_name) || chat.display_name;
    const headerAvatar = document.getElementById('chat-avatar');
    if (chat.has_avatar) {
      headerAvatar.src = '/api/avatar?' + new URLSearchParams({ chat_id: chat.id, chat_type: chat.type });
      headerAvatar.hidden = false;
    } else {
      headerAvatar.hidden = true;
      headerAvatar.removeAttribute('src');
    }
    const subEl = document.getElementById('chat-subtitle');
    subEl.hidden = true;
    subEl.textContent = '';
    if (chat.type === 'group') {
      fetch('/api/chat-subtitle?' + new URLSearchParams({ chat_id: chat.id, chat_type: chat.type }))
        .then(r => r.json())
        .then(sub => {
          if (currentChat !== chat || !sub || !sub.names || !sub.names.length) return;
          subEl.textContent = sub.names.join(', ');
          subEl.hidden = false;
        })
        .catch(() => {});
    }
    const pinEl = document.getElementById('chat-pin');
    pinEl.classList.remove('visible');
    pinEl.innerHTML = '';
    pinEl.onclick = null;
    fetch('/api/pinned?' + new URLSearchParams({ chat_id: chat.id, chat_type: chat.type }))
      .then(r => r.json())
      .then(pin => {
        if (currentChat !== chat || !pin || !pin.text) return;
        pinEl.innerHTML = `<span class="pin-label">Pinned</span><span class="pin-text">${esc(pin.text)}</span>`;
        pinEl.classList.add('visible');
        pinEl.onclick = () => jumpToTimestamp(pin.timestamp_ms, null);
      })
      .catch(() => {});
    document.getElementById('empty-pane').style.display = 'none';
    document.getElementById('search-results').classList.remove('has-results');
    document.getElementById('search-results').innerHTML = '';

    // reset in-chat search and date picker when switching chats
    document.getElementById('chat-search-input').value = '';
    document.getElementById('chat-search-clear').style.display = 'none';
    clearChatSearch();
    document.getElementById('date-picker-input').value = '';
    document.getElementById('date-go-btn').style.display = 'none';
    document.getElementById('date-clear-btn').style.display = 'none';

    const loadingEl = document.getElementById('chat-loading');
    loadingEl.style.display = 'flex';

    try {
      await loadMessages('older');
      if (gen !== _loadGen) return;
      appendSessionSentMessages();
      renderWindow();
      if (gen !== _loadGen) return;
      suppressScroll = true;
      scroll.scrollTop = scroll.scrollHeight;
      suppressScroll = false;
      await _awaitImagesSettled(scroll, 1500);
      if (gen !== _loadGen) return;
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      if (gen === _loadGen) {
        loadingEl.style.display = 'none';
        suppressScroll = false;
      }
    }
    if (gen === _loadGen) {
      await _pinToBottom(gen);
    }

    _startIndexPoll(chat);
  }

  // ---- load messages -------------------------------------------------------

  let loading = false;
  let _loadGen = 0;
  let noMoreOlder = false;
  let noMoreNewer = false;

  function showSpinner(position) {
    const el = document.createElement('div');
    el.className = 'load-spinner';
    el.id = 'load-spinner-' + position;
    el.textContent = '⟳';
    const scroll = document.getElementById('message-scroll');
    if (position === 'top') scroll.insertBefore(el, scroll.firstChild);
    else scroll.appendChild(el);
    return el;
  }

  function removeSpinner(position) {
    const el = document.getElementById('load-spinner-' + position);
    if (el) el.remove();
  }

  async function loadMessages(direction) {
    const gen = _loadGen;
    if (loading) return;
    if (direction === 'older' && noMoreOlder) return;
    if (direction === 'newer' && noMoreNewer) return;
    loading = true;

    const params = new URLSearchParams({
      chat_id: currentChat.id,
      chat_type: currentChat.type,
      limit: 50
    });
    if (direction === 'older' && msgList.length > 0) {
      params.set('before', msgList[0].timestamp_ms);
    } else if (direction === 'newer' && msgList.length > 0) {
      params.set('after', msgList[msgList.length - 1].timestamp_ms);
    }

    showSpinner(direction === 'older' ? 'top' : 'bottom');

    try {
      const res = await fetch('/api/messages?' + params);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const msgs = await res.json();
      removeSpinner(direction === 'older' ? 'top' : 'bottom');
      if (gen !== _loadGen) return;

      if (!msgs.length) {
        if (direction === 'older') noMoreOlder = true;
        else noMoreNewer = true;
        return;
      }
      if (direction === 'older' && msgs.length < 50 && !params.has('before')) {
        noMoreOlder = true;
      }

      suppressScroll = true;
      const anchor = captureAnchor(direction);
      mergePage(msgs);
      pruneList(direction);
      renderWindow();
      restoreAnchor(anchor);
      suppressScroll = false;

    } catch (err) {
      removeSpinner(direction === 'older' ? 'top' : 'bottom');
      console.error('loadMessages error:', err);
    } finally {
      if (gen === _loadGen) {
        loading = false;
      }
    }
  }

  // ---- media grouping -------------------------------------------------------
  //
  // Groups consecutive image/video messages from the same sender (within 2 min gaps)
  // into a 2x2 grid bubble. A run must have >= 4 items to qualify.

  const MEDIA_GROUP_GAP_MS = 2 * 60 * 1000;
  const MEDIA_GROUP_MIN = 4;

  function isGrouableMedia(msg) {
    return msg.archive_path && (msg.media_type === 'image' || msg.media_type === 'video');
  }

  function sameSender(a, b) {
    if (a.from_me !== b.from_me) return false;
    // For 1:1 chats, from_me alone is sufficient.
    // For groups, check display name; unknown sender (empty string) never matches.
    if (currentChat && currentChat.type === 'group') {
      if (!a.sender || !b.sender) return false;
      return a.sender === b.sender;
    }
    return true;
  }

  function rowForMsgId(id) {
    const key = String(id);
    const direct = document.querySelector(`.msg-row[data-msg-id="${key}"]`);
    if (direct) return direct;
    return document.querySelector(`.msg-row[data-group-ids~="${key}"]`) || null;
  }

  function nearestMsgToTs(ts) {
    if (!msgList.length) return null;
    return msgList.reduce((best, m) =>
      Math.abs(m.timestamp_ms - ts) < Math.abs(best.timestamp_ms - ts) ? m : best
    );
  }

  function captureAnchor(direction) {
    const scroll = document.getElementById('message-scroll');
    const top = scroll.getBoundingClientRect().top;
    const bottom = scroll.getBoundingClientRect().bottom;
    const rows = scroll.querySelectorAll('.msg-row[data-msg-id]');
    if (!rows.length) return null;

    if (direction === 'newer') {
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        const rect = row.getBoundingClientRect();
        if (rect.top < bottom && rect.bottom > top) {
          return { id: row.dataset.msgId, offset: rect.top - top };
        }
      }
    } else {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rect = row.getBoundingClientRect();
        if (rect.bottom > top) {
          return { id: row.dataset.msgId, offset: rect.top - top };
        }
      }
    }
    return null;
  }

  function restoreAnchor(anchor) {
    if (!anchor) return;
    const row = rowForMsgId(anchor.id);
    if (!row) return;
    const scroll = document.getElementById('message-scroll');
    const top = scroll.getBoundingClientRect().top;
    scroll.scrollTop += (row.getBoundingClientRect().top - top) - anchor.offset;
  }

  function applyMsgSession(msg) {
    if (!msg || msg.msg_id == null) return msg;
    const o = Session.msg(msg.msg_id);
    if (o.deleted) msg._session_deleted = true;
    if (o.starred) msg.starred = 1;
    if (o.extra_reactions && o.extra_reactions.length) {
      const base = (msg.reactions || '').split(',').filter(Boolean);
      msg.reactions = base.concat(o.extra_reactions).join(',');
    }
    if (o.receipt) msg.receipt = o.receipt;
    return msg;
  }

  function mergePage(newMsgs) {
    const seenIds = new Map(msgList.map(m => [String(m.msg_id), m]));
    for (const m of newMsgs) {
      applyMsgSession(m);
      if (!seenIds.has(String(m.msg_id))) {
        seenIds.set(String(m.msg_id), m);
        msgList.push(m);
      }
    }
    msgList.sort((a, b) => (a.timestamp_ms - b.timestamp_ms) || ((a.sort_id ?? a.msg_id) - (b.sort_id ?? b.msg_id)) || (a.msg_id - b.msg_id));
  }

  function appendSessionSentMessages() {
    if (!currentChat) return;
    const sent = Session.sentForChat(currentChat);
    for (const s of sent) {
      const tempId = 'sess-' + s.ts;
      if (msgList.some(m => String(m.msg_id) === tempId)) continue;
      msgList.push(applyMsgSession({
        msg_id: tempId,
        timestamp_ms: s.ts,
        from_me: 1,
        text_body: s.text || '',
        media_type: 'text',
        receipt: 'sent',
        quoted_text: s.quoted_text || '',
        quoted_sender: s.quoted_sender || '',
        quoted_ts: s.quoted_ts || null,
        _session_only: true,
      }));
    }
    msgList.sort((a, b) => (a.timestamp_ms - b.timestamp_ms) || 0);
  }

  function pruneList(direction) {
    if (msgList.length <= MAX_WINDOW) return;
    const drop = msgList.length - MAX_WINDOW;
    if (direction === 'older') {
      msgList.splice(msgList.length - drop, drop);
      noMoreNewer = false;
    } else {
      msgList.splice(0, drop);
      noMoreOlder = false;
    }
  }

  function computeRenderUnits(list) {
    const units = [];
    for (let i = 0; i < list.length;) {
      const first = list[i];
      if (isGrouableMedia(first)) {
        const run = [first];
        let j = i + 1;
        while (j < list.length) {
          const prev = run[run.length - 1];
          const curr = list[j];
          if (!isGrouableMedia(curr)) break;
          if (!sameSender(first, curr)) break;
          if (curr.timestamp_ms - prev.timestamp_ms > MEDIA_GROUP_GAP_MS) break;
          run.push(curr);
          j++;
        }
        if (run.length >= MEDIA_GROUP_MIN) {
          units.push({ type: 'group', members: run });
          i = j;
          continue;
        }
      }
      units.push({ type: 'single', msg: first });
      i++;
    }
    return units;
  }

  function renderWindow() {
    const scroll = document.getElementById('message-scroll');
    scroll.innerHTML = '';
    const units = computeRenderUnits(msgList);
    let prevTs = null;
    for (const unit of units) {
      const ts = unit.type === 'group' ? unit.members[0].timestamp_ms : unit.msg.timestamp_ms;
      if (prevTs === null || dayKey(ts) !== dayKey(prevTs)) {
        scroll.appendChild(makeDateSeparator(ts));
      }
      scroll.appendChild(renderBubble(unit));
      prevTs = unit.type === 'group'
        ? unit.members[unit.members.length - 1].timestamp_ms
        : unit.msg.timestamp_ms;
    }
  }

  async function jumpToMessage(msg) {
    const inWin = rowForMsgId(msg.msg_id);
    if (inWin) { inWin.scrollIntoView({ behavior: 'instant', block: 'center' }); return inWin; }
    await jumpToTimestamp(msg.timestamp_ms, msg.msg_id);
    const row = rowForMsgId(msg.msg_id);
    if (row) {
      suppressScroll = true;
      row.scrollIntoView({ behavior: 'instant', block: 'center' });
      suppressScroll = false;
    }
    return row;
  }

  function _attachMediaScrollAnchor(mediaEl) {
    mediaEl.addEventListener('load', () => {
      const scroll = document.getElementById('message-scroll');
      if (!scroll) return;
      const distFromBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
      if (distFromBottom < 40) {
        suppressScroll = true;
        scroll.scrollTop = scroll.scrollHeight;
        suppressScroll = false;
      }
    });
  }

  function renderMediaGrid(group) {
    const grid = document.createElement('div');
    grid.className = 'media-grid';

    const visible = group.slice(0, 4);
    visible.forEach((msg, idx) => {
      const cell = document.createElement('div');
      cell.className = 'media-grid-cell';

      // Build a lightweight media element (no caption, no reactions in grid)
      const wrap = document.createElement('div');
      wrap.className = 'msg-media';
      const src = '/media/' + msg.archive_path;
      const mt = msg.media_type;

      if (mt === 'image' || mt === 'gif' || mt === 'sticker') {
        const img = document.createElement('img');
        img.src = src;
        img.loading = 'lazy';
        img.alt = msg.media_name || 'image';
        img.addEventListener('click', () => showLightboxForGroup(group, idx));
        _attachMediaScrollAnchor(img);
        wrap.appendChild(img);
      } else if (mt === 'video') {
        const vid = document.createElement('video');
        vid.controls = true;
        vid.preload = 'none';
        vid.src = src;
        wrap.appendChild(vid);
        const probe = document.createElement('video');
        probe.src = src;
        probe.muted = true;
        probe.preload = 'metadata';
        probe.addEventListener('loadeddata', () => {
          const canvas = document.createElement('canvas');
          canvas.width = probe.videoWidth;
          canvas.height = probe.videoHeight;
          canvas.getContext('2d').drawImage(probe, 0, 0);
          vid.poster = canvas.toDataURL('image/jpeg', 0.8);
          probe.src = '';
          const scroll = document.getElementById('message-scroll');
          if (scroll && (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40)) {
            suppressScroll = true;
            scroll.scrollTop = scroll.scrollHeight;
            suppressScroll = false;
          }
        }, { once: true });
        probe.addEventListener('error', () => { probe.src = ''; }, { once: true });
      }

      cell.appendChild(wrap);

      // Overflow badge on the last visible cell
      if (idx === 3 && group.length > 4) {
        const badge = document.createElement('div');
        badge.className = 'media-grid-overflow';
        badge.textContent = '+' + (group.length - 4);
        cell.appendChild(badge);
      }

      grid.appendChild(cell);
    });

    return grid;
  }

  function showLightboxForGroup(group, index) {
    showLightbox(group[index]);
  }


  // ---- scroll trigger -------------------------------------------------------

  function setupScrollTrigger() {
    const scroll = document.getElementById('message-scroll');
    const btn = document.getElementById('scroll-to-bottom');
    scroll.addEventListener('scroll', function () {
      if (suppressScroll) return;
      hideMsgDetails();
      const atBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 100;
      btn.classList.toggle('visible', !atBottom);
      if (scroll.scrollTop < 100) {
        if (loading) return;
        loadMessages('older');
      } else if (atBottom) {
        if (loading) return;
        loadMessages('newer');
      }
    });
    btn.addEventListener('click', async () => {
      if (noMoreNewer) {
        await _pinToBottom(_loadGen);
        return;
      }
      const gen = ++_loadGen;
      msgList = [];
      noMoreOlder = false;
      noMoreNewer = true;
      await loadMessages('older');
      if (gen !== _loadGen) return;
      suppressScroll = true;
      scroll.scrollTop = scroll.scrollHeight;
      suppressScroll = false;
      await _awaitImagesSettled(scroll, 1500);
      if (gen !== _loadGen) return;
      await _pinToBottom(gen);
    });
  }
  setupScrollTrigger();

  function renderBubble(unit) {
    if (unit.type === 'group') {
      const group = unit.members;
      const msg = group[0];
      const row = document.createElement('div');
      row.className = 'msg-row ' + (msg.from_me ? 'sent' : 'recv');
      row.dataset.msgId = String(msg.msg_id);
      row.dataset.groupIds = group.map(m => String(m.msg_id)).join(' ');

      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';

      if (!msg.from_me && msg.sender) {
        const senderEl = document.createElement('div');
        fillSender(senderEl, msg);
        bubble.appendChild(senderEl);
      }

      bubble.appendChild(renderMediaGrid(group));

      const lastMsg = group[group.length - 1];
      if (lastMsg.text_body) {
        const cap = document.createElement('div');
        cap.className = 'msg-caption';
        cap.innerHTML = renderText(lastMsg.text_body, lastMsg.mentions);
        bubble.appendChild(cap);
      }

      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      const isGroupEdited = unit.members.some(m => m.is_edited);
      if (isGroupEdited) {
        const editedSpan = document.createElement('span');
        editedSpan.className = 'msg-edited';
        editedSpan.textContent = 'Edited';
        const editedTs = unit.members.find(m => m.edited_ts)?.edited_ts;
        if (editedTs) {
          editedSpan.title = 'Edited: ' + fmtTime(editedTs);
        }
        meta.appendChild(editedSpan);
      }
      meta.appendChild(document.createTextNode(fmtBubbleTime(msg.timestamp_ms)));
      appendReceipt(meta, msg);
      bubble.appendChild(meta);

      attachMessageContextMenu(row, lastMsg);
      row.appendChild(bubble);
      return row;
    }

    const msg = unit.msg;
    if (msg._session_deleted) {
      const row = document.createElement('div');
      row.className = 'msg-row service';
      row.innerHTML = '<div class="msg-service-bubble">You deleted this message</div>';
      return row;
    }
    if (msg.media_type === 'service') {
      const row = document.createElement('div');
      row.className = 'msg-row service';
      row.dataset.msgId = String(msg.msg_id);

      const bubble = document.createElement('div');
      bubble.className = 'msg-service-bubble';
      bubble.textContent = msg.text_body;
      if (msg.timestamp_ms) {
        bubble.title = fmtTime(msg.timestamp_ms);
      }

      row.appendChild(bubble);
      return row;
    }

    const row = document.createElement('div');
    row.className = 'msg-row ' + (msg.from_me ? 'sent' : 'recv');
    row.dataset.msgId = String(msg.msg_id);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    const senderEl = document.createElement('div');
    fillSender(senderEl, msg);
    if (msg.sender && !msg.from_me && currentChat && currentChat.type === 'group') bubble.appendChild(senderEl);

    if (msg.forwarded) {
      const forwarded = document.createElement('div');
      forwarded.className = 'msg-forwarded';
      forwarded.textContent = 'Forwarded';
      bubble.appendChild(forwarded);
    }

    if (msg.quoted_text) {
      const quote = document.createElement('div');
      quote.className = 'msg-quote';
      const qs = msg.quoted_sender;
      const qColor = senderColor(msg.quoted_sender_phone || qs || '');
      quote.style.borderLeftColor = qColor;
      const qSender = document.createElement('div');
      qSender.className = 'msg-quote-sender';
      qSender.style.color = qColor;
      qSender.textContent = prettyLabel(qs) || (currentChat && currentChat.type === 'contact' ? currentChat.display_name : '');
      const qText = document.createElement('div');
      qText.className = 'msg-quote-text';
      qText.textContent = msg.quoted_text;
      quote.appendChild(qSender);
      quote.appendChild(qText);
      if (msg.quoted_ts) {
        quote.style.cursor = 'pointer';
        quote.title = 'Jump to original message';
        quote.addEventListener('click', () => jumpToTimestamp(msg.quoted_ts, null));
      }
      bubble.appendChild(quote);
    }

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    const showInfo = msg.from_me ? !!msg.msg_id : !!msg.archive_path;
    if (showInfo) {
      const infoBtn = document.createElement('span');
      infoBtn.className = 'msg-info-btn';
      infoBtn.title = 'Message details';
      infoBtn.textContent = 'ⓘ';
      infoBtn.addEventListener('click', e => {
        e.stopPropagation();
        showMsgDetails(msg.from_me ? msg.msg_id : null, infoBtn, msg.archive_path || null);
      });
      meta.appendChild(infoBtn);
    }
    if (msg.is_edited) {
      const editedSpan = document.createElement('span');
      editedSpan.className = 'msg-edited';
      editedSpan.textContent = 'Edited';
      if (msg.edited_ts) {
        editedSpan.title = 'Edited: ' + fmtTime(msg.edited_ts);
      }
      meta.appendChild(editedSpan);
    }
    meta.appendChild(document.createTextNode(fmtBubbleTime(msg.timestamp_ms)));
    appendReceipt(meta, msg);
    if (msg.media_type === 'poll') {
      const q = document.createElement('div');
      q.className = 'msg-text';
      q.textContent = msg.text_body || 'Poll';
      bubble.appendChild(q);
      const options = msg.poll_options || [];
      const total = options.reduce((sum, o) => sum + (o.votes || 0), 0) || 1;
      options.forEach(o => {
        const opt = document.createElement('div');
        opt.className = 'msg-poll-opt';
        const name = document.createElement('div');
        name.textContent = o.name || '';
        const votes = document.createElement('span');
        votes.textContent = String(o.votes || 0);
        const bar = document.createElement('div');
        bar.className = 'msg-poll-bar';
        bar.style.width = Math.round(((o.votes || 0) / total) * 100) + '%';
        opt.appendChild(name);
        opt.appendChild(votes);
        opt.appendChild(bar);
        bubble.appendChild(opt);
      });
    } else if (msg.media_type === 'text' || !msg.archive_path) {
      if (!msg.archive_path && msg.media_type !== 'text' && msg.media_type !== 'link') {
        const txt = document.createElement('div');
        txt.className = 'msg-text msg-unavailable';
        const icon = msg.media_type === 'image' ? '🖼️' : msg.media_type === 'video' ? '🎥' :
                     msg.media_type === 'audio' ? '🎵' : msg.media_type === 'sticker' ? '🩹' :
                     msg.media_type === 'gif' ? '🎞️' : msg.media_type === 'vcard' ? '📇' : '📄';
        txt.innerHTML = esc(icon) + ' ' + renderText(msg.text_body || 'Media not available', msg.mentions);
        bubble.appendChild(txt);
      } else {
        const txt = document.createElement('div');
        txt.className = 'msg-text';
        txt.innerHTML = renderText(msg.text_body, msg.mentions);
        bubble.appendChild(txt);
      }
    } else {
      const mediaEl = renderMedia(msg);
      bubble.appendChild(mediaEl);
      if (msg.text_body && msg.media_type !== 'vcard') {
        const cap = document.createElement('div');
        cap.className = 'msg-caption';
        cap.innerHTML = renderText(msg.text_body, msg.mentions);
        bubble.appendChild(cap);
      }
    }

    if (msg.link_title) {
      const card = document.createElement('div');
      card.className = 'msg-link-card';
      if (msg.link_thumb) {
        const img = document.createElement('img');
        img.className = 'msg-link-thumb';
        img.alt = '';
        img.src = '/api/link-thumb/' + msg.msg_id;
        card.appendChild(img);
      }
      let linkHost = '';
      try {
        if (msg.link_url) linkHost = new URL(msg.link_url).hostname.replace(/^www\./, '');
      } catch (_) {}
      if (linkHost) {
        const host = document.createElement('div');
        host.className = 'msg-link-host';
        host.textContent = linkHost;
        card.appendChild(host);
      }
      const title = document.createElement('div');
      title.className = 'msg-link-title';
      title.textContent = msg.link_title;
      card.appendChild(title);
      if (msg.link_description && msg.link_description !== msg.link_title) {
        const desc = document.createElement('div');
        desc.className = 'msg-link-desc';
        desc.textContent = msg.link_description;
        card.appendChild(desc);
      }
      bubble.appendChild(card);
    }

    bubble.appendChild(meta);

    if (msg.reactions) {
      const emojis = msg.reactions.split(',').filter(Boolean);
      if (emojis.length) {
        row.classList.add('has-reactions');
        const rxEl = document.createElement('div');
        rxEl.className = 'msg-reactions';
        const distinct = Array.from(new Set(emojis));
        const emojiSpan = document.createElement('span');
        emojiSpan.className = 'rx-emojis';
        emojiSpan.textContent = distinct.slice(0, 3).join(' ');
        rxEl.appendChild(emojiSpan);

        if (emojis.length > 1) {
          const countSpan = document.createElement('span');
          countSpan.className = 'rx-count';
          countSpan.textContent = String(emojis.length);
          rxEl.appendChild(countSpan);
        }

        if (msg.msg_id !== undefined) {
          rxEl.addEventListener('click', e => {
            e.stopPropagation();
            showReactionDetails(msg.msg_id, rxEl);
          });
        }
        bubble.appendChild(rxEl);
      }
    }

    attachMessageContextMenu(row, msg);
    row.appendChild(bubble);
    return row;
  }

  function attachMessageContextMenu(row, msg) {
    if (msg.media_type === 'service' || msg._session_deleted) return;
    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      contextMsg = msg;
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Reply', action: () => openReplyBar(msg) },
        { label: 'React', action: () => openEmojiPicker(e.clientX, e.clientY, msg) },
        { label: Session.msg(msg.msg_id).starred ? 'Unstar' : 'Star', action: () => {
          Session.setMsg(msg.msg_id, { starred: !Session.msg(msg.msg_id).starred });
          renderWindow();
        }},
        { label: 'Pin', action: () => showPlaceholderToast('Pin message (session preview)') },
        { label: 'Forward', action: () => showPlaceholderToast('Forward is disabled in the archive') },
        { label: 'Copy', action: () => {
          const t = msg.text_body || '';
          if (t && navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
        }},
        { label: 'Message info', action: () => {
          const btn = row.querySelector('.msg-info-btn') || row;
          showMsgDetails(msg.from_me ? msg.msg_id : null, btn, msg.archive_path || null);
        }},
        { label: 'Report', action: () => showPlaceholderToast('Report is disabled in the archive') },
        { label: 'Delete', danger: true, action: () => {
          Session.setMsg(msg.msg_id, { deleted: true });
          renderWindow();
        }},
        { label: 'Select messages', action: () => showPlaceholderToast('Select messages (preview)') },
      ]);
    });
  }

  function openReplyBar(msg) {
    replyTarget = msg;
    const bar = document.getElementById('reply-bar');
    const prev = document.getElementById('reply-bar-preview');
    const input = document.getElementById('reply-bar-input');
    prev.textContent = 'Reply to: ' + (msg.text_body || '').slice(0, 80);
    input.value = '';
    bar.hidden = false;
    input.focus();
  }

  function openEmojiPicker(x, y, msg) {
    const picker = document.getElementById('emoji-picker');
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];
    picker.innerHTML = '';
    emojis.forEach(em => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'emoji-opt';
      b.textContent = em;
      b.addEventListener('click', () => {
        const prev = Session.msg(msg.msg_id).extra_reactions || [];
        Session.setMsg(msg.msg_id, { extra_reactions: prev.concat([em]) });
        picker.hidden = true;
        applyMsgSession(msg);
        renderWindow();
      });
      picker.appendChild(b);
    });
    picker.hidden = false;
    picker.style.left = Math.min(x, window.innerWidth - 230) + 'px';
    picker.style.top = Math.min(y, window.innerHeight - 120) + 'px';
  }

  function closeCommunityPanel() {
    const panel = document.getElementById('community-panel');
    if (panel) panel.hidden = true;
    document.getElementById('message-scroll').style.display = '';
  }

  async function openCommunityPanel(communityId) {
    const panel = document.getElementById('community-panel');
    const body = document.getElementById('community-panel-body');
    const title = document.getElementById('community-panel-title');
    document.getElementById('chat-header').style.display = 'flex';
    document.getElementById('empty-pane').style.display = 'none';
    document.getElementById('message-scroll').style.display = 'none';
    panel.hidden = false;
    title.textContent = 'Loading…';
    body.innerHTML = '<div class="chat-info-row">Loading community…</div>';
    const res = await fetch('/api/community/' + encodeURIComponent(communityId));
    if (!res.ok) {
      body.textContent = 'Community not found in backup.';
      return;
    }
    const data = await res.json();
    title.textContent = data.name || 'Community';
    body.innerHTML = '';
    const ann = document.createElement('div');
    ann.className = 'community-announce-row';
    ann.innerHTML = '<div class="community-megaphone">📢</div><div><div style="font-weight:600">Announcements</div><div style="font-size:12px;color:var(--text-muted)">Community updates</div></div>';
    ann.addEventListener('click', () => {
      const chat = allChats.find(c => String(c.id) === String(communityId) && c.type === 'group');
      if (chat) {
        closeCommunityPanel();
        const el = document.querySelector(`.chat-item[data-id="${chat.id}"][data-type="group"]`);
        selectChat(chat, el || document.createElement('div'));
      }
    });
    body.appendChild(ann);
    if (data.groups_youre_in && data.groups_youre_in.length) {
      body.appendChild(Object.assign(document.createElement('div'), { className: 'community-section-title', textContent: "Groups you're in" }));
      data.groups_youre_in.forEach(g => body.appendChild(communityGroupRow(g, () => openCommunityGroupChat(g))));
    }
    if (data.groups_you_can_join && data.groups_you_can_join.length) {
      body.appendChild(Object.assign(document.createElement('div'), { className: 'community-section-title', textContent: 'Groups you can join' }));
      data.groups_you_can_join.forEach(g => body.appendChild(communityGroupRow(g, () => showPlaceholderToast('Join group (archive preview only)'))));
    }
    const info = document.createElement('button');
    info.type = 'button';
    info.className = 'chat-info-link';
    info.style.margin = '16px';
    info.textContent = 'Community info · ' + (data.group_count || 0) + ' groups';
    info.addEventListener('click', () => showCommunityInfoSheet(data));
    body.appendChild(info);
  }

  function communityGroupRow(g, onClick) {
    const row = document.createElement('div');
    row.className = 'chat-item group';
    const name = prettyLabel(g.display_name) || g.display_name;
    row.innerHTML = avatarHtml(name, true, g) +
      `<div class="chat-body"><div class="chat-top"><div class="chat-name">${esc(name)}</div></div><div class="chat-meta-row"><div class="chat-meta">${g.unseen_count ? g.unseen_count + ' unread' : ''}</div></div></div>`;
    row.addEventListener('click', onClick);
    return row;
  }

  function openCommunityGroupChat(g) {
    const chat = allChats.find(c => String(c.id) === String(g.id) && c.type === 'group');
    if (!chat) return;
    closeCommunityPanel();
    const el = document.querySelector(`.chat-item[data-id="${chat.id}"][data-type="group"]`) || document.createElement('div');
    selectChat(chat, el);
  }

  function showCommunityInfoSheet(data) {
    const panel = document.getElementById('chat-info-panel');
    document.getElementById('chat-info-title').textContent = data.name || 'Community';
    const body = document.getElementById('chat-info-body');
    body.innerHTML = '';
    body.appendChild(_infoRow('Type', 'Community · ' + (data.group_count || 0) + ' groups').row);
    if (data.owner) body.appendChild(_infoRow('Community owner', data.owner).row);
    if (data.admins && data.admins.length) {
      const wrap = document.createElement('div');
      data.admins.forEach(a => {
        const el = document.createElement('div');
        el.className = 'chat-info-member';
        el.textContent = a + ' · Community admin';
        wrap.appendChild(el);
      });
      body.appendChild(_infoRow('Admins', wrap).row);
    }
    if (data.members && data.members.length) {
      const wrap = document.createElement('div');
      data.members.slice(0, 12).forEach(m => {
        const el = document.createElement('div');
        el.className = 'chat-info-member';
        el.textContent = m.name || m.number || '?';
        wrap.appendChild(el);
      });
      body.appendChild(_infoRow('Members', wrap).row);
    }
    panel.classList.add('open');
  }

  async function loadCommunityNavList() {
    const list = document.getElementById('community-list');
    list.innerHTML = '<div id="chat-list-notice">Loading…</div>';
    const res = await fetch('/api/communities');
    const items = await res.json();
    list.innerHTML = '';
    items.forEach(c => {
      const row = document.createElement('div');
      row.className = 'chat-item community-row';
      const name = prettyLabel(c.display_name) || c.display_name;
      row.innerHTML = avatarHtml(name, true, c) +
        `<div class="chat-body"><div class="chat-top"><div class="chat-name">${esc(name)}</div></div><div class="chat-meta-row"><div class="chat-meta">Community</div></div></div>`;
      row.addEventListener('click', () => {
        showChatsNav();
        openCommunityPanel(c.id);
      });
      list.appendChild(row);
    });
  }

  function showCommunitiesNav() {
    document.querySelectorAll('.nav-rail-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === 'communities'));
    const t = document.getElementById('sidebar-title');
    if (t) t.textContent = 'Communities';
    document.getElementById('community-list-panel').hidden = false;
    document.getElementById('chat-list').style.display = 'none';
    document.getElementById('sidebar-filters').style.display = 'none';
    document.getElementById('search-box').style.display = 'none';
    loadCommunityNavList();
  }

  function showChatsNav() {
    document.querySelectorAll('.nav-rail-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === 'chats'));
    const t = document.getElementById('sidebar-title');
    if (t) t.textContent = 'Chats';
    document.getElementById('community-list-panel').hidden = true;
    document.getElementById('chat-list').style.display = '';
    document.getElementById('sidebar-filters').style.display = '';
    document.getElementById('search-box').style.display = '';
  }

  function renderMedia(msg) {
    const wrap = document.createElement('div');
    wrap.className = 'msg-media';
    const path = msg.archive_path;
    const src = '/media/' + path;
    const mt = msg.media_type;

    if (mt === 'image' || mt === 'gif' || mt === 'sticker') {
      if (mt === 'sticker') wrap.classList.add('sticker');
      const img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      img.alt = msg.media_name || 'image';
      img.addEventListener('click', () => showLightbox(msg));
      _attachMediaScrollAnchor(img);
      wrap.appendChild(img);
    } else if (mt === 'video') {
      const vid = document.createElement('video');
      vid.controls = true;
      vid.preload = 'none';
      vid.src = src;
      wrap.appendChild(vid);
      // extract first frame as poster so the bubble isn't blank before playback
      const probe = document.createElement('video');
      probe.src = src;
      probe.muted = true;
      probe.preload = 'metadata';
      probe.addEventListener('loadeddata', () => {
        const canvas = document.createElement('canvas');
        canvas.width = probe.videoWidth;
        canvas.height = probe.videoHeight;
        canvas.getContext('2d').drawImage(probe, 0, 0);
        vid.poster = canvas.toDataURL('image/jpeg', 0.8);
        probe.src = '';
        const scroll = document.getElementById('message-scroll');
        if (scroll && (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40)) {
          suppressScroll = true;
          scroll.scrollTop = scroll.scrollHeight;
          suppressScroll = false;
        }
      }, { once: true });
      probe.addEventListener('error', () => { probe.src = ''; }, { once: true });
    } else if (mt === 'audio') {
      wrap.classList.add('audio');
      const aud = document.createElement('audio');
      aud.controls = true;
      aud.src = src;
      wrap.appendChild(aud);
    } else if (mt === 'vcard') {
      wrap.classList.add('vcard');
      const card = document.createElement('div');
      card.className = 'vcard-card';

      const avatar = document.createElement('div');
      avatar.className = 'vcard-avatar';
      avatar.innerHTML = '<span class="vcard-avatar-icon">👤</span>';

      const details = document.createElement('div');
      details.className = 'vcard-details';

      const nameEl = document.createElement('div');
      nameEl.className = 'vcard-name';
      nameEl.textContent = msg.text_body || msg.media_name || 'Contact';

      const subEl = document.createElement('div');
      subEl.className = 'vcard-sub';
      subEl.textContent = 'Contact Card';

      details.appendChild(nameEl);
      details.appendChild(subEl);
      card.appendChild(avatar);
      card.appendChild(details);

      const downloadLink = document.createElement('a');
      downloadLink.className = 'vcard-download';
      downloadLink.href = src;
      const downloadName = (msg.media_name && msg.media_name.toLowerCase().endsWith('.vcf'))
        ? msg.media_name
        : ((msg.text_body ? msg.text_body : 'contact') + '.vcf');
      downloadLink.download = downloadName;
      downloadLink.innerHTML = '<span class="vcard-download-icon">📇</span><span>View Contact (.vcf)</span>';

      wrap.appendChild(card);
      wrap.appendChild(downloadLink);
    } else {
      const a = document.createElement('a');
      a.href = src;
      a.className = 'doc-link';
      a.download = msg.media_name || 'file';
      a.innerHTML = `<span class="doc-icon">📄</span><span>${esc(msg.media_name || 'Download')}</span>`;
      wrap.appendChild(a);
    }
    return wrap;
  }

  let lightboxItems = [];
  let lightboxIndex = 0;
  let lightboxContext = 'gallery'; // 'gallery' | 'chat' — controls pagination + type filtering

  function isLightboxMedia(m) {
    return m.archive_path && (m.media_type === 'image' || m.media_type === 'video' ||
      m.media_type === 'gif' || m.media_type === 'sticker');
  }

  function _closeLb() {
    const lb = document.getElementById('img-lightbox');
    if (!lb) return;
    lb.classList.add('is-closing');
    lb.addEventListener('animationend', () => lb.remove(), { once: true });
    setTimeout(() => lb.isConnected && lb.remove(), 300);
  }

  function _setupLightboxZoom(lb, media) {
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let startY = 0;

    const zoomBadge = document.createElement('div');
    zoomBadge.className = 'lb-zoom-badge';
    zoomBadge.style.display = 'none';
    zoomBadge.title = 'Click to reset zoom';
    lb.appendChild(zoomBadge);

    function applyTransform(animated) {
      media.style.transition = animated ? 'transform 0.12s ease-out' : 'none';
      media.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      if (scale > 1) {
        media.style.cursor = isDragging ? 'grabbing' : 'grab';
        zoomBadge.textContent = `${Math.round(scale * 100)}% \u00d7 Reset`;
        zoomBadge.style.display = 'block';
      } else {
        media.style.cursor = 'zoom-in';
        zoomBadge.style.display = 'none';
      }
    }

    function clampPan() {
      if (scale <= 1) {
        panX = 0;
        panY = 0;
        return;
      }
      const scaledW = media.offsetWidth * scale;
      const scaledH = media.offsetHeight * scale;
      const maxPanX = Math.max(40, (scaledW - window.innerWidth) / 2 + 40);
      const maxPanY = Math.max(40, (scaledH - window.innerHeight) / 2 + 40);
      panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
      panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    }

    lb.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.25 : (1 / 1.25);
      const prevScale = scale;
      let nextScale = scale * zoomFactor;
      if (nextScale < 1.05) {
        scale = 1;
        panX = 0;
        panY = 0;
        applyTransform(true);
        return;
      }
      if (nextScale > 6) {
        nextScale = 6;
      }
      const cx = window.innerWidth / 2 + panX;
      const cy = window.innerHeight / 2 + panY;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const ratio = nextScale / prevScale;
      panX -= dx * (ratio - 1);
      panY -= dy * (ratio - 1);
      scale = nextScale;
      clampPan();
      applyTransform(true);
    }, { passive: false });

    media.draggable = false;

    const onMouseMove = e => {
      if (!isDragging) return;
      hasDragged = true;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      clampPan();
      applyTransform(false);
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        applyTransform(false);
      }
    };

    media.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (scale > 1) {
        isDragging = true;
        hasDragged = false;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        media.style.cursor = 'grabbing';
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
      }
    });

    lb.addEventListener('animationend', () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }, { once: true });

    media.addEventListener('click', e => {
      if (hasDragged) return;
      e.stopPropagation();
      if (scale === 1) {
        scale = 2.5;
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        panX = -(e.clientX - cx) * 1.5;
        panY = -(e.clientY - cy) * 1.5;
        clampPan();
        applyTransform(true);
      } else {
        scale = 1;
        panX = 0;
        panY = 0;
        applyTransform(true);
      }
    });

    zoomBadge.addEventListener('click', e => {
      e.stopPropagation();
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform(true);
    });
  }

  function openLightboxAt(index) {
    document.getElementById('img-lightbox')?.remove();

    const msg = lightboxItems[index];
    const src = '/media/' + msg.archive_path;
    const mt = msg.media_type;

    const lb = document.createElement('div');
    lb.id = 'img-lightbox';
    lb.className = 'img-lightbox';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'lb-close';
    closeBtn.innerHTML = '&#10005;';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => _closeLb());
    lb.appendChild(closeBtn);
    const prevBtn = document.createElement('button');
    prevBtn.className = 'lb-arrow prev';
    prevBtn.innerHTML = '&#10094;';
    prevBtn.title = 'Previous';
    prevBtn.disabled = _nextLightboxIndex(index, -1) === -1;
    prevBtn.addEventListener('click', e => {
      e.stopPropagation();
      const i = _nextLightboxIndex(lightboxIndex, -1);
      if (i !== -1) { lightboxIndex = i; openLightboxAt(lightboxIndex); }
    });
    lb.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'lb-arrow next';
    nextBtn.innerHTML = '&#10095;';
    nextBtn.title = 'Next';
    nextBtn.disabled = _nextLightboxIndex(index, 1) === -1 &&
      (lightboxContext !== 'gallery' || galleryAllLoaded);
    nextBtn.addEventListener('click', async e => {
      e.stopPropagation();
      let i = _nextLightboxIndex(lightboxIndex, 1);
      if (i !== -1) {
        lightboxIndex = i; openLightboxAt(lightboxIndex);
      } else if (lightboxContext === 'gallery' && !galleryAllLoaded) {
        const oldest = currentGalleryItems[currentGalleryItems.length - 1]?.timestamp_ms;
        await _loadGalleryPage(oldest);
        i = _nextLightboxIndex(lightboxIndex, 1);
        if (i !== -1) { lightboxIndex = i; openLightboxAt(lightboxIndex); }
      }
    });
    lb.appendChild(nextBtn);

    const tsEl = document.createElement('div');
    tsEl.className = 'lb-timestamp';
    tsEl.textContent = fmtTime(msg.timestamp_ms);
    lb.appendChild(tsEl);

    let media;
    if (mt === 'video') {
      media = document.createElement('video');
      media.controls = true;
      media.autoplay = true;
      media.src = src;
    } else {
      media = document.createElement('img');
      media.src = src;
      _setupLightboxZoom(lb, media);
    }
    lb.appendChild(media);

    const pathRow = document.createElement('div');
    pathRow.className = 'lb-path';
    const pathText = document.createElement('span');
    const sep = outputRoot.includes('\\') ? '\\' : '/';
    const fullPath = outputRoot.replace(/[/\\]+$/, '') + sep + msg.archive_path.replace(/\//g, sep);
    pathText.textContent = fullPath;
    const copyBtn = document.createElement('button');
    copyBtn.className = 'lb-copy-btn';
    copyBtn.title = 'Copy path';
    copyBtn.innerHTML = '&#128203;';
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(fullPath).then(() => {
        copyBtn.classList.add('copied');
        setTimeout(() => copyBtn.classList.remove('copied'), 1500);
      });
    });
    pathRow.appendChild(pathText);
    pathRow.appendChild(copyBtn);
    lb.appendChild(pathRow);

    lb.addEventListener('click', e => { if (e.target === lb) _closeLb(); });
    document.body.appendChild(lb);
  }

  function showLightbox(msg) {
    // Navigate the chat's currently-loaded media (chronological), not the stale
    // gallery list. msg is the same object reference held in msgList, so identity
    // lookup gives its position. Falls back to a single-item view if not found.
    lightboxContext = 'chat';
    lightboxItems = msgList.filter(isLightboxMedia);
    lightboxIndex = lightboxItems.indexOf(msg);
    if (lightboxIndex === -1) {
      lightboxItems = [msg];
      lightboxIndex = 0;
    }
    openLightboxAt(lightboxIndex);
  }

  // ---- media gallery -------------------------------------------------------

  const EMPTY_GALLERY_PIX = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
  const videoThumbCache = new Map();
  const MAX_CONCURRENT_VIDEO_PROBES = 2;
  let activeVideoProbes = 0;
  const videoProbeQueue = [];
  let galleryMediaObserver = null;
  let archiveMediaObserver = null;
  let archiveViewActive = false;
  let currentGalleryItems = [];
  let activeTypes = new Set();   // empty = show all; populated = show only those types
  let defaultActiveTypes = new Set();  // restored when deselecting a secondary type
  const SECONDARY_TYPES = new Set(['link', 'document']);  // hidden by default, toggle exclusive
  let galleryAllLoaded = false;
  let galleryLoadingMore = false;
  let galleryBackfillGen = 0;
  let gallerySentinel = null;
  let galleryObserver = null;

  function teardownMediaObservers() {
    if (galleryMediaObserver) {
      galleryMediaObserver.disconnect();
      galleryMediaObserver = null;
    }
    if (archiveMediaObserver) {
      archiveMediaObserver.disconnect();
      archiveMediaObserver = null;
    }
  }

  function getGalleryMediaObserver() {
    if (!galleryMediaObserver) {
      const grid = document.getElementById('media-gallery-grid');
      if (grid) {
        galleryMediaObserver = new IntersectionObserver(handleMediaIntersection, {
          root: grid,
          rootMargin: '600px 0px 600px 0px',
        });
      }
    }
    return galleryMediaObserver;
  }
  window.getGalleryMediaObserver = getGalleryMediaObserver;

  function getArchiveMediaObserver() {
    if (!archiveMediaObserver) {
      const tree = document.getElementById('media-archive-tree');
      if (tree) {
        archiveMediaObserver = new IntersectionObserver(handleMediaIntersection, {
          root: tree,
          rootMargin: '600px 0px 600px 0px',
        });
      }
    }
    return archiveMediaObserver;
  }

  let galleryIsScrolling = false;
  let galleryScrollIdleTimer = null;

  function _findAnchorGalleryElement(grid) {
    if (!grid) return null;
    const gRect = grid.getBoundingClientRect();
    const children = [...grid.children];
    for (const el of children) {
      if ((el.classList.contains('gallery-month-header') && !el.classList.contains('month-empty')) ||
          (el.classList.contains('gallery-item') && !el.classList.contains('type-hidden'))) {
        const r = el.getBoundingClientRect();
        if (r.bottom >= gRect.top && r.top <= gRect.bottom) {
          return el;
        }
      }
    }
    return null;
  }

  function _getMinVisibleGalleryTimestamp(grid) {
    if (!grid) return Infinity;
    const gRect = grid.getBoundingClientRect();
    let minTs = Infinity;
    const children = [...grid.children];
    for (const el of children) {
      if (el.classList.contains('type-hidden') || el.classList.contains('month-empty')) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom >= gRect.top && r.top <= gRect.bottom + 600) {
        if (el.dataset.ts) {
          const ts = parseInt(el.dataset.ts, 10);
          if (!isNaN(ts) && ts < minTs) minTs = ts;
        } else if (el.dataset.month) {
          const mk = parseInt(el.dataset.month, 10);
          if (!isNaN(mk)) {
            const y = Math.floor(mk / 100);
            const m = mk % 100;
            const monthStartTs = new Date(y, m - 1, 1).getTime();
            if (monthStartTs < minTs) minTs = monthStartTs;
          }
        }
      }
    }
    return minTs;
  }

  function _hydrateVisibleGalleryItems() {
    const grid = document.getElementById('media-gallery-grid');
    if (!grid) return;
    const gRect = grid.getBoundingClientRect();
    const cells = grid.querySelectorAll('.gallery-item[data-hydrated="false"]:not(.type-hidden)');
    for (const cell of cells) {
      const r = cell.getBoundingClientRect();
      if (r.bottom >= gRect.top - 200 && r.top <= gRect.bottom + 600) {
        hydrateGalleryItem(cell);
      }
    }
  }

  function _checkGalleryLoadMore() {
    if (archiveViewActive || galleryAllLoaded || galleryLoadingMore) return;
    const grid = document.getElementById('media-gallery-grid');
    if (!grid) return;

    const mediaTypesActive = activeTypes.size === 0 || [...activeTypes].some(t => !SECONDARY_TYPES.has(t));
    if (!mediaTypesActive) return;

    const oldestMedia = currentGalleryItems[currentGalleryItems.length - 1];
    if (!oldestMedia) return;

    const oldestCell = grid.querySelector(`.gallery-item[data-ts="${oldestMedia.timestamp_ms}"]`);
    if (oldestCell) {
      const cellRect = oldestCell.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      if (cellRect.top <= gridRect.bottom + 800) {
        _loadGalleryPage(oldestMedia.timestamp_ms);
      }
    } else {
      _loadGalleryPage(oldestMedia.timestamp_ms);
    }
  }

  async function _ensureMediaLoadedForViewport(targetTs, anchorEl, anchorTopBefore, gen) {
    if (archiveViewActive || gen !== galleryBackfillGen) return;
    const grid = document.getElementById('media-gallery-grid');
    if (!grid) return;
    const mediaTypesActive = activeTypes.size === 0 || [...activeTypes].some(t => !SECONDARY_TYPES.has(t));
    if (!mediaTypesActive) return;

    const targetMonth = targetTs !== Infinity ? monthKey(targetTs) : null;

    let attempts = 0;
    while (!galleryAllLoaded && attempts < 50) {
      if (gen !== galleryBackfillGen) return;
      attempts++;
      if (galleryLoadingMore) {
        await new Promise(r => setTimeout(r, 40));
        continue;
      }
      const oldestMedia = currentGalleryItems[currentGalleryItems.length - 1];
      if (!oldestMedia) break;

      const oldestCell = grid.querySelector(`.gallery-item[data-ts="${oldestMedia.timestamp_ms}"]`);

      let needsMore = false;
      if (targetTs !== Infinity && oldestMedia.timestamp_ms > targetTs) {
        needsMore = true;
      } else if (oldestCell && !oldestCell.classList.contains('type-hidden')) {
        const cellRect = oldestCell.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();
        if (cellRect.top <= gridRect.bottom + 600) {
          needsMore = true;
        }
      } else {
        needsMore = true;
      }

      if (needsMore) {
        await _loadGalleryPage(oldestMedia.timestamp_ms);
        if (gen !== galleryBackfillGen) return;
        if (anchorEl && anchorEl.isConnected && !anchorEl.classList.contains('type-hidden')) {
          const delta = anchorEl.getBoundingClientRect().top - anchorTopBefore;
          if (Math.abs(delta) > 1) {
            grid.scrollTop += delta;
          }
        }
        continue;
      }
      break;
    }

    if (gen !== galleryBackfillGen) return;

    if (anchorEl && anchorEl.isConnected && !anchorEl.classList.contains('type-hidden')) {
      const anchorTopAfter = anchorEl.getBoundingClientRect().top;
      const delta = anchorTopAfter - anchorTopBefore;
      if (Math.abs(delta) > 1) {
        grid.scrollTop += delta;
      }
    } else if (targetMonth) {
      const monthHdr = grid.querySelector(`.gallery-month-header[data-month="${targetMonth}"]`);
      if (monthHdr && !monthHdr.classList.contains('month-empty')) {
        monthHdr.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }

    _hydrateVisibleGalleryItems();
  }

  function onGalleryScroll() {
    galleryIsScrolling = true;
    clearTimeout(galleryScrollIdleTimer);
    // Pause queued tasks while user is actively scrolling
    videoProbeQueue.length = 0;
    _checkGalleryLoadMore();
    galleryScrollIdleTimer = setTimeout(() => {
      galleryIsScrolling = false;
      scheduleVisibleVideoExtraction();
    }, 250);
  }

  function scheduleVisibleVideoExtraction() {
    if (galleryIsScrolling || galleryLoadingMore) {
      return;
    }
    const container = archiveViewActive
      ? document.getElementById('media-archive-tree')
      : document.getElementById('media-gallery-grid');
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const videoCells = [...container.querySelectorAll('.gallery-item[data-type="video"][data-hydrated="true"]')];
    for (const cell of videoCells) {
      const archivePath = cell.dataset.archivePath;
      if (!archivePath) continue;
      const img = cell.querySelector('.gallery-thumb');
      if (!img) continue;

      if (videoThumbCache.has(archivePath)) {
        img.src = videoThumbCache.get(archivePath);
        continue;
      }

      // Check if intersecting container's actual visible viewport (with 100px buffer)
      const r = cell.getBoundingClientRect();
      const isVisibleOnScreen = (r.bottom >= cRect.top - 100) && (r.top <= cRect.bottom + 100);
      if (isVisibleOnScreen) {
        enqueueVideoThumbnail(cell, img, cell.dataset.src, archivePath);
      }
    }
  }

  function clearVideoProbeQueue() {
    videoProbeQueue.length = 0;
  }

  function cancelVideoThumbnail(cell) {
    const idx = videoProbeQueue.findIndex(item => item.cell === cell);
    if (idx !== -1) {
      videoProbeQueue.splice(idx, 1);
    }
  }

  function enqueueVideoThumbnail(cell, img, src, archivePath) {
    if (videoThumbCache.has(archivePath)) {
      img.src = videoThumbCache.get(archivePath);
      return;
    }
    if (videoProbeQueue.some(item => item.cell === cell)) {
      return;
    }
    videoProbeQueue.push({ cell, img, src, archivePath });
    drainVideoProbeQueue();
  }

  function drainVideoProbeQueue() {
    while (activeVideoProbes < MAX_CONCURRENT_VIDEO_PROBES && videoProbeQueue.length > 0) {
      const next = videoProbeQueue.shift();
      if (!next.cell.isConnected || next.cell.dataset.hydrated !== 'true') {
        continue;
      }
      if (videoThumbCache.has(next.archivePath)) {
        next.img.src = videoThumbCache.get(next.archivePath);
        continue;
      }
      activeVideoProbes++;
      extractVideoFirstFrame(next);
    }
  }

  function extractVideoFirstFrame(task) {
    const vid = document.createElement('video');
    vid.src = task.src;
    vid.muted = true;
    vid.preload = 'auto';
    let settled = false;

    const safetyTimeout = setTimeout(() => {
      finish();
    }, 6000);

    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimeout);
      vid.src = '';
      activeVideoProbes--;
      drainVideoProbeQueue();
    }

    function captureFrame() {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = vid.videoWidth || 320;
        canvas.height = vid.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        videoThumbCache.set(task.archivePath, dataUrl);
        if (task.cell.isConnected && task.cell.dataset.hydrated === 'true') {
          task.img.src = dataUrl;
          task.img.classList.remove('gallery-video-thumb--err');
        }
      } catch {
        if (task.cell.isConnected) {
          task.img.classList.add('gallery-video-thumb--err');
        }
      } finally {
        finish();
      }
    }

    let seekStarted = false;
    vid.addEventListener('loadedmetadata', () => {
      if (seekStarted) return;
      seekStarted = true;
      try {
        const targetTime = Math.min(0.1, (vid.duration || 1) / 2 || 0.1);
        vid.currentTime = targetTime;
      } catch {
        captureFrame();
      }
    }, { once: true });

    vid.addEventListener('seeked', () => {
      captureFrame();
    }, { once: true });

    vid.addEventListener('error', () => {
      try {
        if (task.cell.isConnected) {
          task.img.classList.add('gallery-video-thumb--err');
        }
      } finally {
        finish();
      }
    }, { once: true });
  }

  function hydrateGalleryItem(cell) {
    if (cell.dataset.hydrated === 'true') {
      return;
    }
    cell.dataset.hydrated = 'true';
    const mt = cell.dataset.type;
    const src = cell.dataset.src;
    const img = cell.querySelector('.gallery-thumb');
    if (!img || !src) {
      return;
    }

    if (mt === 'image' || mt === 'gif' || mt === 'sticker') {
      img.src = src;
    } else if (mt === 'video') {
      const archivePath = cell.dataset.archivePath;
      if (videoThumbCache.has(archivePath)) {
        img.src = videoThumbCache.get(archivePath);
      } else {
        scheduleVisibleVideoExtraction();
      }
    }
  }

  function dehydrateGalleryItem(cell) {
    if (cell.dataset.hydrated !== 'true') {
      return;
    }
    cell.dataset.hydrated = 'false';
    const mt = cell.dataset.type;
    const img = cell.querySelector('.gallery-thumb');
    if (!img) {
      return;
    }

    if (mt === 'video') {
      cancelVideoThumbnail(cell);
    }
    img.src = EMPTY_GALLERY_PIX;
  }

  function handleMediaIntersection(entries) {
    for (const entry of entries) {
      const cell = entry.target;
      if (entry.isIntersecting) {
        hydrateGalleryItem(cell);
      } else {
        dehydrateGalleryItem(cell);
      }
    }
  }

  function closeMediaGallery() {
    archiveViewActive = false;
    archiveLoadingAll = false;
    galleryBackfillGen++;
    document.getElementById('media-gallery').classList.remove('open');
    if (galleryObserver) { galleryObserver.disconnect(); galleryObserver = null; }
    if (gallerySentinel) { gallerySentinel.remove(); gallerySentinel = null; }
    teardownMediaObservers();
    clearVideoProbeQueue();
    clearTimeout(galleryScrollIdleTimer);
    galleryIsScrolling = false;
  }

  function renderGalleryItem(msg) {
    const cell = document.createElement('div');
    cell.className = 'gallery-item';
    const src = '/media/' + msg.archive_path;
    const mt = msg.media_type;
    cell.dataset.type = mt;
    cell.dataset.ts = String(msg.timestamp_ms || 0);

    if (mt === 'image' || mt === 'gif' || mt === 'sticker') {
      cell.dataset.src = src;
      cell.dataset.hydrated = 'false';
      const img = document.createElement('img');
      img.src = EMPTY_GALLERY_PIX;
      img.alt = msg.media_name || '';
      img.className = 'gallery-thumb';
      const idx = lightboxItems.length;
      lightboxItems.push(msg);
      img.addEventListener('click', () => { lightboxContext = 'gallery'; lightboxIndex = idx; openLightboxAt(idx); });
      cell.appendChild(img);
    } else if (mt === 'video') {
      cell.dataset.src = src;
      cell.dataset.archivePath = msg.archive_path;
      cell.dataset.hydrated = 'false';
      const img = document.createElement('img');
      img.src = EMPTY_GALLERY_PIX;
      img.alt = msg.media_name || '';
      img.className = 'gallery-thumb gallery-video-thumb';
      const idx = lightboxItems.length;
      lightboxItems.push(msg);
      img.addEventListener('click', () => { lightboxContext = 'gallery'; lightboxIndex = idx; openLightboxAt(idx); });
      cell.appendChild(img);
    } else if (mt === 'audio') {
      const d = document.createElement('div');
      d.className = 'gallery-doc';
      d.innerHTML = '<span style="font-size:28px">🎵</span><span>' + esc(msg.media_name || 'audio') + '</span>';
      d.addEventListener('click', () => window.open(src, '_blank'));
      cell.appendChild(d);
    } else if (mt === 'link') {
      const urlMatch = msg.text_body.match(/https?:\/\/[^\s<>"]+/);
      const url = urlMatch ? urlMatch[0] : msg.text_body;
      cell.classList.add('gallery-link-card');
      const a = document.createElement('a');
      a.className = 'gallery-link-url';
      a.href = url;
      a.title = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = url;
      const meta = document.createElement('div');
      meta.className = 'gallery-link-meta';
      meta.textContent = prettyLabel(msg.sender || 'You') + ' · ' + new Date(msg.timestamp_ms).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
      cell.appendChild(a);
      cell.appendChild(meta);
      cell.addEventListener('click', e => { if (!e.target.closest('a')) window.open(url, '_blank'); });
    } else if (mt === 'document') {
      cell.classList.add('gallery-link-card');
      const name = document.createElement('div');
      name.className = 'gallery-link-url';
      name.textContent = '📄 ' + (msg.media_name || 'file');
      const meta = document.createElement('div');
      meta.className = 'gallery-link-meta';
      meta.textContent = prettyLabel(msg.sender || 'You') + ' · ' + new Date(msg.timestamp_ms).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
      cell.appendChild(name);
      cell.appendChild(meta);
      cell.addEventListener('click', () => window.open(src, '_blank'));
    } else if (mt === 'vcard') {
      const d = document.createElement('div');
      d.className = 'gallery-doc';
      d.innerHTML = '<span style="font-size:28px">📇</span><span>' + esc(msg.media_name || msg.text_body || 'Contact') + '</span>';
      d.addEventListener('click', () => window.open(src, '_blank'));
      cell.appendChild(d);
    } else {
      const d = document.createElement('div');
      d.className = 'gallery-doc';
      d.innerHTML = '<span style="font-size:28px">📄</span><span>' + esc(msg.media_name || 'file') + '</span>';
      d.addEventListener('click', () => window.open(src, '_blank'));
      cell.appendChild(d);
    }

    const btn = document.createElement('button');
    btn.className = 'gallery-goto';
    btn.title = 'Go to message';
    btn.textContent = '→ in chat';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      closeMediaGallery();
      jumpToMessage(msg);
    });
    cell.appendChild(btn);
    return cell;
  }

  function _insertGalleryGridItem(grid, msg) {
    const mk = monthKey(msg.timestamp_ms);
    let monthHdr = grid.querySelector(`.gallery-month-header[data-month="${mk}"]`);
    if (!monthHdr) {
      monthHdr = document.createElement('div');
      monthHdr.className = 'gallery-month-header';
      monthHdr.dataset.month = String(mk);
      monthHdr.textContent = fmtMonthHeader(msg.timestamp_ms);
      const olderHdr = [...grid.querySelectorAll('.gallery-month-header')]
        .find(el => parseInt(el.dataset.month, 10) < mk);
      grid.insertBefore(monthHdr, olderHdr || gallerySentinel || null);
    }

    const cell = renderGalleryItem(msg);
    if (activeTypes.size > 0 && !activeTypes.has(msg.media_type)) {
      cell.classList.add('type-hidden');
    }

    const nextSection = [...grid.querySelectorAll('.gallery-month-header')]
      .find(el => parseInt(el.dataset.month, 10) < mk) || gallerySentinel || null;

    let insertBeforeEl = nextSection;
    let curr = monthHdr.nextElementSibling;
    while (curr && curr !== nextSection) {
      if (curr.classList.contains('gallery-item')) {
        const currTs = parseInt(curr.dataset.ts || '0', 10);
        if (currTs < msg.timestamp_ms) {
          insertBeforeEl = curr;
          break;
        }
      }
      curr = curr.nextElementSibling;
    }
    grid.insertBefore(cell, insertBeforeEl);
    if (cell.dataset.src) {
      getGalleryMediaObserver()?.observe(cell);
    }
  }

  async function openMediaGallery() {
    if (!currentChat) return;
    const grid = document.getElementById('media-gallery-grid');
    const stats = document.getElementById('media-gallery-stats');
    const switcher = document.getElementById('media-view-switcher');

    // disconnect any observer/sentinel from a previous open before clearing the grid
    if (galleryObserver) { galleryObserver.disconnect(); galleryObserver = null; }
    if (gallerySentinel) { gallerySentinel = null; }
    teardownMediaObservers();
    clearVideoProbeQueue();
    clearTimeout(galleryScrollIdleTimer);
    galleryIsScrolling = false;

    // reset to classic view each time
    archiveViewActive = false;
    archiveLoadingAll = false;
    galleryBackfillGen++;
    switcher.style.display = 'flex';
    document.getElementById('media-archive-tabs').style.display =
      currentChat.type === 'contact' ? 'flex' : 'none';
    document.querySelectorAll('.media-view-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    grid.style.display = 'grid';
    document.getElementById('media-archive-view').classList.remove('active');

    document.getElementById('media-gallery-title').textContent =
      currentChat.display_name ? `Media — ${currentChat.display_name}` : 'Media';

    grid.innerHTML = '<div style="color:var(--text-muted);padding:16px">Loading…</div>';
    stats.innerHTML = '';
    document.getElementById('media-gallery').classList.add('open');

    // reset pagination state
    currentGalleryItems = [];
    lightboxItems = [];
    activeTypes = new Set();
    galleryAllLoaded = false;
    galleryLoadingMore = false;

    // fetch counts, documents, and links in parallel, then render media
    const typeOrder = ['image', 'video', 'audio', 'gif', 'sticker', 'document', 'vcard', 'link'];
    const qs = 'chat_id=' + encodeURIComponent(currentChat.id) + '&chat_type=' + encodeURIComponent(currentChat.type);
    const [counts, docItems, linkItems] = await Promise.all([
      fetch('/api/media/count?' + qs).then(r => r.json()),
      fetch('/api/media/documents?' + qs).then(r => r.json()),
      fetch('/api/media/links?' + qs).then(r => r.json()),
    ]);
    stats.innerHTML = '';
    if (counts.total) {
      stats.appendChild(_makeStatPill('total', counts.total, null, counts.total - counts.archived));
      for (const t of typeOrder) {
        const d = counts.by_type[t];
        if (!d) continue;
        stats.appendChild(_makeStatPill(t, d.count, t, d.missing));
      }
      // secondary types (links, documents) are hidden by default
      const hasSecondary = typeOrder.some(t => SECONDARY_TYPES.has(t) && counts.by_type[t]);
      if (hasSecondary) {
        typeOrder.filter(t => !SECONDARY_TYPES.has(t) && counts.by_type[t]).forEach(t => activeTypes.add(t));
        defaultActiveTypes = new Set(activeTypes);
      } else {
        defaultActiveTypes = new Set();
      }
      _syncStatPills();
    }

    grid.innerHTML = '';

    // attach IntersectionObserver sentinel at bottom of grid
    gallerySentinel = document.createElement('div');
    gallerySentinel.style.height = '1px';
    grid.appendChild(gallerySentinel);
    galleryObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        const oldest = currentGalleryItems[currentGalleryItems.length - 1]?.timestamp_ms;
        _loadGalleryPage(oldest);
      }
    }, { root: grid, threshold: 0.1 });
    galleryObserver.observe(gallerySentinel);

    getGalleryMediaObserver();

    await _loadGalleryPage(null);

    if (!currentGalleryItems.length && !docItems.length && !linkItems.length) {
      grid.innerHTML = '<div style="color:var(--text-muted);padding:16px">No media in this chat.</div>';
      return;
    }

    // append document and link cards; hidden when secondary types are filtered out by default
    for (const msg of [...docItems, ...linkItems]) {
      _insertGalleryGridItem(grid, msg);
    }
    _syncMonthHeaders();
  }

  async function _loadGalleryPage(before) {
    if (galleryAllLoaded || galleryLoadingMore) return;
    galleryLoadingMore = true;
    const grid = document.getElementById('media-gallery-grid');
    try {
      const typesParam = (activeTypes.size > 0 && [...activeTypes].some(t => !SECONDARY_TYPES.has(t)))
        ? '&types=' + encodeURIComponent([...activeTypes].filter(t => !SECONDARY_TYPES.has(t)).join(','))
        : '';
      const url = '/api/media?chat_id=' + encodeURIComponent(currentChat.id) +
                  '&chat_type=' + encodeURIComponent(currentChat.type) +
                  typesParam +
                  (before != null ? '&before=' + before : '');
      const items = await fetch(url).then(r => r.json());
      if (items.length < 100) galleryAllLoaded = true;
      currentGalleryItems.push(...items);

      for (const msg of items) {
        _insertGalleryGridItem(grid, msg);
      }

      if (archiveViewActive) {
        _appendToArchiveView(items, activeArchiveDir());
      }
      _syncMonthHeaders();
    } finally {
      galleryLoadingMore = false;
      scheduleVisibleVideoExtraction();
    }
  }

  document.getElementById('media-btn').addEventListener('click', openMediaGallery);
  document.getElementById('media-gallery-close').addEventListener('click', closeMediaGallery);
  document.getElementById('media-gallery-grid').addEventListener('scroll', onGalleryScroll, { passive: true });
  document.getElementById('media-archive-tree').addEventListener('scroll', onGalleryScroll, { passive: true });
  document.addEventListener('keydown', async e => {
    if (document.getElementById('img-lightbox')) {
      if (e.key === 'Escape') { _closeLb(); return; }
      if (e.key === 'ArrowLeft') {
        const i = _nextLightboxIndex(lightboxIndex, -1);
        if (i !== -1) { lightboxIndex = i; openLightboxAt(lightboxIndex); }
        return;
      }
      if (e.key === 'ArrowRight') {
        let i = _nextLightboxIndex(lightboxIndex, 1);
        if (i !== -1) {
          lightboxIndex = i; openLightboxAt(lightboxIndex);
        } else if (lightboxContext === 'gallery' && !galleryAllLoaded) {
          const oldest = currentGalleryItems[currentGalleryItems.length - 1]?.timestamp_ms;
          await _loadGalleryPage(oldest);
          i = _nextLightboxIndex(lightboxIndex, 1);
          if (i !== -1) { lightboxIndex = i; openLightboxAt(lightboxIndex); }
        }
        return;
      }
    }
    if (e.key === 'Escape') {
      if (document.getElementById('chat-info-panel').classList.contains('open')) {
        closeChatInfo(); return;
      }
      closeMediaGallery();
    }
  });

  function _nextLightboxIndex(from, dir) {
    let i = from + dir;
    while (i >= 0 && i < lightboxItems.length) {
      // activeTypes is a gallery-only filter; in chat context every item in
      // lightboxItems is already a renderable media message, so accept it.
      if (lightboxContext !== 'gallery' || activeTypes.size === 0 || activeTypes.has(lightboxItems[i].media_type)) return i;
      i += dir;
    }
    return -1;
  }

  function _makeStatPill(label, count, type, missing) {
    const plurals = { audio: 'audio', sticker: 'stickers', document: 'documents', link: 'links', vcard: 'contacts' };
    const displayLabel = count === 1 ? label : (plurals[label] || label + 's');
    const span = document.createElement('span');
    span.className = 'gallery-stat';
    span.dataset.type = type || 'total';
    const ms = missing ? ` <span class="gallery-stat-missing">(${missing} missing)</span>` : '';
    span.innerHTML = `<strong>${count}</strong> ${displayLabel}${ms}`;
    span.addEventListener('click', () => _toggleTypeFilter(type));
    return span;
  }

  function _toggleTypeFilter(type) {
    const grid = document.getElementById('media-gallery-grid');
    const targetTs = grid ? _getMinVisibleGalleryTimestamp(grid) : Infinity;
    const anchorEl = grid ? _findAnchorGalleryElement(grid) : null;
    const anchorTopBefore = anchorEl ? anchorEl.getBoundingClientRect().top : 0;

    if (type === null) {
      // Total: toggle between show-all and the default media-only state
      if (activeTypes.size === 0) {
        activeTypes = new Set(defaultActiveTypes);
      } else {
        activeTypes.clear();
      }
    } else if (SECONDARY_TYPES.has(type) && defaultActiveTypes.size > 0) {
      // Secondary type (link, document): toggle exclusive ↔ default state
      if (activeTypes.has(type)) {
        activeTypes = new Set(defaultActiveTypes);
      } else {
        activeTypes = new Set([type]);
      }
    } else if (activeTypes.size === 0) {
      // No filter active → first click is exclusive
      activeTypes.add(type);
    } else if (activeTypes.has(type)) {
      // Already selected → deselect; if nothing left, restore default
      activeTypes.delete(type);
      if (activeTypes.size === 0) activeTypes = new Set(defaultActiveTypes);
    } else {
      // Different type → add to selection
      activeTypes.add(type);
    }
    _applyTypeFilter();
    if (grid && anchorEl && anchorEl.isConnected && !anchorEl.classList.contains('type-hidden')) {
      const delta = anchorEl.getBoundingClientRect().top - anchorTopBefore;
      if (Math.abs(delta) > 1) {
        grid.scrollTop += delta;
      }
    }
    _syncStatPills();
    scheduleVisibleVideoExtraction();
    const gen = ++galleryBackfillGen;
    _ensureMediaLoadedForViewport(targetTs, anchorEl, anchorTopBefore, gen);
  }

  function _applyTypeFilter() {
    const items = document.querySelectorAll(
      '#media-gallery-grid .gallery-item, #media-archive-view .gallery-item'
    );
    let animating = false;
    items.forEach(cell => {
      const shouldHide = activeTypes.size > 0 && !activeTypes.has(cell.dataset.type);
      const isHidden   = cell.classList.contains('type-hidden');
      if (shouldHide && !isHidden) {
        animating = true;
        cell.classList.remove('is-appearing');
        cell.classList.add('is-disappearing');
        cell.addEventListener('animationend', () => {
          cell.classList.remove('is-disappearing');
          cell.classList.add('type-hidden');
          _syncMonthHeaders();
        }, { once: true });
      } else if (!shouldHide && isHidden) {
        animating = true;
        cell.classList.remove('type-hidden');
        cell.classList.remove('is-disappearing');
        requestAnimationFrame(() => {
          cell.classList.add('is-appearing');
          cell.addEventListener('animationend', () => {
            cell.classList.remove('is-appearing');
            _syncMonthHeaders();
          }, { once: true });
        });
      }
    });
    _syncMonthHeaders();
    _hydrateVisibleGalleryItems();
    if (animating) {
      setTimeout(() => {
        _syncMonthHeaders();
        _hydrateVisibleGalleryItems();
      }, 250);
    }
  }

  function _syncMonthHeaders() {
    document.querySelectorAll('.gallery-month-header').forEach(hdr => {
      let el = hdr.nextElementSibling;
      let hasVisible = false;
      while (el && !el.classList.contains('gallery-month-header')) {
        if (el.classList.contains('gallery-item') && !el.classList.contains('type-hidden')) {
          hasVisible = true;
          break;
        }
        el = el.nextElementSibling;
      }
      hdr.classList.toggle('month-empty', !hasVisible);
    });
    document.querySelectorAll('.archive-year').forEach(block => {
      const visible = block.querySelectorAll('.gallery-item:not(.type-hidden)').length;
      block.querySelector('.archive-year-count').textContent = visible;
    });
  }

  function _syncStatPills() {
    const filtered = activeTypes.size > 0;
    document.querySelectorAll('#media-gallery-stats .gallery-stat').forEach(pill => {
      const t = pill.dataset.type;
      // secondary types (links, docs) are never archived — hide their pills in archive view
      if (archiveViewActive && t !== 'total' && SECONDARY_TYPES.has(t)) {
        pill.style.display = 'none';
        return;
      }
      pill.style.display = '';
      if (t === 'total') {
        pill.classList.toggle('active', !filtered);
        pill.classList.remove('dimmed');
      } else {
        pill.classList.toggle('active', filtered && activeTypes.has(t));
        pill.classList.toggle('dimmed', filtered && !activeTypes.has(t));
      }
    });
  }

  let archiveLoadingAll = false;

  async function _loadAllArchivePages() {
    if (archiveLoadingAll) return;
    archiveLoadingAll = true;
    let consecutiveErrors = 0;
    try {
      while (archiveViewActive && !galleryAllLoaded && consecutiveErrors < 3) {
        if (galleryLoadingMore) {
          await new Promise(r => setTimeout(r, 40));
          continue;
        }
        const oldest = currentGalleryItems[currentGalleryItems.length - 1]?.timestamp_ms;
        if (oldest == null) {
          await new Promise(r => setTimeout(r, 40));
          continue;
        }
        const countBefore = currentGalleryItems.length;
        await _loadGalleryPage(oldest);
        if (currentGalleryItems.length === countBefore && !galleryAllLoaded) {
          consecutiveErrors++;
        } else {
          consecutiveErrors = 0;
        }
        await new Promise(r => setTimeout(r, 10));
      }
    } finally {
      archiveLoadingAll = false;
    }
  }

  document.querySelectorAll('.media-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.media-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      archiveViewActive = btn.dataset.view === 'archive';
      document.getElementById('media-gallery-grid').style.display = archiveViewActive ? 'none' : 'grid';
      document.getElementById('media-archive-view').classList.toggle('active', archiveViewActive);
      // if the active filter is secondary-types-only, those items don't exist in archive view — reset to default
      if (archiveViewActive && activeTypes.size > 0 && [...activeTypes].every(t => SECONDARY_TYPES.has(t))) {
        activeTypes = new Set(defaultActiveTypes);
      }
      _syncStatPills();
      if (archiveViewActive) {
        buildArchiveView(currentGalleryItems, activeArchiveDir());
        if (activeTypes.size > 0) { _applyTypeFilter(); } else { _syncMonthHeaders(); }
        scheduleVisibleVideoExtraction();
        _loadAllArchivePages();
      }
    });
  });

  document.querySelectorAll('.archive-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.archive-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      buildArchiveView(currentGalleryItems, btn.dataset.dir);
      if (activeTypes.size > 0) { _applyTypeFilter(); } else { _syncMonthHeaders(); }
      scheduleVisibleVideoExtraction();
      _loadAllArchivePages();
    });
  });

  document.getElementById('archive-expand-all').addEventListener('click', () => {
    document.querySelectorAll('.archive-year').forEach(el => el.classList.add('open'));
    scheduleVisibleVideoExtraction();
  });
  document.getElementById('archive-collapse-all').addEventListener('click', () => {
    document.querySelectorAll('.archive-year').forEach(el => el.classList.remove('open'));
  });

  // ---- sidebar search -------------------------------------------------------

  let searchTimer = null;

  document.getElementById('search-input').addEventListener('input', function () {
    clearTimeout(searchTimer);
    const q = this.value.trim();
    if (!q) {
      clearSearchResults();
      return;
    }
    searchTimer = setTimeout(() => doSearch(q), 300);
  });

  async function doSearch(q) {
    // Contact name matches — client-side, instant
    const ql = q.toLowerCase();
    const contactMatches = allChats.filter(c =>
      c.display_name.toLowerCase().includes(ql) || c.id.toLowerCase().includes(ql)
    );

    // Show loading state while FTS fetch is in flight
    searchMediaFilter = null;
    const container = document.getElementById('search-results');
    container.classList.add('has-results');
    document.getElementById('sidebar').classList.add('searching');
    container.innerHTML = '<div class="sr-section-label">Searching…</div>';

    const people = contactMatches.filter(c => c.type === 'contact').slice(0, 25);
    const numbers = people.map(c => c.id).filter(Boolean);
    const commonPromise = numbers.length
      ? fetch('/api/groups_in_common?' + new URLSearchParams({ numbers: numbers.join(',') })).then(r => r.json()).catch(() => [])
      : Promise.resolve([]);
    const res = await fetch('/api/search?' + new URLSearchParams({ q }));
    const [data, common] = await Promise.all([res.json(), commonPromise]);
    const namedIds = new Set(contactMatches.filter(c => c.type === 'group').map(c => c.id));
    const commonGroups = (Array.isArray(common) ? common : []).filter(g => !namedIds.has(g.id));

    renderSearchResults(q, contactMatches, data.results, data.indexed_count, commonGroups);
  }

  function clearSearchResults() {
    searchMediaFilter = null;
    lastSearch = null;
    document.getElementById('search-results').classList.remove('has-results');
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('sidebar').classList.remove('searching');
  }

  function makeSectionLabel(text) {
    const el = document.createElement('div');
    el.className = 'sr-section-label';
    el.textContent = text;
    return el;
  }

  const MEDIA_SEARCH = [
    { id: 'image', label: 'Photos', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.2"/></svg>' },
    { id: 'link', label: 'Links', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7.5.4l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.4l-2 2a5 5 0 0 0 7 7l1.2-1.2"/></svg>' },
    { id: 'video', label: 'Videos', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>' },
    { id: 'document', label: 'Documents', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>' }
  ];
  let searchMediaFilter = null;

  function openChatFromSearch(chat) {
    document.getElementById('search-input').value = '';
    clearSearchResults();
    resetFilterTo('all');
    const el2 = document.querySelector(`.chat-item[data-id="${CSS.escape(chat.id)}"][data-type="${chat.type}"]`);
    if (el2) selectChat(chat, el2);
  }

  function makeContactResultItem(chat, q) {
    const el = document.createElement('div');
    el.className = 'search-result-item chat-item' + (chat.type === 'group' ? ' group' : '');
    const name = prettyLabel(chat.display_name) || chat.id;
    el.innerHTML =
      avatarHtml(name, chat.type === 'group', chat) +
      `<div class="chat-body"><div class="chat-top"><div class="chat-name">${highlight(name, q)}</div><div class="chat-when">${esc(fmtListWhen(chat.newest_ts))}</div></div><div class="chat-meta">${chatPreview(chat)}</div></div>`;
    el.addEventListener('click', () => openChatFromSearch(chat));
    return el;
  }

  function makeTextResultItem(r, q) {
    const el = document.createElement('div');
    el.className = 'search-result-item';
    const chat = allChats.find(c => c.id === r.chat_id && c.type === r.chat_type);
    const chatName = prettyLabel(chat?.display_name) || prettyLabel(r.chat_id) || r.chat_id;
    const sameAsFile = r.media_name && r.text_body && r.text_body.trim() === r.media_name.trim();
    const snippet = sameAsFile ? '' : (r.text_body || (r.media_type === 'document' ? '' : (r.media_name || '')));
    const who = r.from_me ? 'You' : prettyLabel(r.sender || '');
    const lead = who && (snippet || r.media_type === 'document') ? esc(who) + ': ' : '';
    const doc = r.media_type === 'document' && r.media_name
      ? `<div class="sr-doc"><span class="sr-doc-name">${esc(r.media_name)}</span></div>`
      : '';
    el.innerHTML = `
      <div class="sr-top"><div class="sr-chat">${highlight(chatName, q)}</div><div class="sr-when">${esc(fmtListWhen(r.timestamp_ms))}</div></div>
      <div class="sr-text">${lead}${highlightPlain(snippet, q)}</div>
      ${doc}
    `;
    el.addEventListener('click', async () => {
      if (!chat) return;
      document.getElementById('search-input').value = '';
      clearSearchResults();
      resetFilterTo('all');
      const el2 = document.querySelector(`.chat-item[data-id="${CSS.escape(r.chat_id)}"][data-type="${r.chat_type}"]`);
      if (el2) {
        await selectChat(chat, el2);
        const row = await jumpToTimestamp(r.timestamp_ms, null);
        if (row) {
          const bubble = row.querySelector('.msg-bubble, .msg-service-bubble');
          if (bubble) {
            bubble.classList.add('search-jump-highlight');
            bubble.addEventListener('animationend', () => bubble.classList.remove('search-jump-highlight'), { once: true });
          }
        }
      }
    });
    return el;
  }

  function makeMediaRow(item) {
    const el = document.createElement('div');
    el.className = 'sr-media' + (searchMediaFilter === item.id ? ' active' : '');
    el.innerHTML = `<span class="sr-media-ico">${item.icon}</span><span class="sr-media-label">${item.label}</span><span class="sr-media-go">›</span>`;
    el.addEventListener('click', () => {
      searchMediaFilter = searchMediaFilter === item.id ? null : item.id;
      if (lastSearch) renderSearchResults(lastSearch.q, lastSearch.contactMatches, lastSearch.textResults, lastSearch.indexedCount, lastSearch.commonGroups);
    });
    return el;
  }

  let lastSearch = null;

  function makeCommonGroupItem(group) {
    const el = document.createElement('div');
    el.className = 'search-result-item chat-item group';
    const name = prettyLabel(group.display_name) || group.id;
    const who = prettyLabel(group.member_name || group.member || '');
    const via = who ? '~' + esc(who) + ' is also in this group' : 'In common';
    el.innerHTML =
      avatarHtml(name, true) +
      `<div class="chat-body"><div class="chat-top"><div class="chat-name">${esc(name)}</div><div class="chat-when">${esc(fmtListWhen(group.newest_ts))}</div></div><div class="chat-meta">${via}</div></div>`;
    el.addEventListener('click', () => {
      const chat = allChats.find(c => c.id === group.id && c.type === 'group') || {
        id: group.id, type: 'group', display_name: name
      };
      openChatFromSearch(chat);
    });
    return el;
  }

  function renderSearchResults(q, contactMatches, textResults, indexedCount, commonGroups) {
    commonGroups = commonGroups || [];
    const nameById = new Map(allChats.filter(c => c.type === 'contact').map(c => [c.id, c.display_name]));
    commonGroups = commonGroups.map(g => ({ ...g, member_name: nameById.get(g.member) || '' }));
    lastSearch = { q, contactMatches, textResults, indexedCount, commonGroups };
    const container = document.getElementById('search-results');
    const sidebar = document.getElementById('sidebar');
    const messages = searchMediaFilter
      ? textResults.filter(r => r.media_type === searchMediaFilter)
      : textResults;
    if (!contactMatches.length && !textResults.length && !commonGroups.length) {
      clearSearchResults();
      return;
    }
    container.classList.add('has-results');
    sidebar.classList.add('searching');
    container.innerHTML = '';

    if (contactMatches.length && !searchMediaFilter) {
      container.appendChild(makeSectionLabel('Chats'));
      contactMatches.slice(0, 20).forEach(chat => container.appendChild(makeContactResultItem(chat, q)));
    }

    if (commonGroups.length && !searchMediaFilter) {
      container.appendChild(makeSectionLabel('Groups in common'));
      commonGroups.slice(0, 8).forEach(g => container.appendChild(makeCommonGroupItem(g)));
    }

    container.appendChild(makeSectionLabel('Media'));
    MEDIA_SEARCH.forEach(item => container.appendChild(makeMediaRow(item)));

    container.appendChild(makeSectionLabel('Messages'));
    if (messages.length) {
      messages.slice(0, 50).forEach(r => container.appendChild(makeTextResultItem(r, q)));
    } else {
      const empty = document.createElement('div');
      empty.className = 'search-index-notice';
      empty.textContent = searchMediaFilter ? 'No matching ' + (MEDIA_SEARCH.find(m => m.id === searchMediaFilter)?.label || 'items').toLowerCase() : 'No matching messages in indexed chats';
      container.appendChild(empty);
    }

    if (indexedCount != null && indexedCount < allChats.length) {
      const notice = document.createElement('div');
      notice.className = 'search-index-notice';
      notice.textContent = `Searched ${indexedCount} of ${allChats.length} chats. Open more chats to index them.`;
      container.appendChild(notice);
    }
  }

  // ---- in-chat search -------------------------------------------------------

  let chatSearchResults = [];
  let chatSearchIdx = -1;
  let chatSearchTimer = null;

  document.getElementById('chat-search-input').addEventListener('input', function () {
    document.getElementById('chat-search-clear').style.display = this.value ? 'block' : 'none';
    clearTimeout(chatSearchTimer);
    const q = this.value.trim();
    if (!q) {
      clearChatSearch();
      return;
    }
    chatSearchTimer = setTimeout(() => doChatSearch(q), 300);
  });

  document.getElementById('chat-search-clear').addEventListener('click', () => {
    const inp = document.getElementById('chat-search-input');
    inp.value = '';
    document.getElementById('chat-search-clear').style.display = 'none';
    clearChatSearch();
    inp.focus();
  });

  document.getElementById('chat-search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) navigateChatSearch(-1);
      else navigateChatSearch(1);
    } else if (e.key === 'Escape') {
      clearChatSearch();
      this.value = '';
    }
  });

  document.getElementById('search-prev').addEventListener('click', () => navigateChatSearch(-1));
  document.getElementById('search-next').addEventListener('click', () => navigateChatSearch(1));

  async function doChatSearch(q) {
    if (!currentChat) return;
    const nav = document.getElementById('chat-search-nav');
    const count = document.getElementById('chat-search-count');
    const statusRes = await fetch('/api/chat-index-status?chat_id=' +
      encodeURIComponent(currentChat.id) + '&chat_type=' + encodeURIComponent(currentChat.type));
    const statusData = await statusRes.json();
    if (statusData.status !== 'done') {
      nav.style.display = 'flex';
      count.textContent = 'Search not ready yet…';
      document.getElementById('search-prev').disabled = true;
      document.getElementById('search-next').disabled = true;
      return;
    }
    nav.style.display = 'flex';
    count.textContent = 'Searching…';
    document.getElementById('search-prev').disabled = true;
    document.getElementById('search-next').disabled = true;
    const params = new URLSearchParams({ q, chat_id: currentChat.id, chat_type: currentChat.type });
    const res = await fetch('/api/search?' + params);
    const data = await res.json();
    chatSearchResults = data.results;
    chatSearchIdx = chatSearchResults.length > 0 ? 0 : -1;
    updateChatSearchNav();
    if (chatSearchIdx >= 0) jumpToChatSearchResult(chatSearchIdx);
  }

  function clearChatSearch() {
    chatSearchResults = [];
    chatSearchIdx = -1;
    document.getElementById('chat-search-nav').style.display = 'none';
    document.getElementById('chat-search-count').textContent = '';
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
  }

  function navigateChatSearch(delta) {
    if (!chatSearchResults.length) return;
    chatSearchIdx = (chatSearchIdx + delta + chatSearchResults.length) % chatSearchResults.length;
    updateChatSearchNav();
    jumpToChatSearchResult(chatSearchIdx);
  }

  function updateChatSearchNav() {
    const nav = document.getElementById('chat-search-nav');
    const count = document.getElementById('chat-search-count');
    nav.style.display = 'flex';
    if (!chatSearchResults.length) {
      count.textContent = 'No results';
      document.getElementById('search-prev').disabled = true;
      document.getElementById('search-next').disabled = true;
      return;
    }
    count.textContent = `${chatSearchIdx + 1}/${chatSearchResults.length}`;
    document.getElementById('search-prev').disabled = false;
    document.getElementById('search-next').disabled = false;
  }

  async function jumpToChatSearchResult(idx) {
    const result = chatSearchResults[idx];
    if (!result) return;
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
    const existing = rowForMsgId(result.msg_id);
    if (existing) {
      highlightMessageRow(existing);
      return;
    }
    await jumpToTimestamp(result.timestamp_ms, result.msg_id);
    const loaded = rowForMsgId(result.msg_id);
    if (loaded) highlightMessageRow(loaded);
  }

  function highlightMessageRow(row) {
    const bubble = row.querySelector('.msg-bubble, .msg-service-bubble');
    if (bubble) bubble.classList.add('search-highlight');
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---- date picker ----------------------------------------------------------

  document.getElementById('date-picker-input').max = new Date().toISOString().slice(0, 10);

  document.getElementById('date-picker-input').addEventListener('change', function () {
    const hasVal = !!this.value;
    document.getElementById('date-go-btn').style.display = hasVal ? 'inline-block' : 'none';
    document.getElementById('date-clear-btn').style.display = hasVal ? 'inline-block' : 'none';
  });

  document.getElementById('date-go-btn').addEventListener('click', async () => {
    const val = document.getElementById('date-picker-input').value;
    if (!val || !currentChat) return;
    const btn = document.getElementById('date-go-btn');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    try {
      await jumpToTimestamp(new Date(val).getTime(), null);
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  });

  document.getElementById('date-clear-btn').addEventListener('click', () => {
    document.getElementById('date-picker-input').value = '';
    document.getElementById('date-go-btn').style.display = 'none';
    document.getElementById('date-clear-btn').style.display = 'none';
  });

  // Resolve once every <img> in container has finished loading (or errored),
  // capped by timeoutMs so slow or broken sources never stall indefinitely.
  function _awaitImagesSettled(container, timeoutMs) {
    const pending = [...container.querySelectorAll('img')].filter(img => !img.complete);
    if (!pending.length) return Promise.resolve();
    return Promise.all(pending.map(img => new Promise(resolve => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, timeoutMs);
    })));
  }

  // Scroll to bottom and hold it there as media loads and layout stabilizes.
  // Snaps each animation frame until the position holds steady (3 stable frames)
  // or 1000 ms have passed. Bails immediately if a newer load superseded this one.
  async function _pinToBottom(gen) {
    const scroll = document.getElementById('message-scroll');
    const snap = () => {
      suppressScroll = true;
      scroll.scrollTop = scroll.scrollHeight;
      suppressScroll = false;
    };
    snap();
    const deadline = performance.now() + 1000;
    let stable = 0;
    while (performance.now() < deadline && stable < 3) {
      await new Promise(r => requestAnimationFrame(r));
      if (gen !== _loadGen) return;
      const before = scroll.scrollTop;
      snap();
      stable = Math.abs(scroll.scrollTop - before) < 2 ? stable + 1 : 0;
    }
  }

  // Center targetEl and hold it there as lazy media above it loads and shifts layout.
  // Re-centers each animation frame until the position holds steady (3 stable frames)
  // or 1500 ms have passed. Bails immediately if a newer load superseded this one.
  async function _pinToMsg(targetEl, gen) {
    const scroll = document.getElementById('message-scroll');
    const recenter = () => {
      suppressScroll = true;
      targetEl.scrollIntoView({ behavior: 'instant', block: 'center' });
      suppressScroll = false;
    };
    recenter();
    const deadline = performance.now() + 1500;
    let stable = 0;
    while (performance.now() < deadline && stable < 3) {
      await new Promise(r => requestAnimationFrame(r));
      if (gen !== _loadGen) return;
      const before = scroll.scrollTop;
      recenter();
      stable = Math.abs(scroll.scrollTop - before) < 2 ? stable + 1 : 0;
    }
  }

  // exactMsgId: when the caller needs a specific message in the DOM (e.g. jumpToMessage,
  // chat search), pass its msg_id to bypass the nearest-ts early-exit — the caller already
  // confirmed the message is not in the current window, so a full fetch is always needed.
  // Pass null for nearest-ts callers (date picker, quoted-message jumps).
  async function jumpToTimestamp(ts, exactMsgId) {
    if (exactMsgId == null) {
      const near = nearestMsgToTs(ts);
      const existing = near && Math.abs(near.timestamp_ms - ts) < 86400000 && rowForMsgId(near.msg_id);
      if (existing) {
        suppressScroll = true;
        existing.scrollIntoView({ behavior: 'instant', block: 'center' });
        suppressScroll = false;
        return existing;
      }
    }

    const gen = ++_loadGen;
    loading = true;
    const scroll = document.getElementById('message-scroll');

    try {
      const params = new URLSearchParams({
        chat_id: currentChat.id,
        chat_type: currentChat.type,
        ts,
        limit: 50
      });
      const res = await fetch('/api/messages/at?' + params);
      const msgs = await res.json();
      if (gen !== _loadGen) return null;
      if (!msgs.length) return null;

      msgList = [];
      noMoreOlder = false;
      noMoreNewer = false;
      mergePage(msgs);
      renderWindow();

      const target = nearestMsgToTs(ts);
      const targetEl = target && rowForMsgId(target.msg_id);
      if (targetEl) await _pinToMsg(targetEl, gen);
      if (gen !== _loadGen) return null;
      return targetEl || null;
    } finally {
      if (gen === _loadGen) loading = false;
    }
  }

  // ---- toolbar toggle -------------------------------------------------------

  document.getElementById('toolbar-toggle').addEventListener('click', function () {
    const exp = document.getElementById('toolbar-expanded');
    const open = exp.classList.toggle('open');
    if (open) document.getElementById('chat-search-input').focus();
    else {
      clearChatSearch();
      document.getElementById('chat-search-input').value = '';
    }
  });

  // ---- chat info panel -------------------------------------------------------

  function _formatBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576)    return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024)       return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  function _infoRow(label, valueNode) {
    const row = document.createElement('div');
    row.className = 'chat-info-row';
    const lbl = document.createElement('span');
    lbl.className = 'chat-info-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    const val = document.createElement('span');
    val.className = 'chat-info-value';
    if (typeof valueNode === 'string') {
      val.textContent = valueNode;
    } else {
      val.appendChild(valueNode);
    }
    row.appendChild(val);
    return { row, val };
  }

  function _spinner() {
    const s = document.createElement('span');
    s.className = 'chat-info-spinner';
    return s;
  }

  function closeChatInfo() {
    document.getElementById('chat-info-panel').classList.remove('open');
    const desc = document.getElementById('chat-info-desc');
    if (desc) {
      desc.textContent = '';
      desc.style.display = 'none';
    }
  }

  async function openChatInfo() {
    if (!currentChat) return;
    const panel = document.getElementById('chat-info-panel');
    const title = document.getElementById('chat-info-title');
    const desc  = document.getElementById('chat-info-desc');
    const body  = document.getElementById('chat-info-body');

    title.textContent = currentChat.display_name || '';
    const infoSub = document.getElementById('chat-info-subtitle');
    if (infoSub) infoSub.textContent = '';
    const infoAv = document.getElementById('chat-info-avatar');
    const infoAvFb = document.getElementById('chat-info-hero-fallback');
    if (infoAv && infoAvFb) {
      if (currentChat.has_avatar) {
        infoAv.src = '/api/avatar?' + new URLSearchParams({ chat_id: currentChat.id, chat_type: currentChat.type });
        infoAv.hidden = false;
        infoAvFb.style.display = 'none';
      } else {
        infoAv.hidden = true;
        infoAvFb.style.display = 'flex';
        infoAvFb.className = 'chat-info-hero-fallback' + (currentChat.type === 'group' ? '' : ' contact');
        const label = prettyLabel(currentChat.display_name) || '?';
        infoAvFb.textContent = currentChat.type === 'group' ? '👥' : ([...label][0] || '?').toUpperCase();
      }
    }
    if (desc) {
      desc.textContent = '';
      desc.style.display = 'none';
    }
    body.innerHTML = '';

    // Show loading skeleton
    const loadingRow = document.createElement('div');
    loadingRow.className = 'chat-info-row';
    loadingRow.appendChild(_spinner());
    body.appendChild(loadingRow);
    panel.classList.add('open');

    const params = new URLSearchParams({ chat_id: currentChat.id, chat_type: currentChat.type });
    const chatAtOpen = currentChat;

    // Kick off both requests in parallel
    let info, sizeData;
    try {
      const [infoResp, sizeResp] = await Promise.all([
        fetch('/api/chat-info?' + params),
        fetch('/api/chat-info/media-size?' + params),
      ]);
      info = await infoResp.json();
      sizeData = await sizeResp.json();
    } catch (_) {
      if (currentChat === chatAtOpen && panel.classList.contains('open')) {
        body.innerHTML = '<div class="chat-info-row" style="color:var(--text-muted)">Could not load chat info.</div>';
      }
      return;
    }

    // Panel may have been closed or chat switched while awaiting
    if (currentChat !== chatAtOpen || !panel.classList.contains('open')) return;

    body.innerHTML = '';

    if (currentChat.type === 'group' && info.description && desc) {
      desc.textContent = info.description;
      desc.style.display = 'block';
    }
    if (infoSub) {
      if (currentChat.type === 'group') {
        const n = (info.members && info.members.length) || 0;
        infoSub.textContent = n ? ('Group · ' + n.toLocaleString() + ' members') : 'Group';
      } else if (info.number) {
        infoSub.textContent = '+' + info.number;
      }
    }

    fetch('/api/chat-community?' + new URLSearchParams({ chat_id: currentChat.id }))
      .then(r => r.json())
      .then(link => {
        if (currentChat !== chatAtOpen || !link || !link.community_name) return;
        const a = document.createElement('div');
        a.className = 'chat-info-community-link';
        a.textContent = 'Group in ' + link.community_name;
        a.addEventListener('click', () => {
          closeChatInfo();
          openCommunityPanel(link.community_id);
        });
        body.insertBefore(_infoRow('Community', a).row, body.firstChild);
      })
      .catch(() => {});

    const fmtTs = ts => ts ? new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    const fmtNum = n => (n === null || n === undefined || n < 0) ? '—' : n.toLocaleString();

    if (currentChat.type === 'contact' && info.number) {
      body.appendChild(_infoRow('Phone', '+' + info.number).row);
    }

    if (currentChat.type === 'group' && info.created_ts) {
      body.appendChild(_infoRow('Group created', fmtTs(info.created_ts)).row);
      if (info.creator_number || info.creator_name) {
        const match = info.creator_number ? (info.members || []).find(m => m.number && m.number === info.creator_number) : null;
        const creatorName = (match && match.name) ? match.name : (info.creator_name || (info.creator_number ? '+' + info.creator_number : ''));
        if (creatorName) {
          body.appendChild(_infoRow('Created by', creatorName).row);
        }
      }
    }

    body.appendChild(_infoRow('Conversation since', fmtTs(info.first_ts)).row);

    if (info.first_ts && info.last_ts && info.last_ts !== info.first_ts) {
      const days = Math.round((info.last_ts - info.first_ts) / 86400000);
      const years = Math.floor(days / 365);
      const months = Math.floor((days % 365) / 30);
      let span = '';
      if (years > 0) span += years + (years === 1 ? ' year' : ' years');
      if (months > 0) span += (span ? ', ' : '') + months + (months === 1 ? ' month' : ' months');
      if (!span) span = days + (days === 1 ? ' day' : ' days');
      body.appendChild(_infoRow('Duration', span).row);
    }

    if (currentChat.type === 'contact') {
      const sentReceived = document.createElement('span');
      sentReceived.textContent = fmtNum(info.sent) + ' sent · ' + fmtNum(info.received) + ' received';
      body.appendChild(_infoRow('Messages', sentReceived).row);
    } else {
      body.appendChild(_infoRow('Total messages', fmtNum(info.total)).row);
    }

    // Gallery link row
    const galleryLink = document.createElement('button');
    galleryLink.className = 'chat-info-link';
    galleryLink.textContent = 'Open Media Gallery →';
    galleryLink.addEventListener('click', () => { closeChatInfo(); openMediaGallery(); });
    body.appendChild(_infoRow('Media', galleryLink).row);

    // Media size row (already resolved since we awaited both)
    body.appendChild(_infoRow('Media size', _formatBytes(sizeData.bytes || 0)).row);

    // Group members
    if (currentChat.type === 'group' && info.members && info.members.length > 0) {
      const SHOW = 10;
      const membersWrap = document.createElement('div');
      membersWrap.className = 'chat-info-members';
      const renderMember = m => {
        const el = document.createElement('div');
        el.className = 'chat-info-member';
        const displayName = m.name || (m.number ? '+' + m.number : '?');
        const numSuffix = m.number && ('+' + m.number) !== displayName ? ' (+' + m.number + ')' : '';
        el.textContent = displayName + numSuffix;
        return el;
      };
      info.members.slice(0, SHOW).forEach(m => membersWrap.appendChild(renderMember(m)));
      if (info.members.length > SHOW) {
        const more = document.createElement('button');
        more.className = 'chat-info-link';
        more.style.marginTop = '4px';
        const remaining = info.members.length - SHOW;
        more.textContent = '+ ' + remaining + ' more…';
        more.addEventListener('click', () => {
          info.members.slice(SHOW).forEach(m => membersWrap.insertBefore(renderMember(m), more));
          more.remove();
        });
        membersWrap.appendChild(more);
      }
      body.appendChild(_infoRow('Members (' + info.members.length + ')', membersWrap).row);
    }

    // Top senders
    if (currentChat.type === 'group' && info.top_senders && info.top_senders.length > 0) {
      const sendersWrap = document.createElement('div');
      info.top_senders.forEach(s => {
        const el = document.createElement('div');
        el.className = 'chat-info-member';
        el.textContent = (s.name || '?') + ': ' + s.count.toLocaleString();
        sendersWrap.appendChild(el);
      });
      body.appendChild(_infoRow('Top senders', sendersWrap).row);
    }
  }

  document.getElementById('chat-info-btn').addEventListener('click', openChatInfo);
  document.getElementById('chat-info-close').addEventListener('click', closeChatInfo);
  document.getElementById('chat-info-panel').addEventListener('click', e => {
    if (e.target === document.getElementById('chat-info-panel')) closeChatInfo();
  });

  // ---- message details popup ------------------------------------------------

  const msgDetailsPopup = document.getElementById('msg-details-popup');

  function hideMsgDetails() {
    msgDetailsPopup.classList.remove('visible');
  }

  document.addEventListener('click', e => {
    if (!msgDetailsPopup.contains(e.target)) hideMsgDetails();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideMsgDetails();
  });

  function fmtReceipt(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  // Recent iOS messages record that a message was read (aggregate status) but no
  // longer store the precise read time. Show that state instead of a blank dash.
  function fmtRead(entry) {
    if (entry.read_ts) return fmtReceipt(entry.read_ts);
    if (entry.read_known) return '<span class="msg-details-na">Read (time not stored)</span>';
    return '—';
  }

  async function showMsgDetails(msgId, anchorEl, archivePath) {
    let html = '';

    if (msgId !== null) {
      msgDetailsPopup.innerHTML = '<span style="color:var(--text-muted)">Loading…</span>';
      positionPopup(anchorEl);
      msgDetailsPopup.classList.add('visible');

      let data;
      try {
        const res = await fetch('/api/message_receipts/' + msgId);
        data = await res.json();
      } catch (_) {
        data = { available: false };
      }

      if (!data.available || !(data.members || []).length) {
        html = '<span class="msg-details-na">No receipt data available.</span>';
      } else if (data.members.length === 1) {
        html =
          `<div class="msg-details-row"><span class="msg-details-label">Delivered</span><span class="msg-details-value">${fmtReceipt(data.delivered_ts)}</span></div>` +
          `<div class="msg-details-row"><span class="msg-details-label">Read</span><span class="msg-details-value">${fmtRead(data)}</span></div>`;
      } else {
        const read = [];
        const delivered = [];
        for (const m of data.members) {
          const name = prettyLabel(m.name) || prettyLabel(m.jid) || 'Unknown';
          if (m.read_ts || m.read_known) read.push({ name, when: fmtRead(m) });
          else if (m.delivered_ts) delivered.push({ name, when: fmtReceipt(m.delivered_ts) });
        }
        const section = (title, rows) => {
          if (!rows.length) return '';
          return `<div class="msg-details-head">${title}</div>` + rows.map(m =>
            `<div class="msg-details-row"><span class="msg-details-label">${esc(m.name)}</span><span class="msg-details-value">${m.when}</span></div>`
          ).join('');
        };
        html = section('Read', read) + section('Delivered', delivered);
        if (!html) html = '<span class="msg-details-na">No receipt data available.</span>';
      }
    }

    msgDetailsPopup.innerHTML = html;

    positionPopup(anchorEl);
    msgDetailsPopup.classList.add('visible');
  }

  function positionPopup(anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const pane = document.getElementById('chat-pane').getBoundingClientRect();
    const popupW = msgDetailsPopup.offsetWidth || 200;
    let left = rect.right - popupW;
    if (left < pane.left + 4) left = pane.left + 4;
    if (left + popupW > pane.right - 4) left = pane.right - popupW - 4;
    let top = rect.bottom + 4;
    if (top + msgDetailsPopup.offsetHeight > window.innerHeight - 8) {
      top = rect.top - msgDetailsPopup.offsetHeight - 4;
    }
    msgDetailsPopup.style.left = left + 'px';
    msgDetailsPopup.style.top = top + 'px';
  }

  async function showReactionDetails(msgId, anchorEl) {
    msgDetailsPopup.innerHTML = '<span style="color:var(--text-muted)">Loading…</span>';
    positionPopup(anchorEl);
    msgDetailsPopup.classList.add('visible');

    let data;
    try {
      const res = await fetch('/api/reaction_details/' + msgId);
      data = await res.json();
    } catch (_) {
      data = { available: false };
    }

    let html;
    if (!data.available || !data.reactors || !data.reactors.length) {
      html = '<span class="msg-details-na">No reaction data available.</span>';
    } else {
      const label = data.total === 1 ? '1 reaction' : `${data.total} reactions`;
      html = `<div class="rx-details-total">${label}</div>`;
      for (const r of data.reactors) {
        const name = r.from_me ? 'You' : esc(r.name || '?');
        html += `<div class="msg-details-row"><span class="msg-details-label">${esc(r.emoji)}</span><span class="msg-details-value">${name}</span></div>`;
      }
    }

    msgDetailsPopup.innerHTML = html;
    positionPopup(anchorEl);
    msgDetailsPopup.classList.add('visible');
  }

  // ---- init ----------------------------------------------------------------

  let _bulkIndexPollGen = 0;

  function _startBulkIndexPoll() {
    const gen = ++_bulkIndexPollGen;
    async function poll() {
      if (gen !== _bulkIndexPollGen) return;
      try {
        const r = await fetch('/api/index/progress');
        const d = await r.json();
        if (gen !== _bulkIndexPollGen) return;
        const pct = d.total_msgs > 0 ? Math.round(d.indexed_msgs / d.total_msgs * 100) : 0;
        document.getElementById('index-progress-bar').style.width = pct + '%';
        const fmtN = n => n.toLocaleString();
        document.getElementById('index-progress-label').textContent =
          d.total_msgs > 0
            ? pct + '% (' + fmtN(d.indexed_msgs) + ' / ' + fmtN(d.total_msgs) + ' messages)'
            : 'Starting…';
        if (!d.running) {
          document.getElementById('index-progress-bar').style.width = '100%';
          document.getElementById('index-progress-label').textContent = 'Done.';
          document.getElementById('index-all-btn').disabled = false;
          return;
        }
        setTimeout(poll, 1000);
      } catch (_) {
        setTimeout(poll, 2000);
      }
    }
    poll();
  }

  document.getElementById('settings-btn').addEventListener('click', async () => {
    document.getElementById('settings-modal').classList.add('open');
    try {
      const r = await fetch('/api/index/progress');
      const d = await r.json();
      if (d.running) {
        document.getElementById('index-all-btn').disabled = true;
        document.getElementById('index-all-progress').style.display = 'block';
        _startBulkIndexPoll();
      }
    } catch (_) {}
  });
  document.getElementById('settings-close').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('open');
  });
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('settings-modal').classList.remove('open');
  });
  document.querySelectorAll('.pref-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      prefs[btn.dataset.pref] = btn.dataset.value;
      applyPrefs();
      fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: btn.dataset.pref, value: btn.dataset.value })
      });
    });
  });

  document.getElementById('index-all-btn').addEventListener('click', async () => {
    let sizeBytes = 0;
    try {
      const r = await fetch('/api/index/source-size');
      const d = await r.json();
      sizeBytes = d.bytes || 0;
    } catch (_) {}

    if (sizeBytes > 150 * 1024 * 1024) {
      const mb = Math.round(sizeBytes / 1024 / 1024);
      if (!confirm('The database is large (' + mb + ' MB). Indexing may take several minutes. Continue?')) return;
    }
    if (!confirm('Index all chats for search? This will run in the background while you use the viewer.')) return;

    const res = await fetch('/api/index/all', { method: 'POST' });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }

    document.getElementById('index-all-btn').disabled = true;
    document.getElementById('index-all-progress').style.display = 'block';
    document.getElementById('index-progress-bar').style.width = '0%';
    document.getElementById('index-progress-label').textContent = 'Starting…';
    _startBulkIndexPoll();
  });

  document.getElementById('clear-index-btn').addEventListener('click', async () => {
    if (!confirm('Clear the search index? Indexed data will be deleted. Chats will be re-indexed when you open them.')) return;
    const btn = document.getElementById('clear-index-btn');
    await fetch('/api/index/clear', { method: 'POST' });
    const orig = btn.textContent;
    btn.textContent = 'Cleared.';
    setTimeout(() => { btn.textContent = orig; }, 2000);
    document.getElementById('index-all-progress').style.display = 'none';
    document.getElementById('index-all-btn').disabled = false;
  });

  const optBtn = document.getElementById('optimize-db-btn');
  if (optBtn) {
    optBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('optimize-db-status');
      optBtn.disabled = true;
      const orig = optBtn.textContent;
      optBtn.textContent = 'Optimizing…';
      if (statusEl) {
        statusEl.textContent = 'Defragmenting index and compacting database…';
        statusEl.style.display = 'block';
      }
      try {
        const res = await fetch('/api/index/optimize', { method: 'POST' });
        const data = await res.json();
        if (data.error) {
          if (statusEl) {
            statusEl.textContent = 'Could not optimize: ' + data.error;
            statusEl.style.display = 'block';
          }
        } else {
          const mbReclaimed = (data.reclaimed / (1024 * 1024)).toFixed(1);
          const mbCurrent = (data.size_after / (1024 * 1024)).toFixed(1);
          if (statusEl) {
            if (data.reclaimed > 0) {
              statusEl.textContent = `Compacted! Reclaimed ${mbReclaimed} MB (Current size: ${mbCurrent} MB).`;
            } else {
              statusEl.textContent = `Database is already optimal (${mbCurrent} MB).`;
            }
            statusEl.style.display = 'block';
          }
        }
      } catch (_) {
        if (statusEl) {
          statusEl.textContent = 'Optimization failed.';
          statusEl.style.display = 'block';
        }
      } finally {
        optBtn.disabled = false;
        optBtn.textContent = orig;
      }
    });
  }

  document.getElementById('community-panel-back')?.addEventListener('click', closeCommunityPanel);
  document.getElementById('community-list-back')?.addEventListener('click', showChatsNav);
  document.getElementById('reset-session-btn')?.addEventListener('click', () => {
    if (!confirm('Reset all interactive changes (replies, reactions, session pins, archive toggles)? Your msgstore backup on disk is never modified — only browser session state is cleared.')) return;
    Session.reset();
    location.reload();
  });
  document.querySelectorAll('.nav-rail-btn[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;
      if (nav === 'chats') { showChatsNav(); showingArchived = false; showingStarred = false; renderChatList(); }
      else if (nav === 'communities') showCommunitiesNav();
      else if (nav === 'archived') {
        showChatsNav();
        showingArchived = true;
        showingStarred = false;
        renderChatList();
      }
      else if (nav === 'starred-rail') {
        showChatsNav();
        openStarredList();
      }
      else if (nav === 'settings') document.getElementById('settings-btn').click();
      else showPlaceholderToast(nav.replace('-', ' ') + ' (archive preview)');
    });
  });
  document.getElementById('chat-heading')?.addEventListener('click', () => {
    if (currentChat) openChatInfo();
  });
  document.querySelectorAll('.wa-placeholder-btn[data-placeholder]').forEach(btn => {
    btn.addEventListener('click', () => showPlaceholderToast((btn.title || btn.dataset.placeholder) + ' (preview)'));
  });
  document.getElementById('header-search-btn')?.addEventListener('click', () => {
    document.getElementById('toolbar-expanded').classList.add('open');
    document.getElementById('chat-search-input').focus();
  });
  document.getElementById('header-menu-btn')?.addEventListener('click', e => {
    if (!currentChat) return;
    showContextMenu(e.clientX, e.clientY, [
      { label: currentChat.type === 'group' ? 'Group info' : 'Contact info', action: () => openChatInfo() },
      { label: 'Search', action: () => document.getElementById('header-search-btn').click() },
      { label: 'Select messages', action: () => showPlaceholderToast('Select messages (preview)') },
      { label: 'Mute notifications', action: () => { Session.setChat(currentChat, { muted: true }); showPlaceholderToast('Muted (session only)'); }},
      { label: 'New group call', action: () => showPlaceholderToast('Calls disabled') },
      { label: 'Open in new window', action: () => showPlaceholderToast('Open in new window (preview)') },
      { label: 'Close chat', action: () => { document.getElementById('chat-header').style.display = 'none'; document.getElementById('message-scroll').innerHTML = ''; }},
    ]);
  });
  document.getElementById('reply-bar-cancel')?.addEventListener('click', () => {
    document.getElementById('reply-bar').hidden = true;
    replyTarget = null;
  });
  document.getElementById('reply-bar-send')?.addEventListener('click', () => {
    if (!currentChat || !replyTarget) return;
    const text = document.getElementById('reply-bar-input').value.trim();
    if (!text) return;
    Session.addSent(currentChat, {
      text,
      quoted_text: replyTarget.text_body || '',
      quoted_sender: replyTarget.sender || '',
      quoted_ts: replyTarget.timestamp_ms,
    });
    document.getElementById('reply-bar').hidden = true;
    appendSessionSentMessages();
    renderWindow();
    const scroll = document.getElementById('message-scroll');
    suppressScroll = true;
    scroll.scrollTop = scroll.scrollHeight;
    suppressScroll = false;
    replyTarget = null;
  });

  loadPrefs().then(() => loadChats());
})();
