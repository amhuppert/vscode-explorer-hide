import type { WorkspaceFolderState } from './types.js';

export function isHiddenByOwnedExactRule(
  relativePath: string,
  state: WorkspaceFolderState
): boolean {
  for (const preset of state.presets) {
    for (const rule of preset.rules) {
      if (rule.kind === 'exactFile' && rule.path === relativePath) return true;
      if (rule.kind === 'exactFolder' && rule.path === relativePath) return true;
    }
  }
  return false;
}

export function findExactRulesForPath(
  relativePath: string,
  state: WorkspaceFolderState
): Array<{ presetId: string; ruleIndex: number }> {
  const matches: Array<{ presetId: string; ruleIndex: number }> = [];
  for (const preset of state.presets) {
    for (let i = 0; i < preset.rules.length; i++) {
      const rule = preset.rules[i];
      if (
        (rule.kind === 'exactFile' || rule.kind === 'exactFolder') &&
        rule.path === relativePath
      ) {
        matches.push({ presetId: preset.id, ruleIndex: i });
      }
    }
  }
  return matches;
}

export function removeExactRulesForPath(
  relativePath: string,
  state: WorkspaceFolderState
): WorkspaceFolderState {
  return {
    ...state,
    presets: state.presets.map(preset => ({
      ...preset,
      rules: preset.rules.filter(rule => {
        if (rule.kind === 'exactFile' || rule.kind === 'exactFolder') {
          return rule.path !== relativePath;
        }
        return true; // keep glob rules
      }),
    })),
  };
}
