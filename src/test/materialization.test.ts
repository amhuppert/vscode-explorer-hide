import { describe, expect, test } from 'bun:test';
import { ruleToExcludeKey, materializeActiveRules } from '../materialization.js';
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

describe('ruleToExcludeKey', () => {
  test('exactFile returns path', () => {
    expect(ruleToExcludeKey({ kind: 'exactFile', path: 'src/foo.ts' })).toBe('src/foo.ts');
  });

  test('exactFolder returns path with trailing slash', () => {
    expect(ruleToExcludeKey({ kind: 'exactFolder', path: 'dist/' })).toBe('dist/');
  });

  test('glob returns pattern', () => {
    expect(ruleToExcludeKey({ kind: 'glob', pattern: '**/*.gen.ts' })).toBe('**/*.gen.ts');
  });
});

describe('materializeActiveRules', () => {
  test('empty state returns empty object', () => {
    const state: WorkspaceFolderState = { presets: [] };
    expect(materializeActiveRules(state)).toEqual({});
  });

  test('enabled preset with no rules returns empty', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({ id: 'p1', enabled: true })],
    };
    expect(materializeActiveRules(state)).toEqual({});
  });

  test('enabled preset with exact file rule', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
      })],
    };
    expect(materializeActiveRules(state)).toEqual({ 'src/foo.ts': true });
  });

  test('enabled preset with exact folder rule', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [{ kind: 'exactFolder', path: 'dist/' }],
      })],
    };
    expect(materializeActiveRules(state)).toEqual({ 'dist/': true });
  });

  test('enabled preset with glob rule', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [{ kind: 'glob', pattern: '**/*.gen.ts' }],
      })],
    };
    expect(materializeActiveRules(state)).toEqual({ '**/*.gen.ts': true });
  });

  test('disabled preset rules are not included', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: false,
        rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
      })],
    };
    expect(materializeActiveRules(state)).toEqual({});
  });

  test('union of rules from two enabled presets', () => {
    const state: WorkspaceFolderState = {
      presets: [
        makePreset({
          id: 'p1',
          enabled: true,
          rules: [{ kind: 'exactFile', path: 'a.ts' }],
        }),
        makePreset({
          id: 'p2',
          enabled: true,
          rules: [{ kind: 'exactFile', path: 'b.ts' }],
        }),
      ],
    };
    expect(materializeActiveRules(state)).toEqual({
      'a.ts': true,
      'b.ts': true,
    });
  });

  test('deduplicates same rule from multiple presets', () => {
    const state: WorkspaceFolderState = {
      presets: [
        makePreset({
          id: 'p1',
          enabled: true,
          rules: [{ kind: 'exactFile', path: 'shared.ts' }],
        }),
        makePreset({
          id: 'p2',
          enabled: true,
          rules: [{ kind: 'exactFile', path: 'shared.ts' }],
        }),
      ],
    };
    const result = materializeActiveRules(state);
    expect(result).toEqual({ 'shared.ts': true });
    expect(Object.keys(result)).toHaveLength(1);
  });

  test('mix of enabled and disabled presets', () => {
    const state: WorkspaceFolderState = {
      presets: [
        makePreset({
          id: 'p1',
          enabled: true,
          rules: [{ kind: 'exactFile', path: 'visible.ts' }],
        }),
        makePreset({
          id: 'p2',
          enabled: false,
          rules: [{ kind: 'exactFile', path: 'hidden.ts' }],
        }),
      ],
    };
    expect(materializeActiveRules(state)).toEqual({ 'visible.ts': true });
  });

  test('preset with file + folder + glob rules', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [
          { kind: 'exactFile', path: 'src/foo.ts' },
          { kind: 'exactFolder', path: 'dist/' },
          { kind: 'glob', pattern: '**/*.gen.ts' },
        ],
      })],
    };
    expect(materializeActiveRules(state)).toEqual({
      'src/foo.ts': true,
      'dist/': true,
      '**/*.gen.ts': true,
    });
  });
});
