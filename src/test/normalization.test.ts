import { describe, expect, test } from 'bun:test';
import {
  createExactFileRule,
  createExactFolderRule,
  createGlobRule,
  normalizeRelativePath,
  isDuplicateRule,
  rulesAreEqual,
} from '../normalization.js';

describe('createExactFileRule', () => {
  test('creates rule from simple path', () => {
    expect(createExactFileRule('src/foo.ts')).toEqual({
      kind: 'exactFile',
      path: 'src/foo.ts',
    });
  });

  test('strips trailing slash', () => {
    expect(createExactFileRule('src/foo/')).toEqual({
      kind: 'exactFile',
      path: 'src/foo',
    });
  });

  test('normalizes backslashes to forward slashes', () => {
    expect(createExactFileRule('src\\bar\\baz.ts')).toEqual({
      kind: 'exactFile',
      path: 'src/bar/baz.ts',
    });
  });
});

describe('createExactFolderRule', () => {
  test('adds trailing slash if missing', () => {
    expect(createExactFolderRule('dist')).toEqual({
      kind: 'exactFolder',
      path: 'dist/',
    });
  });

  test('keeps trailing slash if present', () => {
    expect(createExactFolderRule('dist/')).toEqual({
      kind: 'exactFolder',
      path: 'dist/',
    });
  });

  test('normalizes backslashes', () => {
    expect(createExactFolderRule('src\\generated')).toEqual({
      kind: 'exactFolder',
      path: 'src/generated/',
    });
  });
});

describe('createGlobRule', () => {
  test('trims whitespace', () => {
    expect(createGlobRule('  **/*.gen.ts  ')).toEqual({
      kind: 'glob',
      pattern: '**/*.gen.ts',
    });
  });

  test('throws on empty string', () => {
    expect(() => createGlobRule('')).toThrow();
  });

  test('throws on whitespace-only string', () => {
    expect(() => createGlobRule('   ')).toThrow();
  });
});

describe('normalizeRelativePath', () => {
  test('strips workspace folder prefix (unix)', () => {
    expect(
      normalizeRelativePath('/home/user/project/src/foo.ts', '/home/user/project')
    ).toBe('src/foo.ts');
  });

  test('strips workspace folder prefix (windows)', () => {
    expect(
      normalizeRelativePath('C:\\Users\\project\\src\\foo.ts', 'C:\\Users\\project')
    ).toBe('src/foo.ts');
  });

  test('strips leading slash after prefix removal', () => {
    expect(
      normalizeRelativePath('/home/user/project/src/foo.ts', '/home/user/project/')
    ).toBe('src/foo.ts');
  });
});

describe('isDuplicateRule', () => {
  test('returns true for matching exact file rules', () => {
    const rule = { kind: 'exactFile' as const, path: 'src/foo.ts' };
    const existing = [{ kind: 'exactFile' as const, path: 'src/foo.ts' }];
    expect(isDuplicateRule(rule, existing)).toBe(true);
  });

  test('returns false for different paths', () => {
    const rule = { kind: 'exactFile' as const, path: 'src/foo.ts' };
    const existing = [{ kind: 'exactFile' as const, path: 'src/bar.ts' }];
    expect(isDuplicateRule(rule, existing)).toBe(false);
  });

  test('returns false for same path but different kind', () => {
    const rule = { kind: 'exactFile' as const, path: 'dist/' };
    const existing = [{ kind: 'exactFolder' as const, path: 'dist/' }];
    expect(isDuplicateRule(rule, existing)).toBe(false);
  });

  test('correctly handles glob rules', () => {
    const rule = { kind: 'glob' as const, pattern: '**/*.ts' };
    const existing = [{ kind: 'glob' as const, pattern: '**/*.ts' }];
    expect(isDuplicateRule(rule, existing)).toBe(true);
  });

  test('returns false for different glob patterns', () => {
    const rule = { kind: 'glob' as const, pattern: '**/*.ts' };
    const existing = [{ kind: 'glob' as const, pattern: '**/*.js' }];
    expect(isDuplicateRule(rule, existing)).toBe(false);
  });
});

describe('rulesAreEqual', () => {
  test('equal exact file rules', () => {
    const a = { kind: 'exactFile' as const, path: 'src/foo.ts' };
    const b = { kind: 'exactFile' as const, path: 'src/foo.ts' };
    expect(rulesAreEqual(a, b)).toBe(true);
  });

  test('different kind returns false', () => {
    const a = { kind: 'exactFile' as const, path: 'dist/' };
    const b = { kind: 'exactFolder' as const, path: 'dist/' };
    expect(rulesAreEqual(a, b)).toBe(false);
  });

  test('symmetric comparison', () => {
    const a = { kind: 'glob' as const, pattern: '**/*.ts' };
    const b = { kind: 'glob' as const, pattern: '**/*.ts' };
    expect(rulesAreEqual(a, b)).toBe(true);
    expect(rulesAreEqual(b, a)).toBe(true);
  });
});
