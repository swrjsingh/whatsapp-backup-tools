# HTML template for the WhatsApp chat viewer web UI.

from pathlib import Path

_PICO_CSS = (Path(__file__).parent / "pico.min.css").read_text(encoding="utf-8")
# Strip @charset — invalid inside @layer
_PICO_CSS = _PICO_CSS.replace('@charset "UTF-8";', "", 1)

HTML_TEMPLATE = (
    r"""
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta id="meta-color-scheme" name="color-scheme" content="dark">
  <title>WhatsApp Backup Tools</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <style>"""
    + _PICO_CSS
    + r"""</style>
  <link rel="stylesheet" href="/static/app.css?v={{ version }}">
</head>
<body>
<div id="app">
  <div id="header" class="wa-hidden-header">
    <h1>WhatsApp Backup Viewer</h1>
    <span class="subtitle">{{ output_root }}</span>
  </div>

  <div id="body">
    <nav id="nav-rail" aria-label="WhatsApp navigation">
      <button type="button" class="nav-rail-btn active" data-nav="chats" title="Chats">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 0 0-9 9v7l2-2h7a9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7H5.5L4 19.5V14a7 7 0 0 1 8-9z"/></svg>
        <span class="nav-rail-label">Chats</span>
      </button>
      <button type="button" class="nav-rail-btn" data-nav="updates" title="Updates">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M8 12h8v2H8z"/></svg>
        <span class="nav-rail-label">Updates</span>
      </button>
      <button type="button" class="nav-rail-btn" data-nav="communities" title="Communities">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 15.17 10.33 14 8 14zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        <span class="nav-rail-label">Communities</span>
      </button>
      <button type="button" class="nav-rail-btn" data-nav="calls" title="Calls">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
        <span class="nav-rail-label">Calls</span>
      </button>
      <button type="button" class="nav-rail-btn" data-nav="media" title="Media">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z"/></svg>
        <span class="nav-rail-label">Media</span>
      </button>
      <button type="button" class="nav-rail-btn nav-rail-meta-ai" data-nav="meta-ai" title="Meta AI">
        <svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="wab-meta-ai" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#0078ff"/><stop offset="0.5" stop-color="#a855f7"/><stop offset="1" stop-color="#ff2d55"/></linearGradient></defs><circle cx="12" cy="12" r="9" fill="url(#wab-meta-ai)"/><path fill="#fff" d="M8.5 12.5l2.2 2.2L16 9.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        <span class="nav-rail-label">Meta AI</span>
      </button>
      <div class="nav-rail-more">
        <div class="nav-rail-more-label">More</div>
        <button type="button" class="nav-rail-btn nav-rail-sub" data-nav="archived" title="Archived">
          <span class="nav-rail-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h18v2H3zM5 9v10l7-3 7 3V9"/></svg></span>
          <span class="nav-rail-sub-count" id="rail-archived-count"></span>
        </button>
        <button type="button" class="nav-rail-btn nav-rail-sub" data-nav="starred-rail" title="Starred">
          <span class="nav-rail-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg></span>
          <span class="nav-rail-sub-count" id="rail-starred-count"></span>
        </button>
      </div>
      <button type="button" class="nav-rail-btn" data-nav="settings" title="Settings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3a7.96 7.96 0 0 0-.06-.94 7.96 7.96 0 0 0 .06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a8.06 8.06 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.61 8.48a.5.5 0 0 0 .12.64L4.76 10.7c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.51.42 1.05.72 1.63.94l.36 2.54c.04.28.26.48.49.48h4c.23 0 .45-.2.49-.48l.36-2.54c.58-.22 1.12-.52 1.63-.94l2.39.96c.21.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.24 13.06c.04-.31.06-.63.06-.94z"/></svg>
        <span class="nav-rail-label">Settings</span>
      </button>
      <div class="nav-rail-spacer"></div>
      <div class="nav-rail-profile" title="You">S</div>
    </nav>
    <div id="sidebar">
      <div id="sidebar-title-row">
        <h2 id="sidebar-title">Chats</h2>
        <button type="button" id="sidebar-edit-btn" class="sidebar-edit-btn wa-placeholder-btn" data-placeholder="sidebar-edit" hidden>Edit</button>
        <button type="button" class="sidebar-icon-btn wa-placeholder-btn sidebar-new-chat" id="sidebar-new-chat-btn" data-placeholder="new-chat" title="New chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>
        <button type="button" class="sidebar-icon-btn wa-placeholder-btn sidebar-add-btn" id="sidebar-add-btn" data-placeholder="new-community" title="New community" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
      </div>
      <div id="search-box">
        <div class="search-wrap">
          <span class="search-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg></span>
          <input id="search-input" type="search" placeholder="Ask Meta AI or Search" autocomplete="off">
        </div>
        <button type="button" id="settings-btn" class="search-settings-btn" title="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></button>
      </div>
      <div id="sidebar-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="unread">Unread</button>
        <button class="filter-btn" data-filter="favorites">Favourites</button>
        <button class="filter-btn" data-filter="group">Groups</button>
      </div>
      <div id="nav-screen-updates" class="nav-screen" hidden>
        <div class="nav-screen-search"><div class="search-wrap"><span class="search-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg></span><input type="search" placeholder="Search" disabled></div></div>
        <div class="updates-section-head"><span>Status</span><span class="updates-head-actions"><button type="button" class="wa-placeholder-btn" data-placeholder="status-camera">📷</button><button type="button" class="wa-placeholder-btn" data-placeholder="status-compose">✎</button></span></div>
        <div class="updates-status-tray"><div class="status-card add-status"><div class="status-thumb you">+</div><span>Add status</span></div><p class="nav-screen-muted">Status updates are not stored in this Android backup.</p></div>
        <div class="updates-section-head"><span>Channels</span><button type="button" class="updates-explore wa-placeholder-btn" data-placeholder="channels-explore">Explore</button></div>
        <p class="nav-screen-muted pad">Channels omitted — not in msgstore archive.</p>
      </div>
      <div id="nav-screen-calls" class="nav-screen" hidden>
        <div class="nav-screen-search"><div class="search-wrap"><span class="search-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg></span><input type="search" placeholder="Name, number, @username" disabled></div></div>
        <div class="calls-section-label">Favourites</div>
        <div id="calls-favourites" class="calls-fav-row"></div>
        <div class="calls-section-label">Recent</div>
        <div id="calls-recent-list" class="calls-recent-list"></div>
      </div>
      <div id="nav-screen-media" class="nav-screen" hidden>
        <div class="media-screen-head"><div><div class="media-screen-title">Media</div><div class="media-screen-sub">Media from all chats</div></div></div>
        <div class="media-tabs"><button type="button" class="media-tab active">Media</button><button type="button" class="media-tab wa-placeholder-btn" data-placeholder="media-links">Links</button><button type="button" class="media-tab wa-placeholder-btn" data-placeholder="media-docs">Docs</button></div>
        <div id="media-global-grid" class="media-global-grid"></div>
        <div id="media-global-stats" class="media-global-stats"></div>
      </div>
      <div id="community-cards-panel" class="nav-screen" hidden>
        <div id="community-cards-list"></div>
      </div>
      <div id="community-detail-panel" class="nav-screen" hidden>
        <div class="community-detail-header">
          <img id="community-detail-avatar" alt="" hidden>
          <div class="community-detail-heading"><div id="community-detail-name"></div><div class="community-detail-sub">Community</div></div>
          <button type="button" id="community-detail-menu" class="sidebar-icon-btn wa-placeholder-btn" data-placeholder="community-menu">⋯</button>
        </div>
        <div id="community-detail-body"></div>
        <button type="button" class="community-add-group wa-placeholder-btn" data-placeholder="add-group">+ Add group</button>
      </div>
      <div id="search-results"></div>
      <div id="chat-list"></div>
    </div>

    <div id="chat-pane">
      <div id="chat-header" style="display:none;">
        <img id="chat-avatar" alt="" hidden>
        <div id="chat-heading">
          <h2 id="chat-title"></h2>
          <div id="chat-subtitle" hidden></div>
        </div>
        <button id="chat-pin" type="button" hidden></button>
        <div id="chat-toolbar">
          <button type="button" class="wa-placeholder-btn header-ico-btn" data-placeholder="video-call" title="Video call"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3"/></svg></button>
          <button type="button" class="wa-placeholder-btn header-ico-btn" data-placeholder="voice-call" title="Voice call"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg></button>
          <button type="button" class="wa-placeholder-btn header-ico-btn" id="header-search-btn" title="Search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg></button>
          <button type="button" class="wa-placeholder-btn header-ico-btn" id="header-menu-btn" title="Menu"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></button>
          <button id="chat-info-btn" title="Chat info" hidden>&#8505;</button>
          <button id="media-btn" title="Media" hidden>&#128247;</button>
          <button id="toolbar-toggle" title="Search &amp; date" hidden>&#128269;</button>
        </div>
        <div id="toolbar-expanded">
          <div id="chat-search-wrap">
            <input id="chat-search-input" type="search" placeholder="Find in chat…" autocomplete="off">
            <button id="chat-search-clear" title="Clear search">&#10005;</button>
          </div>
          <div id="chat-search-nav" style="display:none;">
            <button class="nav-btn" id="search-prev" title="Previous">&#8679;</button>
            <span id="chat-search-count"></span>
            <button class="nav-btn" id="search-next" title="Next">&#8681;</button>
          </div>
          <div id="date-group">
            <input id="date-picker-input" type="date" title="Jump to date">
            <button id="date-go-btn">Go</button>
            <button id="date-clear-btn">Clear</button>
          </div>
        </div>
      </div>
      <div id="community-panel" hidden>
        <div class="community-panel-header">
          <button type="button" id="community-panel-back" class="icon-btn">&#8592;</button>
          <div id="community-panel-title"></div>
          <button type="button" id="community-panel-menu" class="icon-btn wa-placeholder-btn" data-placeholder="community-menu">&#8942;</button>
        </div>
        <div id="community-panel-body"></div>
      </div>
      <div id="message-scroll"></div>
      <div id="reply-bar" hidden>
        <div id="reply-bar-preview"></div>
        <input id="reply-bar-input" type="text" placeholder="Type a reply…" autocomplete="off">
        <button type="button" id="reply-bar-send">Send</button>
        <button type="button" id="reply-bar-cancel">&#10005;</button>
      </div>
      <button id="scroll-to-bottom" title="Jump to latest">&#8627;</button>
      <div id="empty-pane">
        <div class="empty-logo" aria-hidden="true"><svg viewBox="0 0 200 200" width="160" height="160"><path d="M100 16 C53.6 16 16 53.6 16 100 C16 146.4 53.6 184 100 184 C146.4 184 184 146.4 184 100 C184 53.6 146.4 16 100 16 Z" fill="#25D366" fill-opacity="0.22"/><rect x="54" y="76" width="66" height="22" rx="11" fill="#8696a0" fill-opacity="0.35"/><rect x="80" y="106" width="66" height="22" rx="11" fill="#8696a0" fill-opacity="0.28"/></svg></div>
        <p class="empty-tagline">WhatsApp</p>
        <p class="empty-version">Version 2.26.41.28 · archive viewer</p>
        <p class="empty-encrypted"><svg class="lock-ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-3 0H10V6a2 2 0 1 1 4 0v2z"/></svg> End-to-end encrypted</p>
        <p class="empty-hint" id="empty-hint">Select a chat to browse messages</p>
      </div>
      <div id="pane-placeholder-updates" class="pane-placeholder" hidden>
        <div class="pane-placeholder-card"><div class="status-my-thumb">+</div><div><strong>My status</strong><p class="nav-screen-muted">Updates created on your phone will appear here</p></div></div>
        <p class="pane-placeholder-footer"><svg class="lock-ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-3 0H10V6a2 2 0 1 1 4 0v2z"/></svg> Your statuses are <span class="accent-text">end-to-end encrypted</span></p>
      </div>
      <div id="pane-placeholder-calls" class="pane-placeholder" hidden>
        <div class="calls-action-grid">
          <button type="button" class="calls-action wa-placeholder-btn" data-placeholder="start-call"><span class="calls-action-ico green">📹</span>Start call</button>
          <button type="button" class="calls-action wa-placeholder-btn" data-placeholder="call-link"><span class="calls-action-ico">🔗</span>New call link</button>
          <button type="button" class="calls-action wa-placeholder-btn" data-placeholder="call-number"><span class="calls-action-ico">⌨</span>Call a number</button>
          <button type="button" class="calls-action wa-placeholder-btn" data-placeholder="schedule-call"><span class="calls-action-ico">📅</span>Schedule call</button>
        </div>
        <p class="pane-placeholder-footer">Your personal calls are <span class="accent-text">end-to-end encrypted</span></p>
      </div>
      <div id="pane-placeholder-media" class="pane-placeholder pane-placeholder-media" hidden>
        <p class="nav-screen-muted">Select media in the grid to preview (archive browse only).</p>
      </div>
      <div id="chat-loading">
        <div class="loading-spinner"></div>
        <span>Loading chat…</span>
        <span id="chat-loading-count"></span>
      </div>
    </div>
  </div>
</div>

<div id="media-gallery">
  <div id="media-gallery-header">
    <span id="media-gallery-title">Media</span>
    <div id="media-view-switcher" style="display:none">
      <button class="media-view-btn active" data-view="grid" title="Grid view">&#8862;</button>
      <button class="media-view-btn" data-view="archive" title="Archive view">&#128193;</button>
    </div>
    <button id="media-gallery-close" title="Close">&#10005;</button>
  </div>
  <div id="media-gallery-stats"></div>
  <div id="media-gallery-grid"></div>
  <div id="media-archive-view">
    <div id="media-archive-toolbar">
      <div id="media-archive-tabs">
        <button class="archive-tab active" data-dir="Received">Received</button>
        <button class="archive-tab" data-dir="Sent">Sent</button>
      </div>
      <div id="media-archive-actions">
        <button id="archive-expand-all">Expand all</button>
        <button id="archive-collapse-all">Collapse all</button>
      </div>
    </div>
    <div id="media-archive-tree"></div>
  </div>
</div>

<div id="settings-modal">
  <div id="settings-panel">
    <div id="settings-header">
      <span>Settings</span>
      <button id="settings-close">&#10005;</button>
    </div>
    <div id="settings-app-info">
      <img id="settings-app-logo" src="/static/favicon.svg" alt="" width="52" height="52">
      <div id="settings-app-details">
        <h2 id="settings-app-name">WhatsApp Backup Viewer</h2>
        <p id="settings-app-subtitle">from WhatsApp Backup Tools</p>
        <div id="settings-app-links">
          <a id="settings-repo-link" href="https://github.com/auanasgheps/whatsapp-backup-tools" target="_blank" rel="noopener noreferrer">Repository</a>
          <span id="settings-version">v{{ version }}</span>
        </div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">Theme</div>
      <div class="settings-row">
        <button class="pref-btn" data-pref="theme" data-value="dark">Dark</button>
        <button class="pref-btn" data-pref="theme" data-value="light">Light</button>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">Date format</div>
      <div class="settings-row">
        <button class="pref-btn" data-pref="date_format" data-value="DD/MM/YYYY">DD/MM/YYYY &nbsp;<em>25/07/2026</em></button>
        <button class="pref-btn" data-pref="date_format" data-value="MM/DD/YYYY">MM/DD/YYYY &nbsp;<em>07/25/2026</em></button>
        <button class="pref-btn" data-pref="date_format" data-value="YYYY/MM/DD">YYYY/MM/DD &nbsp;<em>2026/07/25</em></button>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">Font size</div>
      <div class="settings-row">
        <button class="pref-btn" data-pref="font_size" data-value="small">Small</button>
        <button class="pref-btn" data-pref="font_size" data-value="medium">Medium</button>
        <button class="pref-btn" data-pref="font_size" data-value="large">Large</button>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">Interactive session</div>
      <div class="settings-row" style="flex-direction:column;gap:8px;align-items:flex-start">
        <button type="button" id="reset-session-btn" class="pref-btn">Reset session (replies, reactions, toggles)</button>
        <p class="index-progress-label">Does not modify your msgstore backup — clears browser-only state.</p>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">Database</div>
      <div class="settings-row" style="flex-direction:column;gap:8px;align-items:flex-start">
        <button id="optimize-db-btn" class="pref-btn">Compact & optimize database</button>
        <div id="optimize-db-status" class="index-progress-label" style="display:none"></div>
        <button id="index-all-btn" class="pref-btn">Index all chats for search</button>
        <div id="index-all-progress" style="display:none;width:100%">
          <div class="index-progress-bar-wrap">
            <div id="index-progress-bar" class="index-progress-bar"></div>
          </div>
          <div id="index-progress-label" class="index-progress-label"></div>
        </div>
        <button id="clear-index-btn" class="pref-btn">Clear search index</button>
      </div>
    </div>
  </div>
</div>

<div id="chat-info-panel">
  <div id="chat-info-inner">
    <div id="chat-info-header">
      <button id="chat-info-close" type="button" aria-label="Close">&#10005;</button>
    </div>
    <div id="chat-info-hero">
      <img id="chat-info-avatar" alt="" hidden>
      <div id="chat-info-hero-fallback" class="chat-info-hero-fallback"></div>
      <div id="chat-info-title"></div>
      <div id="chat-info-subtitle" class="chat-info-subtitle"></div>
      <div id="chat-info-desc" class="chat-info-desc" style="display:none"></div>
    </div>
    <div id="chat-info-body"></div>
  </div>
</div>

<div id="msg-details-popup"></div>

<div id="context-menu" hidden role="menu"></div>
<div id="emoji-picker" hidden></div>
<div id="placeholder-toast" hidden></div>

<script>window.OUTPUT_ROOT = {{ output_root | tojson }};</script>
<script src="/static/app.js?v={{ version }}"></script>

</body>
</html>
"""
)
