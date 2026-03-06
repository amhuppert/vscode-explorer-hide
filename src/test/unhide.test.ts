import { describe, expect, test } from 'bun:test';
import {
  isHiddenByOwnedExactRule,
  findExactRulesForPath,
  removeExactRulesForPath,
} from '../unhide.js';
import type { WorkspaceFolderState } from '../types.js';

function makeState(presets: WorkspaceFolderState['presets']): WorkspaceFolderState {
  return { presets };
}

describe('isHiddenByOwnedExactRule', () => {
  test('file hidden by exactFile rule returns true', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
    }]);
    expect(isHiddenByOwnedExactRule('src/foo.ts', state)).toBe(true);
  });

  test('folder hidden by exactFolder rule returns true', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'exactFolder', path: 'dist/' }],
    }]);
    expect(isHiddenByOwnedExactRule('dist/', state)).toBe(true);
  });

  test('file hidden only by glob returns false', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'glob', pattern: '**/*.ts' }],
    }]);
    expect(isHiddenByOwnedExactRule('src/foo.ts', state)).toBe(false);
  });

  test('file not hidden at all returns false', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'exactFile', path: 'other.ts' }],
    }]);
    expect(isHiddenByOwnedExactRule('src/foo.ts', state)).toBe(false);
  });

  test('file hidden by exact rule in DISABLED preset returns true', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: false,
      rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
    }]);
    expect(isHiddenByOwnedExactRule('src/foo.ts', state)).toBe(true);
  });

  test('file hidden by exact rule in multiple presets returns true', () => {
    const state = makeState([
      {
        id: 'p1', name: 'P1', isManual: false, enabled: true,
        rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
      },
      {
        id: 'p2', name: 'P2', isManual: false, enabled: false,
        rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
      },
    ]);
    expect(isHiddenByOwnedExactRule('src/foo.ts', state)).toBe(true);
  });
});

describe('findExactRulesForPath', () => {
  test('finds rule in single preset', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [
        { kind: 'exactFile', path: 'a.ts' },
        { kind: 'exactFile', path: 'src/foo.ts' },
      ],
    }]);
    const result = findExactRulesForPath('src/foo.ts', state);
    expect(result).toEqual([{ presetId: 'p1', ruleIndex: 1 }]);
  });

  test('finds rules in multiple presets', () => {
    const state = makeState([
      {
        id: 'p1', name: 'P1', isManual: false, enabled: true,
        rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
      },
      {
        id: 'p2', name: 'P2', isManual: false, enabled: true,
        rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
      },
    ]);
    const result = findExactRulesForPath('src/foo.ts', state);
    expect(result).toEqual([
      { presetId: 'p1', ruleIndex: 0 },
      { presetId: 'p2', ruleIndex: 0 },
    ]);
  });

  test('returns empty for no matches', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'exactFile', path: 'other.ts' }],
    }]);
    expect(findExactRulesForPath('src/foo.ts', state)).toEqual([]);
  });

  test('ignores glob rules', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'glob', pattern: 'src/foo.ts' }],
    }]);
    expect(findExactRulesForPath('src/foo.ts', state)).toEqual([]);
  });
});

describe('removeExactRulesForPath', () => {
  test('removes exact file rule from one preset', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [
        { kind: 'exactFile', path: 'keep.ts' },
        { kind: 'exactFile', path: 'src/foo.ts' },
      ],
    }]);
    const result = removeExactRulesForPath('src/foo.ts', state);
    expect(result.presets[0].rules).toHaveLength(1);
    expect(result.presets[0].rules[0]).toEqual({ kind: 'exactFile', path: 'keep.ts' });
  });

  test('removes exact folder rule', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'exactFolder', path: 'dist/' }],
    }]);
    const result = removeExactRulesForPath('dist/', state);
    expect(result.presets[0].rules).toHaveLength(0);
  });

  test('removes from multiple presets', () => {
    const state = makeState([
      {
        id: 'p1', name: 'P1', isManual: false, enabled: true,
        rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
      },
      {
        id: 'p2', name: 'P2', isManual: false, enabled: true,
        rules: [
          { kind: 'exactFile', path: 'src/foo.ts' },
          { kind: 'exactFile', path: 'other.ts' },
        ],
      },
    ]);
    const result = removeExactRulesForPath('src/foo.ts', state);
    expect(result.presets[0].rules).toHaveLength(0);
    expect(result.presets[1].rules).toHaveLength(1);
    expect(result.presets[1].rules[0]).toEqual({ kind: 'exactFile', path: 'other.ts' });
  });

  test('does not remove glob rules even if pattern matches', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'glob', pattern: 'src/foo.ts' }],
    }]);
    const result = removeExactRulesForPath('src/foo.ts', state);
    expect(result.presets[0].rules).toHaveLength(1);
  });

  test('no matching rules returns state unchanged', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'exactFile', path: 'other.ts' }],
    }]);
    const result = removeExactRulesForPath('src/foo.ts', state);
    expect(result.presets[0].rules).toHaveLength(1);
  });

  test('returns new state object (original unchanged)', () => {
    const state = makeState([{
      id: 'p1', name: 'P1', isManual: false, enabled: true,
      rules: [{ kind: 'exactFile', path: 'src/foo.ts' }],
    }]);
    const result = removeExactRulesForPath('src/foo.ts', state);
    expect(result).not.toBe(state);
    expect(state.presets[0].rules).toHaveLength(1); // original unchanged
  });
});
