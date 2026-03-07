import { describe, expect, test } from 'bun:test';
import { serializeState, deserializeState } from '../serialization.js';
import type { WorkspaceFolderState } from '../types.js';

describe('serializeState', () => {
  test('produces JSON with 2-space indent', () => {
    const state: WorkspaceFolderState = { presets: [] };
    const json = serializeState(state);
    expect(json).toBe(JSON.stringify(state, null, 2));
  });

  test('includes all state fields', () => {
    const state: WorkspaceFolderState = {
      presets: [
        {
          id: 'manual',
          name: 'Manual',
          isManual: true,
          enabled: true,
          rules: [{ kind: 'exactFile', path: 'secret.env' }],
        },
      ],
      backup: { 'node_modules': true },
      inverted: true,
    };
    const json = serializeState(state);
    const parsed = JSON.parse(json);
    expect(parsed.presets).toHaveLength(1);
    expect(parsed.presets[0].id).toBe('manual');
    expect(parsed.backup).toEqual({ 'node_modules': true });
    expect(parsed.inverted).toBe(true);
  });
});

describe('deserializeState', () => {
  test('parses valid JSON into WorkspaceFolderState', () => {
    const state: WorkspaceFolderState = {
      presets: [
        {
          id: 'test',
          name: 'Test',
          isManual: false,
          enabled: false,
          rules: [{ kind: 'glob', pattern: '*.log' }],
        },
      ],
      inverted: false,
    };
    const json = JSON.stringify(state);
    const result = deserializeState(json);
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0].id).toBe('test');
    expect(result.inverted).toBe(false);
  });

  test('returns default state for empty string', () => {
    const result = deserializeState('');
    expect(result).toEqual({ presets: [] });
  });

  test('returns default state for invalid JSON', () => {
    const result = deserializeState('not json at all');
    expect(result).toEqual({ presets: [] });
  });

  test('returns default state for JSON missing presets', () => {
    const result = deserializeState('{"inverted": true}');
    expect(result.presets).toEqual([]);
  });
});

describe('round-trip', () => {
  test('serialize then deserialize preserves state', () => {
    const state: WorkspaceFolderState = {
      presets: [
        {
          id: 'p1',
          name: 'Preset One',
          isManual: false,
          enabled: true,
          rules: [
            { kind: 'exactFile', path: 'foo.txt' },
            { kind: 'exactFolder', path: 'bar/' },
            { kind: 'glob', pattern: '**/*.tmp' },
          ],
          extends: ['p2'],
        },
        {
          id: 'p2',
          name: 'Preset Two',
          isManual: false,
          enabled: false,
          rules: [],
        },
      ],
      backup: { '.env': true, 'dist/': true },
      inverted: true,
    };
    const result = deserializeState(serializeState(state));
    expect(result).toEqual(state);
  });
});
