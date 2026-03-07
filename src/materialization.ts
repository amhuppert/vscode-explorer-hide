import type { Rule, WorkspaceFolderState } from './types.js';
import { resolvePresetRules } from './presets.js';

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
    const rules = resolvePresetRules(state, preset.id);
    for (const rule of rules) {
      result[ruleToExcludeKey(rule)] = true;
    }
  }
  return result;
}

/**
 * Inverted materialization: rules define what to SHOW.
 * Returns files.exclude map that hides all workspace entries NOT matching any rule.
 * @param state - workspace folder state
 * @param workspaceEntries - top-level entries in the workspace root (relative paths;
 *   folders should have trailing slash)
 */
export function materializeInvertedRules(
  state: WorkspaceFolderState,
  workspaceEntries: string[]
): Record<string, boolean> {
  // Collect all resolved rules from enabled presets
  const allRules: Rule[] = [];
  for (const preset of state.presets) {
    if (!preset.enabled) continue;
    const rules = resolvePresetRules(state, preset.id);
    for (const rule of rules) {
      if (!allRules.some(r => ruleToExcludeKey(r) === ruleToExcludeKey(rule))) {
        allRules.push(rule);
      }
    }
  }

  const result: Record<string, boolean> = {};
  for (const entry of workspaceEntries) {
    if (!entryMatchesAnyRule(entry, allRules)) {
      result[entry] = true;
    }
  }
  return result;
}

function entryMatchesAnyRule(entry: string, rules: Rule[]): boolean {
  for (const rule of rules) {
    if (entryMatchesRule(entry, rule)) return true;
  }
  return false;
}

function entryMatchesRule(entry: string, rule: Rule): boolean {
  switch (rule.kind) {
    case 'exactFile':
    case 'exactFolder': {
      // Direct match
      if (entry === rule.path) return true;
      // Entry is a parent directory of the ruled path
      // e.g., entry = "src/" and rule.path = "src/utils/helper.ts"
      if (entry.endsWith('/') && rule.path.startsWith(entry)) return true;
      return false;
    }
    case 'glob': {
      return entryMatchesGlob(entry, rule.pattern);
    }
  }
}

function entryMatchesGlob(entry: string, pattern: string): boolean {
  // If pattern starts with ** it can match in any directory — keep all entries
  if (pattern.startsWith('**')) return true;
  // If pattern starts with * (but not **), it matches at root level — keep all entries
  if (pattern.startsWith('*')) return true;

  // Extract the leading literal path prefix (first path segment before any wildcard)
  const firstWild = Math.min(
    pattern.indexOf('*') === -1 ? Infinity : pattern.indexOf('*'),
    pattern.indexOf('?') === -1 ? Infinity : pattern.indexOf('?'),
    pattern.indexOf('[') === -1 ? Infinity : pattern.indexOf('['),
    pattern.indexOf('{') === -1 ? Infinity : pattern.indexOf('{')
  );
  const literalPrefix = pattern.slice(0, firstWild);
  // Get the first path segment
  const firstSlash = literalPrefix.indexOf('/');
  const rootSegment = firstSlash === -1 ? literalPrefix : literalPrefix.slice(0, firstSlash + 1);

  // Entry matches if it starts with the root segment
  if (entry === rootSegment) return true;
  if (entry.startsWith(rootSegment) || rootSegment.startsWith(entry)) return true;

  return false;
}
