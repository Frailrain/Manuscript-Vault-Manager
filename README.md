# Manuscript Vault Manager

Desktop app that syncs Scrivener projects into Obsidian vaults.

## Scripts

```bash
npm install       # install dependencies
npm run dev       # launch the app in dev mode (hot reload)
npm run typecheck # run TypeScript against main + renderer
npm run build     # produce a Windows NSIS installer in dist/
```

## Layout

- `src/main/` — Electron main process (window, tray, IPC router)
- `src/preload/` — preload bridge exposing `window.mvm`
- `src/renderer/` — React + Tailwind UI
- `src/core/` — business logic modules (scrivener / extraction / vault / sync)
- `src/shared/` — types shared between main and renderer
- `resources/` — icons and installer assets

Each subdirectory under `src/core/` is a stub that a later brief will fill in.

## Recommended Obsidian Plugins

**Folder Notes** (highly recommended): MVM organizes nested locations into folders with a same-named note inside. Without the plugin, you'll see the folder and the note as separate items in the file tree. With the plugin, clicking the folder displays the note's content as the folder's landing page — much cleaner.

Install: In Obsidian, Settings → Community plugins → Browse → search "Folder Notes" (by Lost Paul) → Install → Enable.

Configure: After enabling, set "Folder note type" to "Inside the folder with the same name" (this is the default).

MVM works without the plugin — this is purely a UX improvement.
