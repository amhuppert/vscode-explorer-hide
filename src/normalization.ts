import type { ExactFileRule, ExactFolderRule, GlobRule, Rule } from './types.js';

export function createExactFileRule(relativePath: string): ExactFileRule {
  let path = relativePath.replace(/\\/g, '/');
  path = path.replace(/\/+$/, '');
  return { kind: 'exactFile', path };
}

export function createExactFolderRule(relativePath: string): ExactFolderRule {
  let path = relativePath.replace(/\\/g, '/');
  path = path.replace(/\/+$/, '');
  path = path + '/';
  return { kind: 'exactFolder', path };
}

export function createGlobRule(pattern: string): GlobRule {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    throw new Error('Glob pattern cannot be empty');
  }
  return { kind: 'glob', pattern: trimmed };
}

export function normalizeRelativePath(absolutePath: string, workspaceFolderPath: string): string {
  let normalized = absolutePath.replace(/\\/g, '/');
  let folderPrefix = workspaceFolderPath.replace(/\\/g, '/');
  folderPrefix = folderPrefix.replace(/\/+$/, '');
  if (normalized.startsWith(folderPrefix)) {
    normalized = normalized.slice(folderPrefix.length);
  }
  normalized = normalized.replace(/^\/+/, '');
  return normalized;
}

export function rulesAreEqual(a: Rule, b: Rule): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'glob' && b.kind === 'glob') return a.pattern === b.pattern;
  if ((a.kind === 'exactFile' || a.kind === 'exactFolder') &&
      (b.kind === 'exactFile' || b.kind === 'exactFolder')) {
    return a.path === b.path;
  }
  return false;
}

export function isDuplicateRule(rule: Rule, existingRules: Rule[]): boolean {
  return existingRules.some(existing => rulesAreEqual(rule, existing));
}
