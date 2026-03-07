import * as vscode from 'vscode';
import type { Preset, WorkspaceFolderState } from './types.js';
import { MANUAL_PRESET_ID } from './types.js';
import { createExactFileRule, createExactFolderRule, createGlobRule } from './normalization.js';
import {
  ensureManualPreset,
  createPreset,
  deletePreset,
  renamePreset,
  enablePreset,
  disablePreset,
  switchToPreset,
  addRuleToPreset,
  addRulesToPreset,
  removeRuleFromPreset,
  setPresetExtends,
} from './presets.js';
import { materializeActiveRules, materializeInvertedRules } from './materialization.js';
import { isHiddenByOwnedExactRule, removeExactRulesForPath } from './unhide.js';
import {
  loadState,
  saveState,
  backupExistingFilesExclude,
  writeFilesExclude,
  getWorkspaceFolderForUri,
  restoreBackup,
  listWorkspaceRootEntries,
} from './state.js';
import type { PresetNode, RuleNode, FolderNode } from './treeView.js';

type TreeNode = FolderNode | PresetNode | RuleNode;

async function materializeAndWrite(
  folder: vscode.WorkspaceFolder,
  state: WorkspaceFolderState
): Promise<void> {
  let excludeMap: Record<string, boolean>;
  if (state.inverted) {
    const entries = await listWorkspaceRootEntries(folder);
    excludeMap = materializeInvertedRules(state, entries);
  } else {
    excludeMap = materializeActiveRules(state);
  }
  await writeFilesExclude(folder, excludeMap);
}

function checkWorkspace(): vscode.WorkspaceFolder[] | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('Open a folder or workspace to use Explorer Hide Presets.');
    return undefined;
  }
  return [...folders];
}

function getFolderForUri(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
  const folder = getWorkspaceFolderForUri(uri);
  if (!folder) {
    vscode.window.showErrorMessage('Could not determine workspace folder for this resource.');
  }
  return folder;
}

async function pickWorkspaceFolder(
  folders: readonly vscode.WorkspaceFolder[]
): Promise<vscode.WorkspaceFolder | undefined> {
  if (folders.length === 1) return folders[0];
  const pick = await vscode.window.showQuickPick(
    folders.map(f => ({ label: f.name, folder: f })),
    { placeHolder: 'Select workspace folder' }
  );
  return pick?.folder;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  refreshTreeView: () => void
): void {
  // 1. Hide in Explorer (supports multi-select)
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.hideInExplorer', async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
      if (!checkWorkspace()) return;

      const targets = uris && uris.length > 0 ? uris : [uri];

      // Group URIs by workspace folder
      const byFolder = new Map<string, { folder: vscode.WorkspaceFolder; uris: vscode.Uri[] }>();
      for (const target of targets) {
        const folder = getFolderForUri(target);
        if (!folder) continue;
        const key = folder.uri.toString();
        if (!byFolder.has(key)) {
          byFolder.set(key, { folder, uris: [] });
        }
        byFolder.get(key)!.uris.push(target);
      }

      for (const { folder, uris: folderUris } of byFolder.values()) {
        let state = loadState(folder);
        state = ensureManualPreset(state);
        await backupExistingFilesExclude(folder);

        const rules: import('./types.js').Rule[] = [];
        for (const target of folderUris) {
          const stat = await vscode.workspace.fs.stat(target);
          const isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
          const relativePath = vscode.workspace.asRelativePath(target, false);
          rules.push(
            isDirectory
              ? createExactFolderRule(relativePath)
              : createExactFileRule(relativePath)
          );
        }

        const { state: newState, added } = addRulesToPreset(state, MANUAL_PRESET_ID, rules);
        if (added === 0) continue;

        state = newState;
        await saveState(folder, state);
        await materializeAndWrite(folder, state);
      }

      refreshTreeView();
    })
  );

  // 2. Hide in Preset... (supports multi-select)
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.hideInPreset', async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
      if (!checkWorkspace()) return;

      const targets = uris && uris.length > 0 ? uris : [uri];
      const folder = getFolderForUri(targets[0]);
      if (!folder) return;

      let state = loadState(folder);
      state = ensureManualPreset(state);

      const createNewLabel = '+ Create New Preset...';
      const items = [
        ...state.presets.map(p => ({ label: p.name, presetId: p.id })),
        { label: createNewLabel, presetId: '' },
      ];
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a preset to add this item to',
      });
      if (!pick) return;

      let targetPresetId: string;
      if (pick.label === createNewLabel) {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter a name for the new preset',
          placeHolder: 'Preset name',
        });
        if (!name) return;
        const result = createPreset(state, name);
        state = result.state;
        targetPresetId = result.presetId;
      } else {
        targetPresetId = pick.presetId;
      }

      const rules: import('./types.js').Rule[] = [];
      for (const target of targets) {
        const stat = await vscode.workspace.fs.stat(target);
        const isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
        const relativePath = vscode.workspace.asRelativePath(target, false);
        rules.push(
          isDirectory
            ? createExactFolderRule(relativePath)
            : createExactFileRule(relativePath)
        );
      }

      const { state: newState, added } = addRulesToPreset(state, targetPresetId, rules);
      if (added === 0) {
        vscode.window.showInformationMessage('All selected items already exist in this preset.');
        return;
      }
      state = newState;

      await saveState(folder, state);
      if (state.presets.some(p => p.enabled)) {
        await materializeAndWrite(folder, state);
      }
      refreshTreeView();
    })
  );

  // 3. Unhide in Explorer
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.unhideInExplorer', async (uri: vscode.Uri) => {
      if (!checkWorkspace()) return;
      const folder = getFolderForUri(uri);
      if (!folder) return;

      let state = loadState(folder);

      const stat = await vscode.workspace.fs.stat(uri);
      const isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
      let relativePath = vscode.workspace.asRelativePath(uri, false);
      if (isDirectory && !relativePath.endsWith('/')) {
        relativePath += '/';
      }

      if (!isHiddenByOwnedExactRule(relativePath, state)) {
        vscode.window.showInformationMessage('This item is not hidden by an exact rule.');
        return;
      }

      state = removeExactRulesForPath(relativePath, state);
      await saveState(folder, state);
      await materializeAndWrite(folder, state);
      refreshTreeView();
    })
  );

  // 4. Create Preset
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.createPreset', async (node?: TreeNode) => {
      const folders = checkWorkspace();
      if (!folders) return;

      let folder: vscode.WorkspaceFolder | undefined;
      if (node && 'workspaceFolder' in node) {
        folder = node.workspaceFolder;
      } else if (node && 'folder' in node) {
        folder = (node as { folder: vscode.WorkspaceFolder }).folder;
      } else {
        folder = await pickWorkspaceFolder(folders);
      }
      if (!folder) return;

      const name = await vscode.window.showInputBox({
        prompt: 'Enter a name for the new preset',
        placeHolder: 'Preset name',
      });
      if (!name) return;

      let state = loadState(folder);
      const result = createPreset(state, name);
      state = result.state;
      await saveState(folder, state);
      refreshTreeView();
    })
  );

  // 5. Rename Preset
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.renamePreset', async (node: { folder: vscode.WorkspaceFolder; preset: Preset }) => {
      if (!checkWorkspace()) return;

      const newName = await vscode.window.showInputBox({
        prompt: 'Enter a new name for the preset',
        value: node.preset.name,
      });
      if (!newName) return;

      let state = loadState(node.folder);
      state = renamePreset(state, node.preset.id, newName);
      await saveState(node.folder, state);
      refreshTreeView();
    })
  );

  // 6. Delete Preset
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.deletePreset', async (node: { folder: vscode.WorkspaceFolder; preset: Preset }) => {
      if (!checkWorkspace()) return;

      const answer = await vscode.window.showWarningMessage(
        `Delete preset '${node.preset.name}'?`,
        { modal: true },
        'Delete'
      );
      if (answer !== 'Delete') return;

      let state = loadState(node.folder);
      state = deletePreset(state, node.preset.id);
      await saveState(node.folder, state);
      await materializeAndWrite(node.folder, state);
      refreshTreeView();
    })
  );

  // 7. Enable Preset
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.enablePreset', async (node: { folder: vscode.WorkspaceFolder; preset: Preset }) => {
      if (!checkWorkspace()) return;

      let state = loadState(node.folder);
      state = enablePreset(state, node.preset.id);
      await saveState(node.folder, state);
      await materializeAndWrite(node.folder, state);
      refreshTreeView();
    })
  );

  // 8. Disable Preset
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.disablePreset', async (node: { folder: vscode.WorkspaceFolder; preset: Preset }) => {
      if (!checkWorkspace()) return;

      let state = loadState(node.folder);
      state = disablePreset(state, node.preset.id);
      await saveState(node.folder, state);
      await materializeAndWrite(node.folder, state);
      refreshTreeView();
    })
  );

  // 9. Switch to Preset
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.switchToPreset', async (node: { folder: vscode.WorkspaceFolder; preset: Preset }) => {
      if (!checkWorkspace()) return;

      let state = loadState(node.folder);
      state = switchToPreset(state, node.preset.id);
      await saveState(node.folder, state);
      await materializeAndWrite(node.folder, state);
      refreshTreeView();
    })
  );

  // 10. Add Glob Rule
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.addGlobRule', async (node: { folder: vscode.WorkspaceFolder; preset: Preset }) => {
      if (!checkWorkspace()) return;

      const pattern = await vscode.window.showInputBox({
        prompt: 'Enter a glob pattern to hide',
        placeHolder: '**/*.generated.ts',
      });
      if (!pattern) return;

      let state = loadState(node.folder);
      try {
        const rule = createGlobRule(pattern);
        state = addRuleToPreset(state, node.preset.id, rule);
      } catch (err) {
        vscode.window.showErrorMessage(`Invalid glob rule: ${(err as Error).message}`);
        return;
      }

      await saveState(node.folder, state);
      const updatedGlobPreset = state.presets.find(p => p.id === node.preset.id);
      if (updatedGlobPreset?.enabled) {
        await materializeAndWrite(node.folder, state);
      }
      refreshTreeView();
    })
  );

  // 11. Add Exact Rule
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.addExactRule', async (node: { folder: vscode.WorkspaceFolder; preset: Preset }) => {
      if (!checkWorkspace()) return;

      const path = await vscode.window.showInputBox({
        prompt: 'Enter a relative path to hide',
        placeHolder: 'src/generated/schema.ts',
      });
      if (!path) return;

      const typeChoice = await vscode.window.showQuickPick(
        [{ label: 'File' }, { label: 'Folder' }],
        { placeHolder: 'Is this a file or folder?' }
      );
      if (!typeChoice) return;

      let state = loadState(node.folder);
      const rule = typeChoice.label === 'Folder'
        ? createExactFolderRule(path)
        : createExactFileRule(path);

      try {
        state = addRuleToPreset(state, node.preset.id, rule);
      } catch (err) {
        vscode.window.showErrorMessage((err as Error).message);
        return;
      }

      await saveState(node.folder, state);
      const updatedExactPreset = state.presets.find(p => p.id === node.preset.id);
      if (updatedExactPreset?.enabled) {
        await materializeAndWrite(node.folder, state);
      }
      refreshTreeView();
    })
  );

  // 12. Remove Rule
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.removeRule', async (node: { folder: vscode.WorkspaceFolder; preset: Preset; ruleIndex: number }) => {
      if (!checkWorkspace()) return;

      let state = loadState(node.folder);
      state = removeRuleFromPreset(state, node.preset.id, node.ruleIndex);
      await saveState(node.folder, state);
      await materializeAndWrite(node.folder, state);
      refreshTreeView();
    })
  );

  // 13. Set Preset Extends
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.setPresetExtends', async (node: { folder: vscode.WorkspaceFolder; preset: Preset }) => {
      if (!checkWorkspace()) return;

      let state = loadState(node.folder);
      const otherPresets = state.presets.filter(p => p.id !== node.preset.id);
      if (otherPresets.length === 0) {
        vscode.window.showInformationMessage('No other presets available to extend.');
        return;
      }

      const currentExtends = new Set(node.preset.extends ?? []);
      const items = otherPresets.map(p => ({
        label: p.name,
        presetId: p.id,
        picked: currentExtends.has(p.id),
      }));

      const picks = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select presets to extend (inherit rules from)',
        canPickMany: true,
      });
      if (!picks) return;

      const parentIds = picks.map(p => p.presetId);
      try {
        state = setPresetExtends(state, node.preset.id, parentIds);
      } catch (err) {
        vscode.window.showErrorMessage((err as Error).message);
        return;
      }

      await saveState(node.folder, state);
      await materializeAndWrite(node.folder, state);
      refreshTreeView();
    })
  );

  // 14. Toggle Invert Mode
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.toggleInvert', async (node?: TreeNode) => {
      const folders = checkWorkspace();
      if (!folders) return;

      let folder: vscode.WorkspaceFolder | undefined;
      if (node && 'workspaceFolder' in node) {
        folder = node.workspaceFolder;
      } else if (node && 'folder' in node) {
        folder = (node as { folder: vscode.WorkspaceFolder }).folder;
      } else {
        folder = await pickWorkspaceFolder(folders);
      }
      if (!folder) return;

      let state = loadState(folder);
      state = { ...state, inverted: !state.inverted };
      await saveState(folder, state);
      await materializeAndWrite(folder, state);
      refreshTreeView();
    })
  );

  // 15. Rebuild files.exclude
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.rebuildFilesExclude', async () => {
      const folders = checkWorkspace();
      if (!folders) return;

      for (const folder of folders) {
        const state = loadState(folder);
        await materializeAndWrite(folder, state);
      }
      refreshTreeView();
    })
  );

  // 14. Restore files.exclude backup
  context.subscriptions.push(
    vscode.commands.registerCommand('explorerHidePresets.restoreFilesExcludeBackup', async () => {
      const folders = checkWorkspace();
      if (!folders) return;

      const folder = await pickWorkspaceFolder(folders);
      if (!folder) return;

      await restoreBackup(folder);
      refreshTreeView();
    })
  );
}
