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
