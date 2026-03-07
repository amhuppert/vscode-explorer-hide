import { describe, expect, test } from 'bun:test';
import { resolvePresetRules, setPresetExtends, getPresetById } from '../presets.js';
import { MANUAL_PRESET_ID } from '../types.js';
import type { WorkspaceFolderState, Preset } from '../types.js';

function makePreset(overrides: Partial<Preset> & { id: string }): Preset {
  return {
    name: overrides.id,
    isManual: false,
    enabled: true,
    rules: [],
    ...overrides,
  };
}

function makeState(presets: Preset[]): WorkspaceFolderState {
  return { presets };
}

describe('resolvePresetRules', () => {
  test('returns own rules when preset has no extends', () => {
    const state = makeState([
      makePreset({
        id: 'p1',
        rules: [{ kind: 'exactFile', path: 'a.ts' }],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'p1');
    expect(resolved).toEqual([{ kind: 'exactFile', path: 'a.ts' }]);
  });

  test('includes rules from extended preset', () => {
    const state = makeState([
      makePreset({
        id: 'parent',
        rules: [{ kind: 'exactFile', path: 'parent.ts' }],
      }),
      makePreset({
        id: 'child',
        extends: ['parent'],
        rules: [{ kind: 'exactFile', path: 'child.ts' }],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'child');
    expect(resolved).toContainEqual({ kind: 'exactFile', path: 'parent.ts' });
    expect(resolved).toContainEqual({ kind: 'exactFile', path: 'child.ts' });
  });

  test('inherited rules come before own rules', () => {
    const state = makeState([
      makePreset({
        id: 'parent',
        rules: [{ kind: 'exactFile', path: 'parent.ts' }],
      }),
      makePreset({
        id: 'child',
        extends: ['parent'],
        rules: [{ kind: 'exactFile', path: 'child.ts' }],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'child');
    expect(resolved).toEqual([
      { kind: 'exactFile', path: 'parent.ts' },
      { kind: 'exactFile', path: 'child.ts' },
    ]);
  });

  test('extends multiple presets', () => {
    const state = makeState([
      makePreset({
        id: 'base1',
        rules: [{ kind: 'exactFile', path: 'base1.ts' }],
      }),
      makePreset({
        id: 'base2',
        rules: [{ kind: 'exactFolder', path: 'dist/' }],
      }),
      makePreset({
        id: 'child',
        extends: ['base1', 'base2'],
        rules: [{ kind: 'glob', pattern: '**/*.gen.ts' }],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'child');
    expect(resolved).toEqual([
      { kind: 'exactFile', path: 'base1.ts' },
      { kind: 'exactFolder', path: 'dist/' },
      { kind: 'glob', pattern: '**/*.gen.ts' },
    ]);
  });

  test('transitive inheritance (grandparent)', () => {
    const state = makeState([
      makePreset({
        id: 'grandparent',
        rules: [{ kind: 'exactFile', path: 'gp.ts' }],
      }),
      makePreset({
        id: 'parent',
        extends: ['grandparent'],
        rules: [{ kind: 'exactFile', path: 'parent.ts' }],
      }),
      makePreset({
        id: 'child',
        extends: ['parent'],
        rules: [{ kind: 'exactFile', path: 'child.ts' }],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'child');
    expect(resolved).toEqual([
      { kind: 'exactFile', path: 'gp.ts' },
      { kind: 'exactFile', path: 'parent.ts' },
      { kind: 'exactFile', path: 'child.ts' },
    ]);
  });

  test('deduplicates inherited rules', () => {
    const state = makeState([
      makePreset({
        id: 'base1',
        rules: [{ kind: 'exactFile', path: 'shared.ts' }],
      }),
      makePreset({
        id: 'base2',
        rules: [{ kind: 'exactFile', path: 'shared.ts' }],
      }),
      makePreset({
        id: 'child',
        extends: ['base1', 'base2'],
        rules: [],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'child');
    expect(resolved).toEqual([{ kind: 'exactFile', path: 'shared.ts' }]);
  });

  test('deduplicates own rule that matches inherited rule', () => {
    const state = makeState([
      makePreset({
        id: 'parent',
        rules: [{ kind: 'exactFile', path: 'shared.ts' }],
      }),
      makePreset({
        id: 'child',
        extends: ['parent'],
        rules: [{ kind: 'exactFile', path: 'shared.ts' }],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'child');
    expect(resolved).toEqual([{ kind: 'exactFile', path: 'shared.ts' }]);
  });

  test('detects direct cycle and throws', () => {
    const state = makeState([
      makePreset({
        id: 'a',
        extends: ['b'],
        rules: [],
      }),
      makePreset({
        id: 'b',
        extends: ['a'],
        rules: [],
      }),
    ]);
    expect(() => resolvePresetRules(state, 'a')).toThrow(/cycle/i);
  });

  test('detects indirect cycle and throws', () => {
    const state = makeState([
      makePreset({
        id: 'a',
        extends: ['b'],
        rules: [],
      }),
      makePreset({
        id: 'b',
        extends: ['c'],
        rules: [],
      }),
      makePreset({
        id: 'c',
        extends: ['a'],
        rules: [],
      }),
    ]);
    expect(() => resolvePresetRules(state, 'a')).toThrow(/cycle/i);
  });

  test('ignores extends referencing non-existent preset', () => {
    const state = makeState([
      makePreset({
        id: 'child',
        extends: ['nonexistent'],
        rules: [{ kind: 'exactFile', path: 'child.ts' }],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'child');
    expect(resolved).toEqual([{ kind: 'exactFile', path: 'child.ts' }]);
  });

  test('throws for non-existent preset ID', () => {
    const state = makeState([]);
    expect(() => resolvePresetRules(state, 'nonexistent')).toThrow();
  });

  test('preset with empty extends array returns own rules', () => {
    const state = makeState([
      makePreset({
        id: 'p1',
        extends: [],
        rules: [{ kind: 'exactFile', path: 'a.ts' }],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'p1');
    expect(resolved).toEqual([{ kind: 'exactFile', path: 'a.ts' }]);
  });

  test('diamond inheritance resolves correctly', () => {
    // A extends B and C, both B and C extend D
    const state = makeState([
      makePreset({
        id: 'd',
        rules: [{ kind: 'exactFile', path: 'd.ts' }],
      }),
      makePreset({
        id: 'b',
        extends: ['d'],
        rules: [{ kind: 'exactFile', path: 'b.ts' }],
      }),
      makePreset({
        id: 'c',
        extends: ['d'],
        rules: [{ kind: 'exactFile', path: 'c.ts' }],
      }),
      makePreset({
        id: 'a',
        extends: ['b', 'c'],
        rules: [{ kind: 'exactFile', path: 'a.ts' }],
      }),
    ]);
    const resolved = resolvePresetRules(state, 'a');
    // d.ts should appear only once (from the diamond)
    expect(resolved).toEqual([
      { kind: 'exactFile', path: 'd.ts' },
      { kind: 'exactFile', path: 'b.ts' },
      { kind: 'exactFile', path: 'c.ts' },
      { kind: 'exactFile', path: 'a.ts' },
    ]);
  });
});

describe('setPresetExtends', () => {
  test('sets extends on a preset', () => {
    const state = makeState([
      makePreset({ id: 'parent', rules: [] }),
      makePreset({ id: 'child', rules: [] }),
    ]);
    const result = setPresetExtends(state, 'child', ['parent']);
    expect(getPresetById(result, 'child')!.extends).toEqual(['parent']);
  });

  test('replaces existing extends', () => {
    const state = makeState([
      makePreset({ id: 'a', rules: [] }),
      makePreset({ id: 'b', rules: [] }),
      makePreset({ id: 'child', extends: ['a'], rules: [] }),
    ]);
    const result = setPresetExtends(state, 'child', ['b']);
    expect(getPresetById(result, 'child')!.extends).toEqual(['b']);
  });

  test('clears extends with empty array', () => {
    const state = makeState([
      makePreset({ id: 'parent', rules: [] }),
      makePreset({ id: 'child', extends: ['parent'], rules: [] }),
    ]);
    const result = setPresetExtends(state, 'child', []);
    expect(getPresetById(result, 'child')!.extends).toEqual([]);
  });

  test('throws when preset not found', () => {
    const state = makeState([]);
    expect(() => setPresetExtends(state, 'nonexistent', ['a'])).toThrow();
  });

  test('throws when extending would create a cycle', () => {
    const state = makeState([
      makePreset({ id: 'a', extends: ['b'], rules: [] }),
      makePreset({ id: 'b', rules: [] }),
    ]);
    expect(() => setPresetExtends(state, 'b', ['a'])).toThrow(/cycle/i);
  });

  test('throws when extending self', () => {
    const state = makeState([
      makePreset({ id: 'a', rules: [] }),
    ]);
    expect(() => setPresetExtends(state, 'a', ['a'])).toThrow(/cycle/i);
  });

  test('returns new state object (immutability)', () => {
    const state = makeState([
      makePreset({ id: 'parent', rules: [] }),
      makePreset({ id: 'child', rules: [] }),
    ]);
    const result = setPresetExtends(state, 'child', ['parent']);
    expect(result).not.toBe(state);
    expect(getPresetById(state, 'child')!.extends).toBeUndefined();
  });
});
