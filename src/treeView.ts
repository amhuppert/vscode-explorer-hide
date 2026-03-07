import * as vscode from 'vscode';
import type { Rule, Preset, WorkspaceFolderState } from './types.js';
import { loadState } from './state.js';
import { getPresetById } from './presets.js';

export class FolderNode extends vscode.TreeItem {
  constructor(public readonly workspaceFolder: vscode.WorkspaceFolder) {
    super(workspaceFolder.name, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'workspaceFolder';
    this.iconPath = new vscode.ThemeIcon('root-folder');
  }
}

export class PresetNode extends vscode.TreeItem {
  constructor(
    public readonly preset: Preset,
    public readonly folder: vscode.WorkspaceFolder,
    state?: WorkspaceFolderState
  ) {
    super(preset.name, vscode.TreeItemCollapsibleState.Collapsed);

    const manualSuffix = preset.isManual ? '-manual' : '';
    const enabledPrefix = preset.enabled ? 'preset-enabled' : 'preset-disabled';
    this.contextValue = `${enabledPrefix}${manualSuffix}`;

    const descParts: string[] = [];
    if (preset.enabled) descParts.push('active');
    if (preset.extends && preset.extends.length > 0 && state) {
      const parentNames = preset.extends
        .map(id => getPresetById(state, id)?.name ?? id)
        .join(', ');
      descParts.push(`extends ${parentNames}`);
    }
    this.description = descParts.length > 0 ? descParts.join(' · ') : undefined;

    this.iconPath = preset.enabled
      ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'))
      : new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('disabledForeground'));

    let tooltip = `${preset.name} (${preset.enabled ? 'enabled' : 'disabled'}) - ${preset.rules.length} rules`;
    if (preset.extends && preset.extends.length > 0 && state) {
      const parentNames = preset.extends
        .map(id => getPresetById(state, id)?.name ?? id)
        .join(', ');
      tooltip += `\nExtends: ${parentNames}`;
    }
    this.tooltip = tooltip;
  }
}

export class RuleNode extends vscode.TreeItem {
  constructor(
    public readonly rule: Rule,
    public readonly preset: Preset,
    public readonly folder: vscode.WorkspaceFolder,
    public readonly ruleIndex: number
  ) {
    const label = rule.kind === 'glob' ? rule.pattern : rule.path;
    super(label, vscode.TreeItemCollapsibleState.None);

    this.contextValue = `rule-${rule.kind}`;

    switch (rule.kind) {
      case 'exactFile':
        this.iconPath = new vscode.ThemeIcon('file');
        break;
      case 'exactFolder':
        this.iconPath = new vscode.ThemeIcon('folder');
        break;
      case 'glob':
        this.iconPath = new vscode.ThemeIcon('regex');
        break;
    }
  }
}

export class InvertStatusNode extends vscode.TreeItem {
  constructor(
    public readonly inverted: boolean,
    public readonly folder: vscode.WorkspaceFolder
  ) {
    super(
      inverted ? 'Mode: Show Only Matching' : 'Mode: Hide Matching',
      vscode.TreeItemCollapsibleState.None
    );
    this.contextValue = inverted ? 'invertStatus-on' : 'invertStatus-off';
    this.iconPath = inverted
      ? new vscode.ThemeIcon('filter-filled', new vscode.ThemeColor('charts.yellow'))
      : new vscode.ThemeIcon('filter');
    this.tooltip = inverted
      ? 'Inverted: rules define what to SHOW (click to switch back)'
      : 'Normal: rules define what to HIDE (click to invert)';
    this.command = {
      command: 'explorerHidePresets.toggleInvert',
      title: 'Toggle Invert',
      arguments: [this],
    };
  }
}

export class HidePresetsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      const folders = vscode.workspace.workspaceFolders ?? [];
      if (folders.length === 0) return [];
      if (folders.length === 1) {
        return this.getItemsForFolder(folders[0]);
      }
      return folders.map(f => new FolderNode(f));
    }

    if (element instanceof FolderNode) {
      return this.getItemsForFolder(element.workspaceFolder);
    }

    if (element instanceof PresetNode) {
      return element.preset.rules.map(
        (rule, index) => new RuleNode(rule, element.preset, element.folder, index)
      );
    }

    return [];
  }

  private getItemsForFolder(folder: vscode.WorkspaceFolder): vscode.TreeItem[] {
    const state = loadState(folder);
    const items: vscode.TreeItem[] = [];
    items.push(new InvertStatusNode(!!state.inverted, folder));
    items.push(...state.presets.map(p => new PresetNode(p, folder, state)));
    return items;
  }
}

export function createTreeView(provider: HidePresetsTreeProvider): vscode.TreeView<vscode.TreeItem> {
  return vscode.window.createTreeView('explorerHidePresetsView', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
}
