export interface ExactFileRule {
  kind: 'exactFile';
  path: string; // workspace-folder-relative, no trailing slash
}

export interface ExactFolderRule {
  kind: 'exactFolder';
  path: string; // workspace-folder-relative, WITH trailing slash
}

export interface GlobRule {
  kind: 'glob';
  pattern: string;
}

export type Rule = ExactFileRule | ExactFolderRule | GlobRule;

export interface Preset {
  id: string;
  name: string;
  isManual: boolean;
  enabled: boolean;
  rules: Rule[];
  extends?: string[]; // IDs of presets this preset inherits rules from
}

export interface WorkspaceFolderState {
  presets: Preset[];
  backup?: Record<string, boolean>;
  inverted?: boolean; // when true, rules define what to SHOW (hide everything else)
}

export const MANUAL_PRESET_ID = 'manual';
