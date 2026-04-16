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
