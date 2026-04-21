# Manuscript Vault Manager

Turn your Scrivener novel into a living Obsidian wiki. Characters, locations, timeline, and continuity issues, extracted by AI and auto-updated as you write.

**[Download the latest release](https://github.com/Frailrain/Manuscript-Vault-Manager/releases/latest)** · **[Buy on Gumroad](https://gumroad.com/l/mvm)** (coming soon)

---

## What it does

MVM reads your Scrivener project and writes a folder of Obsidian-compatible markdown files. It extracts:

- **Characters** with relationships, per-chapter activity, and tier classification (Main / Secondary / Minor / Mentioned)
- **Locations** with descriptions and nested geography (sub-locations folded under their parents)
- **Timeline** of events in narrative order, linked back to the chapters they happen in
- **Continuity issues** the AI notices across chapters, severity-ranked and ignorable

It uses your own AI provider key. Your manuscript text is sent only to the provider you configure. Your API key and vault files never leave your machine.

---

## Installation

Download the installer for your platform from the [latest release](https://github.com/Frailrain/Manuscript-Vault-Manager/releases/latest).

**Windows:** Download the `-Setup.exe` installer and run it.

Windows may show a "Windows protected your PC" warning on first run. Click "More info" then "Run anyway." The installer is unsigned, which is standard for independent software without an Extended Validation certificate.

**macOS:** Download the `.dmg` file (pick `arm64` for Apple Silicon, `x64` for Intel Macs). Open the DMG and drag the app to Applications.

macOS may show "Manuscript Vault Manager can't be opened because Apple cannot check it for malicious software" on first run. Right-click the app, choose Open, then Open again. You only need to do this once.

**Linux:** Download the `.AppImage` file, make it executable with `chmod +x *.AppImage`, and run it.

---

## Setup

1. **Open MVM.** Go to the Settings tab.

2. **Point to your Scrivener project.** Click Browse and select your `.scriv` folder.

3. **Point to your vault folder.** Pick an empty folder where MVM will write. If you don't have one yet, create a folder anywhere (`~/Documents/my-novel-vault` works).

4. **Name your novel.** Appears in the generated Dashboard.

5. **Pick a provider and model.** The default (Anthropic plus Claude Haiku 4.5) is recommended. It's the cheapest option with the best quality-per-dollar for this task.

6. **Paste your API key.** For Anthropic: console.anthropic.com then API Keys then Create Key.

7. **Optionally pick a genre preset.** LitRPG, Romantasy, Mystery, Epic Fantasy, or Custom. The preset adds genre-specific fields (like Level and Class for LitRPG) to extracted character data.

8. **Click Save Settings.**

9. **Switch to the Run tab.** Click Import Full Manuscript. Wait 5 to 15 minutes depending on manuscript length.

10. **Click Open Vault** when complete. Opens in Obsidian if installed, in your file manager otherwise.

---

## Typical workflow

After your first Import:

1. Write new chapters in Scrivener. Edit old ones. Save.
2. In MVM, click Sync.
3. Only chapters with changes since last sync get re-extracted. Cost: typically pennies.
4. Your vault updates. Your Writer's Notes stay intact.

Sync as often as you want. The usual pattern is after finishing a chapter, to see how the new material affects what the AI understands about the whole book.

---

## Genre presets

Each preset shapes what the AI extracts beyond the defaults:

**LitRPG / Progression Fantasy:** Level, Class, Spells and Abilities, Stats per character. Glossary includes `boss`, `level`, `class`, `dungeon`, `skill`, etc. with genre-specific meanings (so "boss" is a monster, not a supervisor).

**Romantasy:** Romantic Interest, Relationship Status, Magical Abilities, Emotional Arc per character. Location mood per setting. Glossary includes `mate`, `bond`, `alpha`, `pack`.

**Mystery / Thriller:** Alibi, Motive, Suspicion Level per character. Evidence Found per location.

**Epic Fantasy:** Faction, Bloodline, Magical Traits per character. Ruler and Controlling Faction per location.

**Custom:** Define your own fields in the settings UI. Mix field types: text, number, or list.

---

## Providers supported

MVM works with Anthropic's Claude API directly and with any OpenAI-compatible endpoint.

**Anthropic (recommended for best quality-per-cost):**
- Claude Haiku 4.5 (default) — roughly $1-$2 per 80,000-word novel
- Claude Sonnet 4.6 — sharper extractions on ambiguous cases, $3-$6 per novel
- Claude Opus 4.7 — highest quality, $5-$10 per novel

**OpenAI-compatible endpoints:**
- OpenRouter (Gemini, Mistral, Llama, Qwen, and many more)
- Groq
- Together
- Fireworks

**Local (no API cost):**
- Ollama — run models on your own machine. Zero API spend, slower.
- LM Studio — similar to Ollama. Zero API spend, slower.

Set the Base URL in Settings when using any non-Anthropic provider.

---

## Recommended Obsidian plugins

**Folder Notes (highly recommended).** MVM organizes nested locations into folders with a same-named note inside. Without the plugin, you'll see the folder and the note as separate items in the file tree. With the plugin, clicking the folder displays the note's content as the folder's landing page. Much cleaner.

Install: In Obsidian, Settings then Community plugins then Browse, search "Folder Notes" (by Lost Paul), then Install and Enable.

Configure: After enabling, set "Folder note type" to "Inside the folder with the same name" (this is the default).

MVM works without the plugin. This is purely a UX improvement.

---

## FAQ

**Does MVM modify my Scrivener project?**

No. MVM reads your `.scriv` project and never writes back. Your manuscript is untouched.

**What happens if I edit files in the generated vault?**

Most fields get overwritten on the next Sync. Two things are preserved:

1. The `## Writer's Notes` section on each entity file
2. Frontmatter fields prefixed with `user-` (currently `user-tier` and `user-role`)

Add `user-tier: main` to a character's frontmatter and the AI's tier classification is overridden. The character will even move to the correct Main folder on the next Sync.

**Does MVM work offline?**

The app runs locally, but AI extraction requires talking to your chosen provider. With Ollama or LM Studio running locally, extraction is fully offline.

**What if I use something other than Scrivener?**

v0.1.0 is Scrivener-specific. Other sources (Novelcrafter, .docx files, plain folders of markdown) are under consideration for future versions.

**Why isn't MVM signed?**

Code signing costs $99/year for macOS and $300+/year for Windows Extended Validation certificates. For v0.1.0 I chose to pass those costs on as "click through the security warning once" rather than as higher prices. If MVM gains enough traction to justify the cost, future releases will be signed.

**Is my data private?**

Yes. Your API key is stored only on your machine. Your manuscript text is sent only to the provider you configure. MVM itself has no cloud component, no telemetry, no analytics.

**How much does API usage cost?**

Rough estimates for an 80,000-word novel on the default model (Claude Haiku 4.5): $0.50 to $2.00 per full Import. Sync runs after edits cost pennies. You pay the provider directly. MVM never handles these charges.

---

## Support

**Bugs and feature requests:** [GitHub Issues](https://github.com/Frailrain/Manuscript-Vault-Manager/issues)

**Everything else:** frailrain+mvm@gmail.com

I read every message. This is a small operation.

---

## Building from source

This section is only for developers who want to run MVM from source rather than using the installer.

Requires Node 20+ and npm.

```bash
git clone https://github.com/Frailrain/Manuscript-Vault-Manager.git
cd Manuscript-Vault-Manager
npm install
npm run dev
```

To build a local installer:

```bash
npm run build
npx electron-builder --linux --publish never   # or --win, --mac
```

Output lands in `dist/`.

### Repository layout

- `src/main/` — Electron main process (window, tray, IPC router)
- `src/preload/` — preload bridge exposing `window.mvm`
- `src/renderer/` — React and Tailwind UI
- `src/core/` — business logic modules (scrivener / extraction / vault / sync)
- `src/shared/` — types shared between main and renderer
- `resources/` — icons and installer assets

### Scripts

- `npm install` — install dependencies
- `npm run dev` — launch the app in dev mode (hot reload)
- `npm run typecheck` — run TypeScript against main and renderer
- `npm run build` — compile main, preload, and renderer into `out/`

---

## License

Manuscript Vault Manager is proprietary software. Purchase on Gumroad includes lifetime updates to v0.x.

Source is publicly viewable for transparency. That does not grant permission to redistribute, modify, or repackage the binary.
