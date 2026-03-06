import type { Rule, WorkspaceFolderState } from './types.js';

export function ruleToExcludeKey(rule: Rule): string {
  switch (rule.kind) {
    case 'exactFile':
    case 'exactFolder':
      return rule.path;
    case 'glob':
      return rule.pattern;
  }
}

export function materializeActiveRules(state: WorkspaceFolderState): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const preset of state.presets) {
    if (!preset.enabled) continue;
    for (const rule of preset.rules) {
      result[ruleToExcludeKey(rule)] = true;
    }
  }
  return result;
}
