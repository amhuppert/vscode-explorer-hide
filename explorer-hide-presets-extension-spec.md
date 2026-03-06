# Explorer Hide Presets Extension — Product and Implementation Specification

## Document Purpose

This document captures the finalized design, product behavior, and implementation constraints for a VS Code extension that should also work in Cursor.

It is intended to be self-contained. A future engineer or agent should be able to start implementation from scratch using only this document, without needing any prior conversation history.

---

## 1. Overview

### 1.1 Extension Goal

Build a VS Code-compatible extension, also intended to work in Cursor, that allows users to hide files and directories from the native Explorer panel using a more ergonomic workflow than directly editing `files.exclude`.

The core idea is:

- The extension maintains its own internal model of **presets** and **rules**.
- The extension materializes the currently active rules into VS Code's native `files.exclude` setting.
- The extension integrates with the **native Explorer context menu** so users can hide and unhide items directly from Explorer.
- The extension provides a **companion management view** inside the Explorer area to manage presets, rules, and activation state.

The extension is primarily a UX layer and management system over `files.exclude`, not a replacement Explorer implementation.

### 1.2 Non-Goal

This extension does **not** replace the built-in Explorer tree with a custom tree.

It does **not** implement its own file browser for day-to-day navigation.

It does **not** support one-off unhide exceptions for files hidden by broad glob patterns.

It does **not** attempt to carefully merge or preserve unrelated user-defined `files.exclude` entries after taking control in v1. Instead, it takes a simpler backup-first approach described below.

---

## 2. Platform and Viability Assumptions

### 2.1 Target Editors

The extension is designed for:

- **VS Code**
- **Cursor**

Assumption: Cursor supports a large subset of the VS Code extension API surface, so the correct implementation strategy is to build a standard VS Code extension using stable APIs and test it in both editors.

### 2.2 Core Platform Constraints

The design assumes the following extension-platform realities:

- The native Explorer view can be extended with **context menu commands**.
- Extensions can contribute a **custom companion view** into the Explorer container.
- Extensions can read and write workspace and folder settings, including `files.exclude`.
- Extensions cannot directly intercept and re-render the built-in Explorer tree while preserving it as the built-in tree.

Therefore, the chosen architecture is:

- Keep the built-in Explorer.
- Use `files.exclude` to affect what the built-in Explorer shows.
- Provide management UX around that.

---

## 3. Core Product Concept

### 3.1 What the User Should Experience

The user should be able to:

- Right-click a file or folder in the Explorer and hide it.
- Right-click a hidden exact-match item and unhide it.
- Add an item to a named preset from Explorer.
- Create and manage named presets in a companion view.
- Turn multiple presets on at once.
- Switch exclusively to a single preset.
- Define broader glob-based hide rules in presets from the management UI.

### 3.2 Mental Model

The user-facing mental model should be:

- A **preset** is a named collection of hide rules.
- A **rule** hides either:
  - one exact file path,
  - one exact folder path, or
  - a glob pattern.
- Any number of presets can be enabled at once.
- The Explorer hides whatever is produced by the union of all active rules.
- Right-click Explorer actions are only for **exact path** rules.
- Advanced glob rules exist, but are managed only in the companion view.

---

## 4. Finalized Product Decisions

This section records the final decisions already made and should be treated as authoritative for v1.

### 4.1 Storage and Scope

- The extension is intended as a **personal-use workflow tool**.
- However, the extension is allowed to persist data in workspace or folder settings files.
- The user explicitly accepted that presets may live in workspace settings files.
- The extension is **not required** to avoid repo-visible changes in v1.

### 4.2 Multi-Root Behavior

- In a single-root workspace, presets are normal project presets.
- In a multi-root workspace, presets are **per root folder**.
- The companion view should group or organize state by workspace folder.
- Materialization into `files.exclude` must respect per-root behavior.

### 4.3 Preset Activation Model

- Multiple presets may be active at the same time.
- The extension must also support **switch-to-preset** behavior, meaning:
  - activating one preset exclusively,
  - while deactivating others in the same scope.

### 4.4 Explorer Context Menu Behavior

Explorer right-click actions manage **exact-match rules only**.

This is a hard rule.

Explorer actions must not create or edit glob rules.

### 4.5 Presets May Contain Globs

Presets may still contain glob rules.

However:

- glob rules are created and managed only from the companion view,
- not from Explorer context menu actions.

### 4.6 Unhide Behavior

The extension must show **Unhide in Explorer** only when the selected item is hidden by an **exact-match rule owned by the extension**.

If an item is hidden only because of a glob rule:

- do not show per-item unhide,
- do not offer one-off exceptions,
- do not attempt file-specific override behavior.

### 4.7 Files Exclude Management Strategy (v1)

The user explicitly chose a simplified v1 strategy:

- If `files.exclude` already exists, create a backup of it.
- After that, the extension may treat `files.exclude` as the extension-controlled materialized output.
- The extension does **not** need to carefully preserve, merge, or surgically remove unrelated existing entries.
- The product should acknowledge that this may interfere with unrelated existing `files.exclude` settings.

This tradeoff is intentional for v1.

### 4.8 Exact-Match Rule Management Only for File-Level Operations

The user clarified:

- “Only manage files that are hidden by exact match” applies to per-item Explorer actions.
- This does **not** prohibit presets from containing glob rules.
- It means individual item-level operations (especially unhide) only apply to exact-match rules.

### 4.9 Workspace Requirement

If no workspace or folder is open:

- the extension should be disabled for its main functionality,
- and should show a clear message indicating that a folder or workspace must be opened.

---

## 5. Functional Requirements

## 5.1 Native Explorer Integration

The extension must integrate with the native Explorer context menu.

At minimum, it should support these actions on Explorer resources:

- **Hide in Explorer**
- **Hide in Preset...**
- **Unhide in Explorer**

### 5.1.1 Hide in Explorer

Behavior:

- Available when a file or folder is selected in Explorer.
- Adds an exact-match rule for that resource to the built-in **Manual** preset for the relevant workspace folder.
- Re-materializes active rules into `files.exclude`.

### 5.1.2 Hide in Preset...

Behavior:

- Available when a file or folder is selected in Explorer.
- Prompts the user to select an existing preset, or potentially create a new preset during the flow.
- Adds an exact-match rule for the selected resource to the chosen preset.
- The preset may or may not already be active; this behavior should be specified during implementation, but recommended default is to leave activation unchanged unless explicitly requested.

Recommended UX default:

- Add to the selected preset.
- Do not auto-activate it unless the UI explicitly asks.

### 5.1.3 Unhide in Explorer

Behavior:

- Only shown when the selected resource is hidden by an exact-match rule owned by the extension.
- Removes the exact-match rule that currently hides that resource.
- Re-materializes active rules into `files.exclude`.

Important limitation:

- If the resource is hidden only by a glob rule, do not show this command.

## 5.2 Manual Preset

There must be a built-in preset named **Manual**.

Purpose:

- This is the default destination for quick “Hide in Explorer” actions.
- It acts as the catch-all immediate-action preset.

Rules:

- The Manual preset exists per workspace folder.
- It cannot be deleted.
- It can be enabled or disabled like any other preset unless implementation decides it should always exist and always be eligible for activation changes.

Recommended behavior:

- Manual is just a normal preset with special name/identity and non-deletable status.

## 5.3 Presets

A preset is a named collection of rules.

Each preset must support:

- name,
- enabled/disabled state,
- collection of exact-match file rules,
- collection of exact-match folder rules,
- collection of glob rules.

### 5.3.1 Preset Operations

The companion UI must support:

- create preset,
- rename preset,
- delete preset (except Manual),
- enable preset,
- disable preset,
- switch exclusively to preset,
- inspect rules in preset,
- add exact or glob rules,
- remove rules.

### 5.3.2 Multiple Active Presets

The extension must support multiple enabled presets simultaneously.

The materialized `files.exclude` result is the union of all active rules in scope.

### 5.3.3 Exclusive Switch

The extension must support “switch to preset” behavior.

Semantics:

- Enable the selected preset.
- Disable all other presets in the same workspace-folder scope.
- Re-materialize immediately.

## 5.4 Rules

There are three conceptual rule types.

### 5.4.1 Exact File Rule

Represents one specific file path relative to the workspace folder.

Example:

`src/generated/schema.ts`

### 5.4.2 Exact Folder Rule

Represents one specific folder path relative to the workspace folder.

Recommended normalized representation:

`src/generated/`

Folder rules should end in `/` internally and in materialized form to preserve clarity.

### 5.4.3 Glob Rule

Represents a broader pattern.

Examples:

- `**/*.generated.ts`
- `dist/`
- `coverage/`

Glob rules are only created and managed from the companion view.

## 5.5 Companion Management View

The extension must provide a companion management UI inside the Explorer area.

This should be implemented as a contributed custom tree view.

### 5.5.1 Companion View Responsibilities

The view should allow users to:

- see workspace folders,
- see presets under each workspace folder,
- see whether each preset is enabled,
- create presets,
- enable/disable presets,
- switch to preset,
- inspect rules inside each preset,
- add/remove exact and glob rules,
- create glob rules,
- manage the Manual preset,
- trigger materialization/resync actions if needed.

### 5.5.2 Suggested View Structure

Recommended tree structure:

- Workspace Folder
  - Preset: Manual
    - Rule: `path/to/file`
    - Rule: `some/folder/`
  - Preset: Frontend Focus
    - Rule: `dist/`
    - Rule: `coverage/`
  - Preset: Generated Files
    - Rule: `**/*.generated.ts`

Recommended visual indicators:

- enabled/disabled marker for presets,
- icon differences for file, folder, and glob rules,
- action buttons in view title or inline tree item actions where appropriate.

### 5.5.3 View Title Actions

Recommended commands in the view title:

- New Preset
- Enable All / Disable All
- Switch to Preset
- Rebuild Hidden State
- Open Backup / Restore Backup (optional)

Not all are strictly required for v1, but New Preset and a resync/rebuild action are strongly recommended.

## 5.6 Backup Behavior

Because v1 uses a simplified `files.exclude` strategy, backup behavior is important.

### 5.6.1 Backup Trigger

When the extension first takes control of `files.exclude` for a given scope:

- if `files.exclude` already has a value,
- save a backup of the existing value under the extension's own settings namespace.

### 5.6.2 Backup Scope

Backups must be scoped the same way the extension scopes state:

- per workspace folder in multi-root,
- per workspace in single-root.

### 5.6.3 Backup Usage

At minimum, the backup should exist for safety and troubleshooting.

Recommended optional functionality:

- provide a command to restore the original backup into `files.exclude`.

Even if restore is not included in the very first implementation, the backup data model should be designed so restoration can be added later.

## 5.7 Materialization Into `files.exclude`

The extension's active rules must be converted into the `files.exclude` format.

### 5.7.1 Materialization Principle

The active materialized state is the union of all enabled preset rules for a given workspace folder.

For each resulting path/pattern:

- write an entry into `files.exclude` with value `true`.

### 5.7.2 Exact Rule Normalization

Use normalized relative paths:

- file exact rule: `path/to/file.ext`
- folder exact rule: `path/to/folder/`

### 5.7.3 Glob Rule Handling

Glob rules should be materialized directly as provided, after any needed validation.

### 5.7.4 Ownership Model

In v1, the extension effectively owns the materialized `files.exclude` value after backup.

That means materialization can overwrite the full setting for the controlled scope.

### 5.7.5 Rebuild Triggers

Materialization should run after:

- adding a rule,
- removing a rule,
- creating a preset,
- deleting a preset,
- enabling/disabling a preset,
- switch-to-preset,
- restoring backup,
- extension activation if state reconciliation is needed.

## 5.8 No Workspace Behavior

When no folder/workspace is open:

- context-menu commands should be disabled or fail gracefully,
- companion view should show an explanatory empty state,
- commands should show a message such as:
  - “Open a folder or workspace to use Explorer Hide Presets.”

---

## 6. Data Model Requirements

This section describes the recommended conceptual schema. Exact field names may vary, but the structure should be preserved.

## 6.1 Extension-Owned Settings Namespace

The extension should store its own state under a dedicated settings namespace, for example:

- `explorerHidePresets.*`

Exact naming may vary, but use a stable, extension-specific namespace.

## 6.2 Suggested State Shape

Recommended high-level structure per workspace folder:

```ts
interface WorkspaceFolderState {
  backup?: Record<string, boolean>;
  presets: Preset[];
}

interface Preset {
  id: string;
  name: string;
  isManual: boolean;
  enabled: boolean;
  rules: Rule[];
}

type Rule = ExactFileRule | ExactFolderRule | GlobRule;

interface ExactFileRule {
  kind: 'exactFile';
  path: string; // workspace-folder-relative
}

interface ExactFolderRule {
  kind: 'exactFolder';
  path: string; // workspace-folder-relative, normalized with trailing slash
}

interface GlobRule {
  kind: 'glob';
  pattern: string;
}
```

### 6.2.1 Notes

- Use stable preset IDs rather than using names as identifiers.
- The Manual preset should have a fixed identity marker.
- Rules should be normalized on insert to avoid duplicates.
- Duplicate rules inside the same preset should be prevented.
- Duplicate effective rules across presets are acceptable but should collapse during materialization.

## 6.3 Storage Scope

Because presets are per-root in multi-root workspaces, the state must be attributable to a specific workspace folder.

Implementation options include:

- folder-scoped settings,
- workspace settings keyed by folder URI/name,
- or another stable mapping.

Recommended approach:

- prefer folder-scoped configuration where practical, since the underlying `files.exclude` behavior is also rooted.

---

## 7. Behavioral Edge Cases

## 7.1 Hidden by Exact Rule and Glob Rule Simultaneously

If a resource is hidden by both:

- an exact-match extension rule,
- and a glob rule,

then removing the exact rule would not make it visible if the glob still applies.

Recommended v1 behavior:

- `Unhide in Explorer` should only be shown when the extension can confidently determine the item is hidden by an exact-match rule and not merely by a glob-only state.
- If both apply, implementation may choose one of two behaviors:
  1. still show Unhide, but only remove the exact rule, or
  2. hide Unhide unless exact-rule removal would actually unhide the item.

Recommended simplification for v1:

- only show Unhide when the selected item is matched by an exact rule owned by the extension.
- do not guarantee that the item becomes visible if a glob still applies.

This is acceptable as long as the command semantics remain “remove exact rule owned by the extension,” not “guarantee visible.”

## 7.2 Renaming or Moving Hidden Files

If a hidden exact-path resource is renamed or moved outside the extension workflow, the rule may become stale.

v1 requirement:

- stale exact rules are acceptable.
- the companion view should still show them until removed.

Optional future enhancement:

- detect missing resources and mark stale rules visually.

## 7.3 Duplicate Rule Entries

Rules should be normalized to prevent trivial duplicates.

Examples:

- `src/foo/` should not be stored twice in the same preset.
- `src/foo` vs `src/foo/` should normalize appropriately based on whether the target is a file or folder.

## 7.4 Glob Validation

Glob rules entered in the companion view should receive lightweight validation.

Validation can include:

- non-empty string,
- normalization of obvious whitespace mistakes,
- optional warning for invalid or suspicious patterns.

Strict glob parsing is not required in v1.

## 7.5 Manual Preset Deletion

The Manual preset must not be deletable.

Rename behavior is not recommended.

Recommended rule:

- Manual cannot be renamed or deleted.

---

## 8. UX Guidance

## 8.1 Naming

Working title in this document:

**Explorer Hide Presets**

This is descriptive and appropriate as a placeholder or actual extension name.

## 8.2 UX Priorities

The product should feel:

- native,
- lightweight,
- fast,
- predictable,
- clearly tied to Explorer,
- more convenient than editing `files.exclude` manually.

## 8.3 UX Principle: Simple First, Advanced in Companion View

Keep the Explorer-side experience minimal and immediate.

Use the companion view for:

- globs,
- preset structure,
- inspection,
- activation logic,
- maintenance,
- backup/restore tooling.

## 8.4 Messaging Around v1 `files.exclude` Ownership

Because the extension may overwrite unrelated `files.exclude` entries after backup, the extension should communicate this clearly somewhere, ideally via:

- README,
- onboarding message,
- or settings description.

This avoids surprising users.

---

## 9. Recommended Command Inventory

These command names are suggestions and can be adjusted, but equivalent behavior should exist.

## 9.1 Explorer Commands

- `explorerHidePresets.hideInExplorer`
- `explorerHidePresets.hideInPreset`
- `explorerHidePresets.unhideInExplorer`

## 9.2 Companion View / Global Commands

- `explorerHidePresets.createPreset`
- `explorerHidePresets.renamePreset`
- `explorerHidePresets.deletePreset`
- `explorerHidePresets.enablePreset`
- `explorerHidePresets.disablePreset`
- `explorerHidePresets.switchToPreset`
- `explorerHidePresets.addGlobRule`
- `explorerHidePresets.addExactRule`
- `explorerHidePresets.removeRule`
- `explorerHidePresets.rebuildFilesExclude`
- `explorerHidePresets.restoreFilesExcludeBackup` (recommended optional)

---

## 10. Recommended Context Menu Visibility Logic

## 10.1 Hide in Explorer

Show when:

- selected item is a file or folder in Explorer,
- workspace exists.

## 10.2 Hide in Preset...

Show when:

- selected item is a file or folder in Explorer,
- workspace exists.

## 10.3 Unhide in Explorer

Show when:

- selected item is a file or folder in Explorer,
- workspace exists,
- selected resource matches an exact-match rule owned by the extension.

Do not show when:

- hidden only by glob,
- no extension-owned exact rule applies,
- no workspace is open.

---

## 11. Implementation Guidance for a New Agent

This section is intended to help a new engineer or coding agent start from zero.

## 11.1 Recommended Build Strategy

Implement in this order:

1. **Project scaffolding**
   - Create standard VS Code extension project in TypeScript.
   - Ensure it runs in VS Code Extension Development Host.

2. **Configuration/state layer**
   - Implement read/write logic for extension-owned preset state.
   - Implement backup capture for existing `files.exclude`.
   - Implement path normalization helpers.

3. **Materialization engine**
   - Build function that:
     - reads active presets,
     - unions rules,
     - writes resulting object to `files.exclude`.

4. **Explorer commands**
   - Add Hide in Explorer.
   - Add Hide in Preset....
   - Add Unhide in Explorer.
   - Verify URI-to-workspace-folder resolution.

5. **Companion tree view**
   - Render workspace folders, presets, and rules.
   - Add preset enable/disable/switch behavior.
   - Add create/remove rule actions.

6. **Glob rule authoring**
   - Add UI flow to create glob rules from the companion view.

7. **Backup restore / rebuild helpers**
   - Add optional recovery commands.

8. **Testing**
   - Single-root workspace.
   - Multi-root workspace.
   - Existing `files.exclude` backup path.
   - Exact-rule unhide visibility.
   - Glob-hidden items not showing unhide.
   - Cursor compatibility verification.

## 11.2 Key Internal Functions to Design Early

A new implementation should define the following core logic early:

- `getWorkspaceFolderForUri(uri)`
- `loadState(scope)`
- `saveState(scope, state)`
- `ensureManualPreset(state)`
- `backupExistingFilesExcludeIfNeeded(scope)`
- `normalizeExactRule(uri, workspaceFolder)`
- `materializeActiveRules(state)`
- `writeFilesExclude(scope, excludeMap)`
- `isHiddenByOwnedExactRule(uri, state)`

## 11.3 Suggested Rule Normalization Process

When adding an exact rule from Explorer:

1. Resolve selected resource URI.
2. Resolve containing workspace folder.
3. Convert to workspace-folder-relative path.
4. Detect whether target is file or folder.
5. Normalize:
   - files: no trailing slash,
   - folders: trailing slash.
6. Store as exact-file or exact-folder rule.

## 11.4 Suggested Materialization Algorithm

For one workspace-folder scope:

1. Load state.
2. Collect all enabled presets.
3. Flatten all rules from enabled presets.
4. Normalize and de-duplicate materialized keys.
5. Produce:

```json
{
  "path/to/file": true,
  "path/to/folder/": true,
  "**/*.generated.ts": true
}
```

6. Write this object to the folder/workspace `files.exclude` target.

Because v1 owns the output after backup, this algorithm can write the full object directly.

## 11.5 Suggested Unhide Decision Logic

When determining whether to show or execute Unhide in Explorer:

1. Resolve selected URI to workspace folder.
2. Normalize selected item to exact rule form.
3. Search extension-owned presets for matching exact rule.
4. If no exact match exists, do not show Unhide.
5. If exact match exists, show Unhide and remove that exact rule when invoked.

Do not attempt to analyze glob exceptions or per-file override semantics.

---

## 12. Future Enhancements (Out of Scope for v1)

These are explicitly not required for the first implementation, but may be worth tracking.

- Careful merge strategy with unrelated `files.exclude` rules.
- One-off exceptions to glob rules.
- Better detection of stale exact rules after file moves/deletes.
- Import/export presets.
- Sync presets across workspaces or user profile.
- Optional mirroring to `search.exclude`.
- Better diagnostics explaining why a file is hidden.
- Restore original `files.exclude` automatically on uninstall/deactivation.
- Better conflict handling when the user edits `files.exclude` manually after the extension takes control.

---

## 13. Final Summary

This extension is a management layer over `files.exclude` that adds a native-feeling workflow for hiding files and folders in Explorer.

The final v1 design is defined by these principles:

- Use the built-in Explorer, not a custom replacement.
- Use `files.exclude` as the native mechanism.
- Add right-click Explorer actions for exact-match hiding and unhiding.
- Add a companion Explorer-side view for presets and glob management.
- Support multiple active presets plus exclusive switch-to-preset behavior.
- Include a built-in Manual preset.
- Allow glob rules only in presets, not through Explorer context menu.
- Show per-item Unhide only for exact-match rules owned by the extension.
- Keep v1 `files.exclude` ownership intentionally simple: backup first, then materialize extension state directly.

This document should be treated as the authoritative implementation brief for the next phase of work.
