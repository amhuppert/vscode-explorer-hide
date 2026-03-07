import * as vscode from 'vscode';
import { HidePresetsTreeProvider, createTreeView } from './treeView.js';
import { registerCommands } from './commands.js';
import { loadState, saveState, backupExistingFilesExclude, writeFilesExclude, listWorkspaceRootEntries } from './state.js';
import { ensureManualPreset } from './presets.js';
import { materializeActiveRules, materializeInvertedRules } from './materialization.js';

export function activate(context: vscode.ExtensionContext) {
  const treeProvider = new HidePresetsTreeProvider();
  const treeView = createTreeView(treeProvider);
  context.subscriptions.push(treeView);

  registerCommands(context, () => treeProvider.refresh());

  initializeAllFolders();

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      treeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('explorerHidePresets')) {
        treeProvider.refresh();
      }
    })
  );
}

async function initializeAllFolders(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;

  for (const folder of folders) {
    try {
      await backupExistingFilesExclude(folder);

      let state = loadState(folder);
      state = ensureManualPreset(state);
      await saveState(folder, state);

      let excludeMap: Record<string, boolean>;
      if (state.inverted) {
        const entries = await listWorkspaceRootEntries(folder);
        excludeMap = materializeInvertedRules(state, entries);
      } else {
        excludeMap = materializeActiveRules(state);
      }
      await writeFilesExclude(folder, excludeMap);
    } catch (err) {
      console.error(`Explorer Hide Presets: Failed to initialize for ${folder.name}:`, err);
    }
  }
}

export function deactivate() {}
