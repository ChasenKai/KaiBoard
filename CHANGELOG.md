<p align="center">
  <a href="./CHANGELOG.zh-CN.md">中文</a> · <a href="./CHANGELOG.md">English</a>
</p>

# KaiBoard Changelog

> User-facing version history, shipped with the open-source release (public edition).

---

## About version numbers
- Single source of truth: the `version` field in `package.json`.
- We publish one product — **KaiBoard** — with one version number; future capability upgrades continue on the same incrementing version.
- The base and extended capabilities share one codebase; any update bumps the whole version — we do not split into two public version lines.

---

## Current version

### v1.0.0-beta (2026-08-09) · first public beta of the base edition
- Multi-board file tree / sidebar multi-select + drag whole groups into folders
- Unified import & export: single/multi import and single/multi export are all native `.excalidraw`; the top bar "Export all / Import backup" produces a KaiBoard workspace `.json`
- Presentation export: PPTX (pptxgenjs, lazy-loaded on demand, not in the main bundle)
- Element comments (saved locally with the board, exported with the `.excalidraw`)
- Help dialog with native two-column layout; version entry under "Settings → About"
- Toast aligned to the native light box
- Board-level cut / copy / paste
- Open-source license trio (MIT + third-party licenses + README license section)
- Top announcement bar "beta" data-backup reminder

> Note: the current public release is the base edition, focused on local-first whiteboard capabilities. Extended capabilities will unlock naturally with future version upgrades.

## Version number rules
- Single source of truth: the `version` field in `package.json`.
- One public incrementing version number; base and extended capabilities share one codebase, and any update bumps the whole version — we do not split into two public version lines.
