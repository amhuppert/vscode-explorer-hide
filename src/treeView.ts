import * as vscode from 'vscode';
import type { Rule, Preset } from './types.js';
import { loadState } from './state.js';

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
    public readonly folder: vscode.WorkspaceFolder
  ) {
    super(preset.name, vscode.TreeItemCollapsibleState.Collapsed);

    const manualSuffix = preset.isManual ? '-manual' : '';
    const enabledPrefix = preset.enabled ? 'preset-enabled' : 'preset-disabled';
    this.contextValue = `${enabledPrefix}${manualSuffix}`;

    this.description = preset.enabled ? 'active' : undefined;
    this.iconPath = preset.enabled
      ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'))
      : new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('disabledForeground'));
    this.tooltip = `${preset.name} (${preset.enabled ? 'enabled' : 'disabled'}) - ${preset.rules.length} rules`;
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
        return this.getPresetsForFolder(folders[0]);
      }
      return folders.map(f => new FolderNode(f));
    }

    if (element instanceof FolderNode) {
      return this.getPresetsForFolder(element.workspaceFolder);
    }

    if (element instanceof PresetNode) {
      return element.preset.rules.map(
        (rule, index) => new RuleNode(rule, element.preset, element.folder, index)
      );
    }

    return [];
  }

  private getPresetsForFolder(folder: vscode.WorkspaceFolder): PresetNode[] {
    const state = loadState(folder);
    return state.presets.map(p => new PresetNode(p, folder));
  }
}

export function createTreeView(provider: HidePresetsTreeProvider): vscode.TreeView<vscode.TreeItem> {
  return vscode.window.createTreeView('explorerHidePresetsView', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
}
