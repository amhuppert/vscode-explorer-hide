import type { WorkspaceFolderState, Preset, Rule } from './types.js';
import { MANUAL_PRESET_ID } from './types.js';
import { isDuplicateRule } from './normalization.js';

export function ensureManualPreset(state: WorkspaceFolderState): WorkspaceFolderState {
  if (state.presets.some(p => p.id === MANUAL_PRESET_ID)) {
    return state;
  }
  return {
    ...state,
    presets: [
      ...state.presets,
      {
        id: MANUAL_PRESET_ID,
        name: 'Manual',
        isManual: true,
        enabled: true,
        rules: [],
      },
    ],
  };
}

export function createPreset(
  state: WorkspaceFolderState,
  name: string
): { state: WorkspaceFolderState; presetId: string } {
  const presetId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const newPreset: Preset = {
    id: presetId,
    name,
    isManual: false,
    enabled: false,
    rules: [],
  };
  return {
    state: { ...state, presets: [...state.presets, newPreset] },
    presetId,
  };
}

export function deletePreset(state: WorkspaceFolderState, presetId: string): WorkspaceFolderState {
  if (presetId === MANUAL_PRESET_ID) {
    throw new Error('Cannot delete the Manual preset');
  }
  if (!state.presets.some(p => p.id === presetId)) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  return { ...state, presets: state.presets.filter(p => p.id !== presetId) };
}

export function renamePreset(
  state: WorkspaceFolderState,
  presetId: string,
  newName: string
): WorkspaceFolderState {
  if (presetId === MANUAL_PRESET_ID) {
    throw new Error('Cannot rename the Manual preset');
  }
  if (!state.presets.some(p => p.id === presetId)) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  return {
    ...state,
    presets: state.presets.map(p =>
      p.id === presetId ? { ...p, name: newName } : p
    ),
  };
}

export function enablePreset(state: WorkspaceFolderState, presetId: string): WorkspaceFolderState {
  if (!state.presets.some(p => p.id === presetId)) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  return {
    ...state,
    presets: state.presets.map(p =>
      p.id === presetId ? { ...p, enabled: true } : p
    ),
  };
}

export function disablePreset(state: WorkspaceFolderState, presetId: string): WorkspaceFolderState {
  if (!state.presets.some(p => p.id === presetId)) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  return {
    ...state,
    presets: state.presets.map(p =>
      p.id === presetId ? { ...p, enabled: false } : p
    ),
  };
}

export function switchToPreset(state: WorkspaceFolderState, presetId: string): WorkspaceFolderState {
  if (!state.presets.some(p => p.id === presetId)) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  return {
    ...state,
    presets: state.presets.map(p => ({
      ...p,
      enabled: p.id === presetId,
    })),
  };
}

export function addRuleToPreset(
  state: WorkspaceFolderState,
  presetId: string,
  rule: Rule
): WorkspaceFolderState {
  const preset = state.presets.find(p => p.id === presetId);
  if (!preset) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  if (isDuplicateRule(rule, preset.rules)) {
    throw new Error('Rule already exists in this preset');
  }
  return {
    ...state,
    presets: state.presets.map(p =>
      p.id === presetId ? { ...p, rules: [...p.rules, rule] } : p
    ),
  };
}

export function addRulesToPreset(
  state: WorkspaceFolderState,
  presetId: string,
  rules: Rule[]
): { state: WorkspaceFolderState; added: number } {
  const preset = state.presets.find(p => p.id === presetId);
  if (!preset) {
    throw new Error(`Preset not found: ${presetId}`);
  }

  const newRules: Rule[] = [];
  const combined = [...preset.rules];
  for (const rule of rules) {
    if (!isDuplicateRule(rule, combined)) {
      combined.push(rule);
      newRules.push(rule);
    }
  }

  return {
    state: {
      ...state,
      presets: state.presets.map(p =>
        p.id === presetId ? { ...p, rules: [...p.rules, ...newRules] } : p
      ),
    },
    added: newRules.length,
  };
}

export function removeRuleFromPreset(
  state: WorkspaceFolderState,
  presetId: string,
  ruleIndex: number
): WorkspaceFolderState {
  const preset = state.presets.find(p => p.id === presetId);
  if (!preset) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  if (ruleIndex < 0 || ruleIndex >= preset.rules.length) {
    throw new Error(`Rule index out of bounds: ${ruleIndex}`);
  }
  return {
    ...state,
    presets: state.presets.map(p =>
      p.id === presetId
        ? { ...p, rules: p.rules.filter((_, i) => i !== ruleIndex) }
        : p
    ),
  };
}

export function getPresetById(
  state: WorkspaceFolderState,
  presetId: string
): Preset | undefined {
  return state.presets.find(p => p.id === presetId);
}

export function setPresetExtends(
  state: WorkspaceFolderState,
  presetId: string,
  parentIds: string[]
): WorkspaceFolderState {
  if (!state.presets.some(p => p.id === presetId)) {
    throw new Error(`Preset not found: ${presetId}`);
  }

  // Validate: apply the change tentatively and check for cycles
  const tentative: WorkspaceFolderState = {
    ...state,
    presets: state.presets.map(p =>
      p.id === presetId ? { ...p, extends: parentIds } : p
    ),
  };

  // Attempt to resolve — will throw on cycle
  resolvePresetRules(tentative, presetId);

  return tentative;
}

export function resolvePresetRules(
  state: WorkspaceFolderState,
  presetId: string,
  ancestorPath: Set<string> = new Set()
): Rule[] {
  const preset = state.presets.find(p => p.id === presetId);
  if (!preset) {
    if (ancestorPath.size > 0) {
      // Called from recursion — parent references a non-existent preset, skip silently
      return [];
    }
    throw new Error(`Preset not found: ${presetId}`);
  }

  if (ancestorPath.has(presetId)) {
    throw new Error(`Cycle detected in preset inheritance: ${presetId}`);
  }
  const childPath = new Set(ancestorPath);
  childPath.add(presetId);

  const inheritedRules: Rule[] = [];
  if (preset.extends && preset.extends.length > 0) {
    for (const parentId of preset.extends) {
      const parentRules = resolvePresetRules(state, parentId, childPath);
      for (const rule of parentRules) {
        if (!isDuplicateRule(rule, inheritedRules)) {
          inheritedRules.push(rule);
        }
      }
    }
  }

  // Add own rules, deduplicating against inherited
  const combined = [...inheritedRules];
  for (const rule of preset.rules) {
    if (!isDuplicateRule(rule, combined)) {
      combined.push(rule);
    }
  }

  return combined;
}
