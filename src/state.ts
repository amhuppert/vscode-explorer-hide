import * as vscode from 'vscode';
import type { WorkspaceFolderState } from './types.js';
import { ensureManualPreset } from './presets.js';
import { serializeState, deserializeState } from './serialization.js';

const STATE_FILE_NAME = 'explorer-hide-presets.json';

function getStateFileUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(folder.uri, '.vscode', STATE_FILE_NAME);
}

export async function loadState(folder: vscode.WorkspaceFolder): Promise<WorkspaceFolderState> {
  const uri = getStateFileUri(folder);
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(bytes).toString('utf8');
    let state = deserializeState(content);
    state = ensureManualPreset(state);
    return state;
  } catch {
    // File doesn't exist or can't be read — return default state
    return ensureManualPreset({ presets: [] });
  }
}

export async function saveState(
  folder: vscode.WorkspaceFolder,
  state: WorkspaceFolderState
): Promise<void> {
  const uri = getStateFileUri(folder);
  // Ensure .vscode directory exists
  const vscodeDirUri = vscode.Uri.joinPath(folder.uri, '.vscode');
  try {
    await vscode.workspace.fs.createDirectory(vscodeDirUri);
  } catch {
    // Directory likely already exists
  }
  const content = serializeState(state);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

export async function backupExistingFilesExclude(
  folder: vscode.WorkspaceFolder
): Promise<void> {
  const state = await loadState(folder);
  if (state.backup !== undefined) {
    return; // don't overwrite previous backup
  }

  const filesConfig = vscode.workspace.getConfiguration('files', folder.uri);
  const inspected = filesConfig.inspect<Record<string, boolean>>('exclude');
  const folderValue = inspected?.workspaceFolderValue;
  if (folderValue && Object.keys(folderValue).length > 0) {
    await saveState(folder, { ...state, backup: folderValue });
  }
}

export async function getBackup(
  folder: vscode.WorkspaceFolder
): Promise<Record<string, boolean> | undefined> {
  const state = await loadState(folder);
  return state.backup;
}

export async function restoreBackup(
  folder: vscode.WorkspaceFolder
): Promise<void> {
  const backup = await getBackup(folder);
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

export async function listWorkspaceRootEntries(
  folder: vscode.WorkspaceFolder
): Promise<string[]> {
  const entries = await vscode.workspace.fs.readDirectory(folder.uri);
  return entries.map(([name, type]) => {
    const isDir = (type & vscode.FileType.Directory) !== 0;
    return isDir ? `${name}/` : name;
  });
}

/**
 * Migrate state from old settings.json configuration to the dedicated state file.
 * Returns true if migration occurred.
 */
export async function migrateFromSettings(
  folder: vscode.WorkspaceFolder
): Promise<boolean> {
  // Check if state file already exists
  const uri = getStateFileUri(folder);
  try {
    await vscode.workspace.fs.stat(uri);
    return false; // File exists, no migration needed
  } catch {
    // File doesn't exist, check for old settings
  }

  const config = vscode.workspace.getConfiguration('explorerHidePresets', folder.uri);
  const presets = config.get<import('./types.js').Preset[]>('presets', []);
  if (presets.length === 0) {
    return false; // No old data to migrate
  }

  const backup = config.get<Record<string, boolean> | undefined>('filesExcludeBackup', undefined);
  const inverted = config.get<boolean>('inverted', false);

  const state: WorkspaceFolderState = { presets };
  if (backup !== undefined) {
    state.backup = backup;
  }
  if (inverted) {
    state.inverted = true;
  }

  await saveState(folder, state);

  // Clear old settings
  await config.update('presets', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
  await config.update('filesExcludeBackup', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
  await config.update('inverted', undefined, vscode.ConfigurationTarget.WorkspaceFolder);

  return true;
}
