import { describe, expect, test } from 'bun:test';
import { ruleToExcludeKey, materializeActiveRules, materializeInvertedRules } from '../materialization.js';
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

  test('includes inherited rules from parent preset', () => {
    const state: WorkspaceFolderState = {
      presets: [
        makePreset({
          id: 'parent',
          enabled: true,
          rules: [{ kind: 'exactFile', path: 'parent.ts' }],
        }),
        makePreset({
          id: 'child',
          enabled: true,
          extends: ['parent'],
          rules: [{ kind: 'exactFile', path: 'child.ts' }],
        }),
      ],
    };
    expect(materializeActiveRules(state)).toEqual({
      'parent.ts': true,
      'child.ts': true,
    });
  });

  test('inherited rules from disabled parent are included when child is enabled', () => {
    const state: WorkspaceFolderState = {
      presets: [
        makePreset({
          id: 'parent',
          enabled: false,
          rules: [{ kind: 'exactFile', path: 'parent.ts' }],
        }),
        makePreset({
          id: 'child',
          enabled: true,
          extends: ['parent'],
          rules: [{ kind: 'exactFile', path: 'child.ts' }],
        }),
      ],
    };
    // Child is enabled and extends parent, so parent's rules should be included
    // even though parent itself is disabled
    expect(materializeActiveRules(state)).toEqual({
      'parent.ts': true,
      'child.ts': true,
    });
  });
});

describe('materializeInvertedRules', () => {
  test('hides entries not matching any rule', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [{ kind: 'exactFile', path: 'keep.ts' }],
      })],
    };
    const entries = ['keep.ts', 'hide-me.ts', 'also-hide.ts'];
    expect(materializeInvertedRules(state, entries)).toEqual({
      'hide-me.ts': true,
      'also-hide.ts': true,
    });
  });

  test('keeps exact folder matches visible', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [{ kind: 'exactFolder', path: 'src/' }],
      })],
    };
    const entries = ['src/', 'dist/', 'node_modules/'];
    expect(materializeInvertedRules(state, entries)).toEqual({
      'dist/': true,
      'node_modules/': true,
    });
  });

  test('keeps parent directories of deep exact rules visible', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [{ kind: 'exactFile', path: 'src/utils/helper.ts' }],
      })],
    };
    const entries = ['src/', 'dist/', 'package.json'];
    // src/ should stay visible because it contains a ruled item
    expect(materializeInvertedRules(state, entries)).toEqual({
      'dist/': true,
      'package.json': true,
    });
  });

  test('disabled presets are ignored', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: false,
        rules: [{ kind: 'exactFile', path: 'keep.ts' }],
      })],
    };
    const entries = ['keep.ts', 'other.ts'];
    // All should be hidden since the preset is disabled
    expect(materializeInvertedRules(state, entries)).toEqual({
      'keep.ts': true,
      'other.ts': true,
    });
  });

  test('no enabled presets hides everything', () => {
    const state: WorkspaceFolderState = { presets: [] };
    const entries = ['a.ts', 'b.ts'];
    expect(materializeInvertedRules(state, entries)).toEqual({
      'a.ts': true,
      'b.ts': true,
    });
  });

  test('glob rule with ** prefix keeps all entries visible', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [{ kind: 'glob', pattern: '**/*.ts' }],
      })],
    };
    const entries = ['src/', 'dist/', 'index.ts'];
    // ** can match in any directory, so all entries stay visible
    expect(materializeInvertedRules(state, entries)).toEqual({});
  });

  test('glob rule with specific path prefix keeps that directory visible', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [{ kind: 'glob', pattern: 'src/**/*.test.ts' }],
      })],
    };
    const entries = ['src/', 'dist/', 'package.json'];
    // Only src/ should stay visible (glob starts with 'src/')
    expect(materializeInvertedRules(state, entries)).toEqual({
      'dist/': true,
      'package.json': true,
    });
  });

  test('includes inherited rules from extended presets', () => {
    const state: WorkspaceFolderState = {
      presets: [
        makePreset({
          id: 'parent',
          enabled: false,
          rules: [{ kind: 'exactFile', path: 'parent.ts' }],
        }),
        makePreset({
          id: 'child',
          enabled: true,
          extends: ['parent'],
          rules: [{ kind: 'exactFile', path: 'child.ts' }],
        }),
      ],
    };
    const entries = ['parent.ts', 'child.ts', 'other.ts'];
    expect(materializeInvertedRules(state, entries)).toEqual({
      'other.ts': true,
    });
  });

  test('empty entries returns empty object', () => {
    const state: WorkspaceFolderState = {
      presets: [makePreset({
        id: 'p1',
        enabled: true,
        rules: [{ kind: 'exactFile', path: 'a.ts' }],
      })],
    };
    expect(materializeInvertedRules(state, [])).toEqual({});
  });
});
