# Explorer Hide Presets

A VS Code / Cursor extension for hiding files and folders from the Explorer panel using named presets.

Instead of manually editing `files.exclude` in your settings, right-click items in the Explorer to hide them, organize your hide rules into presets, and toggle presets on and off as your workflow changes.

## Quick Start

1. **Right-click** any file or folder in the Explorer
2. Select **Hide in Explorer** — the item disappears immediately
3. To bring it back, find it in the **Hide Presets** view (Explorer sidebar) and remove the rule

That's it for basic usage. Hidden items are stored in a built-in **Manual** preset that's always available.

## Features

### Hide from the Explorer Context Menu

- **Hide in Explorer** — Instantly hides the selected file or folder (adds it to the Manual preset)
- **Hide in Preset...** — Choose which preset to add the item to, or create a new one on the spot
- **Unhide in Explorer** — Appears on items hidden by an exact rule; removes the rule to reveal the item again

### Manage Presets in the Companion View

A **Hide Presets** tree view appears in the Explorer sidebar. From here you can:

- **Create, rename, and delete** presets
- **Enable / disable** presets (toggle the eye icon) — multiple presets can be active at once
- **Switch to preset** — enables one preset and disables all others
- **Add rules** — exact file/folder paths or glob patterns (e.g. `**/*.generated.ts`)
- **Remove rules** — click the close icon on any rule

### Glob Patterns

Presets support glob rules for hiding groups of files by pattern. Glob rules can only be added from the companion view, not the Explorer context menu. Examples:

| Pattern | Effect |
|---|---|
| `**/*.test.ts` | All TypeScript test files |
| `dist/` | The dist folder |
| `coverage/` | The coverage folder |

### Multi-Root Workspaces

Presets are scoped per workspace folder. In a multi-root workspace, each folder has its own independent set of presets.

## How It Works

The extension manages VS Code's native `files.exclude` setting on your behalf. When you enable presets or add rules, it merges all active rules and writes them to `files.exclude`. Your original `files.exclude` is backed up on first activation and can be restored at any time.

**Restore original settings:** Open the Command Palette and run `Explorer Hide Presets: Restore files.exclude Backup`.

**Rebuild if out of sync:** Run `Explorer Hide Presets: Rebuild files.exclude` to re-materialize the active rules.

## Commands

All commands are available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---|---|
| Create Preset | Create a new named preset |
| Rename Preset | Rename an existing preset |
| Delete Preset | Delete a preset (Manual cannot be deleted) |
| Enable / Disable Preset | Toggle a preset on or off |
| Switch to Preset | Enable one preset, disable all others |
| Add Glob Rule | Add a glob pattern rule to a preset |
| Add Exact Rule | Add an exact file or folder path to a preset |
| Remove Rule | Remove a rule from a preset |
| Rebuild files.exclude | Re-sync hidden files with active presets |
| Restore files.exclude Backup | Revert to your original files.exclude |
