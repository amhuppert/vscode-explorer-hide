import * as vscode from 'vscode';
import type { WorkspaceFolderState, Preset } from './types.js';
import { ensureManualPreset } from './presets.js';

export function loadState(folder: vscode.WorkspaceFolder): WorkspaceFolderState {
  const config = vscode.workspace.getConfiguration('explorerHidePresets', folder.uri);
  const presets = config.get<Preset[]>('presets', []);
  const backup = config.get<Record<string, boolean> | undefined>('filesExcludeBackup', undefined);
  let state: WorkspaceFolderState = { presets };
  if (backup !== undefined) {
    state.backup = backup;
  }
  state = ensureManualPreset(state);
  return state;
}

export async function saveState(
  folder: vscode.WorkspaceFolder,
  state: WorkspaceFolderState
): Promise<void> {
  const config = vscode.workspace.getConfiguration('explorerHidePresets', folder.uri);
  await config.update('presets', state.presets, vscode.ConfigurationTarget.WorkspaceFolder);
  if (state.backup !== undefined) {
    await config.update('filesExcludeBackup', state.backup, vscode.ConfigurationTarget.WorkspaceFolder);
  }
}

export async function backupExistingFilesExclude(
  folder: vscode.WorkspaceFolder
): Promise<void> {
  const config = vscode.workspace.getConfiguration('explorerHidePresets', folder.uri);
  const existingBackup = config.get<Record<string, boolean> | undefined>('filesExcludeBackup', undefined);
  if (existingBackup !== undefined) {
    return; // don't overwrite previous backup
  }

  const filesConfig = vscode.workspace.getConfiguration('files', folder.uri);
  const inspected = filesConfig.inspect<Record<string, boolean>>('exclude');
  const folderValue = inspected?.workspaceFolderValue;
  if (folderValue && Object.keys(folderValue).length > 0) {
    await config.update('filesExcludeBackup', folderValue, vscode.ConfigurationTarget.WorkspaceFolder);
  }
}

export function getBackup(
  folder: vscode.WorkspaceFolder
): Record<string, boolean> | undefined {
  const config = vscode.workspace.getConfiguration('explorerHidePresets', folder.uri);
  return config.get<Record<string, boolean> | undefined>('filesExcludeBackup', undefined);
}

export async function restoreBackup(
  folder: vscode.WorkspaceFolder
): Promise<void> {
  const backup = getBackup(folder);
  if (backup) {
    await writeFilesExclude(folder, backup);
  } else {
    vscode.window.showInformationMessage('No files.exclude backup found for this folder.');
  }
}

export async function writeFilesExclude(
  folder: vscode.WorkspaceFolder,
  excludeMap: Record<string, boolean>
): Promise<void> {
  const filesConfig = vscode.workspace.getConfiguration('files', folder.uri);
  await filesConfig.update('exclude', excludeMap, vscode.ConfigurationTarget.WorkspaceFolder);
}

export function getWorkspaceFolderForUri(
  uri: vscode.Uri
): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.getWorkspaceFolder(uri);
}
