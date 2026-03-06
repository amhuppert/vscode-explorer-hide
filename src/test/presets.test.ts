import { describe, expect, test } from 'bun:test';
import {
  ensureManualPreset,
  createPreset,
  deletePreset,
  renamePreset,
  enablePreset,
  disablePreset,
  switchToPreset,
  addRuleToPreset,
  addRulesToPreset,
  removeRuleFromPreset,
  getPresetById,
} from '../presets.js';
import { MANUAL_PRESET_ID } from '../types.js';
import type { WorkspaceFolderState, Preset } from '../types.js';

function emptyState(): WorkspaceFolderState {
  return { presets: [] };
}

function stateWithManual(): WorkspaceFolderState {
  return ensureManualPreset(emptyState());
}

describe('ensureManualPreset', () => {
  test('adds Manual preset to empty state', () => {
    const state = ensureManualPreset(emptyState());
    expect(state.presets).toHaveLength(1);
    expect(state.presets[0].id).toBe(MANUAL_PRESET_ID);
    expect(state.presets[0].name).toBe('Manual');
    expect(state.presets[0].isManual).toBe(true);
    expect(state.presets[0].enabled).toBe(true);
  });

  test('does not duplicate Manual preset if already exists', () => {
    const state = stateWithManual();
    const result = ensureManualPreset(state);
    expect(result.presets).toHaveLength(1);
  });

  test('returns same state if Manual exists', () => {
    const state = stateWithManual();
    const result = ensureManualPreset(state);
    expect(result).toBe(state);
  });
});

describe('createPreset', () => {
  test('adds a new preset with unique ID', () => {
    const state = stateWithManual();
    const { state: newState, presetId } = createPreset(state, 'My Preset');
    expect(newState.presets).toHaveLength(2);
    const created = newState.presets.find(p => p.id === presetId);
    expect(created).toBeDefined();
    expect(created!.name).toBe('My Preset');
    expect(created!.isManual).toBe(false);
    expect(created!.enabled).toBe(false);
    expect(created!.rules).toEqual([]);
  });

  test('returns new state object (immutability)', () => {
    const state = stateWithManual();
    const { state: newState } = createPreset(state, 'Test');
    expect(newState).not.toBe(state);
    expect(state.presets).toHaveLength(1); // original unchanged
  });
});

describe('deletePreset', () => {
  test('removes a normal preset', () => {
    const state = stateWithManual();
    const { state: withPreset, presetId } = createPreset(state, 'Temp');
    const result = deletePreset(withPreset, presetId);
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0].id).toBe(MANUAL_PRESET_ID);
  });

  test('throws when trying to delete Manual preset', () => {
    const state = stateWithManual();
    expect(() => deletePreset(state, MANUAL_PRESET_ID)).toThrow('Cannot delete the Manual preset');
  });

  test('throws when preset not found', () => {
    const state = stateWithManual();
    expect(() => deletePreset(state, 'nonexistent')).toThrow();
  });
});

describe('renamePreset', () => {
  test('renames a normal preset', () => {
    const state = stateWithManual();
    const { state: withPreset, presetId } = createPreset(state, 'Old Name');
    const result = renamePreset(withPreset, presetId, 'New Name');
    const preset = result.presets.find(p => p.id === presetId);
    expect(preset!.name).toBe('New Name');
  });

  test('throws when trying to rename Manual preset', () => {
    const state = stateWithManual();
    expect(() => renamePreset(state, MANUAL_PRESET_ID, 'Something')).toThrow('Cannot rename the Manual preset');
  });

  test('throws when preset not found', () => {
    const state = stateWithManual();
    expect(() => renamePreset(state, 'nonexistent', 'Name')).toThrow();
  });
});

describe('enablePreset', () => {
  test('enables a disabled preset', () => {
    const state = stateWithManual();
    const { state: withPreset, presetId } = createPreset(state, 'Test');
    expect(getPresetById(withPreset, presetId)!.enabled).toBe(false);
    const result = enablePreset(withPreset, presetId);
    expect(getPresetById(result, presetId)!.enabled).toBe(true);
  });

  test('throws when preset not found', () => {
    const state = stateWithManual();
    expect(() => enablePreset(state, 'nonexistent')).toThrow();
  });
});

describe('disablePreset', () => {
  test('disables an enabled preset', () => {
    const state = stateWithManual();
    expect(getPresetById(state, MANUAL_PRESET_ID)!.enabled).toBe(true);
    const result = disablePreset(state, MANUAL_PRESET_ID);
    expect(getPresetById(result, MANUAL_PRESET_ID)!.enabled).toBe(false);
  });

  test('throws when preset not found', () => {
    const state = stateWithManual();
    expect(() => disablePreset(state, 'nonexistent')).toThrow();
  });
});

describe('switchToPreset', () => {
  test('enables target and disables all others', () => {
    let state = stateWithManual();
    const { state: s2, presetId: id1 } = createPreset(state, 'P1');
    const { state: s3, presetId: id2 } = createPreset(s2, 'P2');
    // Enable all first
    let s4 = enablePreset(s3, id1);
    s4 = enablePreset(s4, id2);
    // Switch to id1
    const result = switchToPreset(s4, id1);
    expect(getPresetById(result, id1)!.enabled).toBe(true);
    expect(getPresetById(result, id2)!.enabled).toBe(false);
    expect(getPresetById(result, MANUAL_PRESET_ID)!.enabled).toBe(false);
  });

  test('throws when preset not found', () => {
    const state = stateWithManual();
    expect(() => switchToPreset(state, 'nonexistent')).toThrow();
  });
});

describe('addRuleToPreset', () => {
  test('adds a rule to a preset', () => {
    const state = stateWithManual();
    const rule = { kind: 'exactFile' as const, path: 'src/foo.ts' };
    const result = addRuleToPreset(state, MANUAL_PRESET_ID, rule);
    expect(getPresetById(result, MANUAL_PRESET_ID)!.rules).toHaveLength(1);
    expect(getPresetById(result, MANUAL_PRESET_ID)!.rules[0]).toEqual(rule);
  });

  test('throws on duplicate rule', () => {
    const state = stateWithManual();
    const rule = { kind: 'exactFile' as const, path: 'src/foo.ts' };
    const s2 = addRuleToPreset(state, MANUAL_PRESET_ID, rule);
    expect(() => addRuleToPreset(s2, MANUAL_PRESET_ID, rule)).toThrow('Rule already exists');
  });

  test('throws when preset not found', () => {
    const state = stateWithManual();
    const rule = { kind: 'exactFile' as const, path: 'src/foo.ts' };
    expect(() => addRuleToPreset(state, 'nonexistent', rule)).toThrow();
  });

  test('returns new state object (immutability)', () => {
    const state = stateWithManual();
    const rule = { kind: 'exactFile' as const, path: 'src/foo.ts' };
    const result = addRuleToPreset(state, MANUAL_PRESET_ID, rule);
    expect(result).not.toBe(state);
    expect(getPresetById(state, MANUAL_PRESET_ID)!.rules).toHaveLength(0);
  });
});

describe('removeRuleFromPreset', () => {
  test('removes a rule by index', () => {
    const state = stateWithManual();
    const rule1 = { kind: 'exactFile' as const, path: 'src/a.ts' };
    const rule2 = { kind: 'exactFile' as const, path: 'src/b.ts' };
    let s = addRuleToPreset(state, MANUAL_PRESET_ID, rule1);
    s = addRuleToPreset(s, MANUAL_PRESET_ID, rule2);
    const result = removeRuleFromPreset(s, MANUAL_PRESET_ID, 0);
    const rules = getPresetById(result, MANUAL_PRESET_ID)!.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual(rule2);
  });

  test('throws on out-of-bounds index', () => {
    const state = stateWithManual();
    expect(() => removeRuleFromPreset(state, MANUAL_PRESET_ID, 0)).toThrow();
  });

  test('throws when preset not found', () => {
    const state = stateWithManual();
    expect(() => removeRuleFromPreset(state, 'nonexistent', 0)).toThrow();
  });
});

describe('addRulesToPreset', () => {
  test('adds multiple rules to a preset', () => {
    const state = stateWithManual();
    const rules = [
      { kind: 'exactFile' as const, path: 'src/a.ts' },
      { kind: 'exactFile' as const, path: 'src/b.ts' },
      { kind: 'exactFolder' as const, path: 'dist/' },
    ];
    const { state: result, added } = addRulesToPreset(state, MANUAL_PRESET_ID, rules);
    expect(getPresetById(result, MANUAL_PRESET_ID)!.rules).toHaveLength(3);
    expect(added).toBe(3);
  });

  test('skips duplicate rules already in preset', () => {
    let state = stateWithManual();
    const existingRule = { kind: 'exactFile' as const, path: 'src/a.ts' };
    state = addRuleToPreset(state, MANUAL_PRESET_ID, existingRule);

    const rules = [
      { kind: 'exactFile' as const, path: 'src/a.ts' }, // duplicate
      { kind: 'exactFile' as const, path: 'src/b.ts' }, // new
    ];
    const { state: result, added } = addRulesToPreset(state, MANUAL_PRESET_ID, rules);
    expect(getPresetById(result, MANUAL_PRESET_ID)!.rules).toHaveLength(2);
    expect(added).toBe(1);
  });

  test('skips duplicates within the batch itself', () => {
    const state = stateWithManual();
    const rules = [
      { kind: 'exactFile' as const, path: 'src/a.ts' },
      { kind: 'exactFile' as const, path: 'src/a.ts' }, // duplicate within batch
    ];
    const { state: result, added } = addRulesToPreset(state, MANUAL_PRESET_ID, rules);
    expect(getPresetById(result, MANUAL_PRESET_ID)!.rules).toHaveLength(1);
    expect(added).toBe(1);
  });

  test('returns added=0 when all rules are duplicates', () => {
    let state = stateWithManual();
    const rule = { kind: 'exactFile' as const, path: 'src/a.ts' };
    state = addRuleToPreset(state, MANUAL_PRESET_ID, rule);

    const rules = [{ kind: 'exactFile' as const, path: 'src/a.ts' }];
    const { state: result, added } = addRulesToPreset(state, MANUAL_PRESET_ID, rules);
    expect(getPresetById(result, MANUAL_PRESET_ID)!.rules).toHaveLength(1);
    expect(added).toBe(0);
  });

  test('throws when preset not found', () => {
    const state = stateWithManual();
    const rules = [{ kind: 'exactFile' as const, path: 'src/a.ts' }];
    expect(() => addRulesToPreset(state, 'nonexistent', rules)).toThrow();
  });

  test('returns new state object (immutability)', () => {
    const state = stateWithManual();
    const rules = [{ kind: 'exactFile' as const, path: 'src/a.ts' }];
    const { state: result } = addRulesToPreset(state, MANUAL_PRESET_ID, rules);
    expect(result).not.toBe(state);
    expect(getPresetById(state, MANUAL_PRESET_ID)!.rules).toHaveLength(0);
  });
});

describe('getPresetById', () => {
  test('finds existing preset', () => {
    const state = stateWithManual();
    expect(getPresetById(state, MANUAL_PRESET_ID)).toBeDefined();
  });

  test('returns undefined for nonexistent preset', () => {
    const state = stateWithManual();
    expect(getPresetById(state, 'nope')).toBeUndefined();
  });
});
