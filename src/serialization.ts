import type { WorkspaceFolderState } from './types.js';

export function serializeState(state: WorkspaceFolderState): string {
  return JSON.stringify(state, null, 2);
}

export function deserializeState(content: string): WorkspaceFolderState {
  if (!content) return { presets: [] };
  try {
    const parsed = JSON.parse(content);
    return { presets: [], ...parsed };
  } catch {
    return { presets: [] };
  }
}
