<p align="center">
  <a href="./FEATURES.zh-CN.md">中文</a> · <a href="./FEATURES.md">English</a>
</p>

# KaiBoard Features

> **English.** KaiBoard is a free, open-source, local-first multi-board whiteboard. It adds the "multi-file / multi-board management" capability Excalidraw lacks natively, and enhances local data safety, cross-device migration, and the Chinese writing experience. Drawing engine: Excalidraw 0.18.1. Tech stack: Excalidraw 0.18.1 + React 18 + IndexedDB (idb). All data stays in your browser; nothing is uploaded to any server.

## One-line positioning (for GitHub About)

> **KaiBoard** — a free, open-source, local-first multi-board whiteboard with Chinese handwriting fonts. No account, no cloud — your data stays on your own device. Built for personal single-user use; no real-time collaboration.

## Feature overview
1. **Local-first & data safety** — data on your device, no account, no upload; optional folder storage.
2. **Multi-board workspace (core)** — folder-tree of boards, drag, trash, search.
3. **Import / export & cross-device migration** — native `.excalidraw` exchange, workspace backup, parallel-merge migration, PPTX export.
4. **Chinese & localization** — Chinese handwriting font, Simplified/Traditional/English UI, light & dark themes.
5. **Onboarding** — first-run guide, empty-board welcome, element comments.
6. **Inter-board links (🔶 experimental)** — usable but value unverified; not a selling point.
7. **Engine, credits & two settings layers** — drawing engine from Excalidraw, credits, two settings boundaries.

**🇬🇧 English.** KaiBoard is a personal, local-first whiteboard: data stays on your own device by default — no backend, no account, no upload to any server.
- **Default storage**: browser IndexedDB (system disk).
- **Auto-save & state persistence**: debounced auto-save; remembers workspace state (expanded nodes, last board, sidebar width, theme) and restores after refresh.
- **Optional folder storage**: in Settings → Storage you can pick a local folder; KaiBoard writes real files there (`kaiboard-data/tree.json` + `boards/<id>.json`).
  - Saves system-disk space; enables a *theoretically possible* multi-machine sync via a cloud-sync folder (OneDrive / Baidu, etc.) — point KaiBoard on another PC at the same folder.
  - ⚠️ Honesty note: folder storage is implemented; but cross-machine sync via cloud drive (conflict handling, last-write-wins, frequent tree.json rewrites) depends on your cloud client and is **not fully verified by us** — logically feasible, not a tested selling point.
  - **Browser support**: folder storage needs the File System Access API — **Chrome/Edge only**; Firefox/Safari fall back to browser default storage automatically (no data loss).
  - **Reversible**: switch back to browser default anytime; switching merges seamlessly (folder ↔ browser, no data loss); old files remain on disk.

**Boundary / non-goal: no real-time multi-user collaboration.**
- Multi-machine sync is file-level, same-person-sequential, last-write-wins.
- No real-time co-editing (no CRDT/OT, no concurrent-merge). If needed later, it's a new direction requiring backend/account/conflict-algorithm work — out of current scope.

**🇬🇧 English.** Excalidraw is single-canvas: one scene at a time, no "multi-file / multi-board" concept. KaiBoard's core optimization extends that single canvas into an organizable, manageable, migratable multi-board workspace.
- **1. Multi-board file tree**: left tree of folders + boards, arbitrarily nested; manage many top-level folders and boards; click to open (component persists, state kept); breadcrumb path in top bar.
- **2. Drag to organize**: reorder, drag into folder, drag back to root; cycle protection prevents dropping a folder into its own descendant.
- **3. Right-click menu & batch import**: context-specific actions (new board/folder, import boards — multi-select `.excalidraw` into current folder, paste); folder offers "Export PPTX" (recursive); board offers export/duplicate/link/cut/copy/rename/delete. Move via drag or cut-copy-paste (the old "Move to…" submenu was removed).
- **4. Trash (anti-mis-delete)**: delete = soft-delete to trash, restorable; supports permanent delete & empty trash.
- **5. Sidebar search**: filter by keyword; ancestor chains auto-expand & highlight; doesn't disturb the tree when not found.
- **6. Cross-version import robustness**: normalize via official `restore()` before loading any source; whole-load is guarded — incompatible content degrades to a blank canvas + notice, never crashes the app; other boards keep working.

**🇬🇧 English.**
- **1. Unified format rule**: except top-bar "Export all / Import backup" (KaiBoard `.json` workspace backup), all single/multi import & export stay native `.excalidraw` — uniform, round-trippable, externally exchangeable (consumable by excalidraw.com / third-party NL→Excalidraw generators).
- **2. Single-board import/export**: native Excalidraw `.excalidraw`, lands precisely in a chosen folder.
- **3. Cross-device parallel migration (backup/restore)**: "Export all" lets you define a top folder name and wraps everything; "Import backup" merges in parallel — all nodes get fresh ids, never overwrites or clears existing content.
- **4. Sidebar multi-select & batch export / drag-folder import**: multi-select boards (folder = recursive; tri-state); "Export selected" exports each as native `.excalidraw`; drag a system folder onto the sidebar to recreate structure and batch-import its `.excalidraw`/`.json` (Chrome/Edge recursive; Firefox/Safari flatten).
- **5. Presentation export (PPTX)**: export board / folder (recursive) / selected to PPTX (16:9, one board per slide); zero upload, fully local via `pptxgenjs` (lazy-loaded). `.excalidraw` for exchange/re-edit, PPTX for delivery — non-conflicting.

**🇬🇧 English.**
- **1. Chinese handwriting font (Xiaolai)**: built-in Xiaolai (小赖体) font, self-hosted, offline (SIL OFL-1.1, chosen/optimized by excalidraw-cn for Chinese); canvas defaults to it, no manual switch. Subset `@font-face` loads glyphs on demand. The font is generated into `public/fonts/` at build time from the `@excalidraw/excalidraw` dependency and is **not committed to the repo** (kept text-only).
- **2. Multi-language UI**: Simplified / Traditional Chinese / English (one-click in settings); Excalidraw's native toolbar switches language too; KaiBoard's own sidebar/menu/prompts/settings shell text is fully i18n'd.
- **3. Theme**: built-in light/dark toggle, persisted; assets self-hosted (`EXCALIDRAW_ASSET_PATH = "/"`), offline.

**🇬🇧 English.**
- **1. First-run guide**: when workspace is empty, auto-creates a "我的画板 / 画板1" sample — ready to use.
- **2. Empty-board welcome**: opening an empty board shows a centered welcome screen (quick-start hints + entry points).
- **3. Element comments**: select a canvas element to add a comment, anchored overlay (follows pan/zoom/move, hideable); written to element `customData`, saved/exported locally, no backend.

**🇬🇧 English.** (🔶 experimental, value unverified)
- **Status**: usable, but real demand unverified — proposed early, never used by the author, no user feedback. Currently "kept but frozen": not advertised, no further investment (no bidirectional backlink panel). If you use it and find value, feedback can unfreeze it.
- Copy a board's link (`kaiboard://<id>`) into any element's "link". Clicking it jumps **inside KaiBoard** to the target board (no new tab). Envisaged uses: "index board", "kanban nav", "content interlink" (all unverified).

**🇬🇧 English.**
- **1. Engine & credits**: 100% of the canvas engine comes from open-source Excalidraw (MIT) — pen, shapes, text, arrows, images, frames, infinite canvas. KaiBoard adds multi-board organization / local optimization / shell capabilities on top; the engine is unmodified. Thanks to the Excalidraw team & community.
- **2. Two settings layers**: ① in-canvas settings (Excalidraw's own: zoom, theme, export, shortcuts) — Excalidraw-controlled; ② shell settings (KaiBoard ⚙): language, storage, and KaiBoard's added entries (backup import/export, links). Distinct, non-interfering.
- **3. Language scope**: Excalidraw natively supports dozens of languages (untouched); KaiBoard shell adds Simplified/Traditional Chinese/English (covers main audiences). Shell text is small/independent, can't add/remove Excalidraw languages.

**🇬🇧 English.** The current base edition focuses on local-first whiteboard capabilities; further extensions are under internal evaluation. Mature ones ship gradually in later versions — not pre-announced in this release.

