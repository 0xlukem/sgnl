import type { StudioState } from './types';

export interface EditorHistory {
  document: StudioState;
  snapshots: StudioState[];
  index: number;
  gestureStart: StudioState | null;
}
export type HistoryAction =
  | { type: 'update'; document: StudioState; record: boolean }
  | { type: 'undo' | 'redo' | 'begin' | 'commit' | 'cancel' };

export function createEditorHistory(document: StudioState): EditorHistory {
  return { document, snapshots: [document], index: 0, gestureStart: null };
}
const equal = (a: StudioState, b: StudioState) => a === b || JSON.stringify(a) === JSON.stringify(b);
function record(state: EditorHistory, document: StudioState): EditorHistory {
  if (equal(state.snapshots[state.index], document)) return { ...state, document, gestureStart: null };
  const snapshots = [...state.snapshots.slice(0, state.index + 1).slice(-29), document];
  return { document, snapshots, index: snapshots.length - 1, gestureStart: null };
}

/** Continuous previews are cheap; only completed gestures append undo snapshots. */
export function editorHistoryReducer(state: EditorHistory, action: HistoryAction): EditorHistory {
  switch (action.type) {
    case 'update':
      return action.record && !state.gestureStart
        ? record(state, action.document)
        : { ...state, document: action.document };
    case 'begin':
      return state.gestureStart ? state : { ...state, gestureStart: state.document };
    case 'commit':
      return state.gestureStart ? record(state, state.document) : state;
    case 'cancel':
      return state.gestureStart ? { ...state, document: state.gestureStart, gestureStart: null } : state;
    case 'undo': {
      if (state.gestureStart) return { ...state, document: state.gestureStart, gestureStart: null };
      const index = Math.max(0, state.index - 1);
      return { ...state, index, document: state.snapshots[index] };
    }
    case 'redo': {
      const index = Math.min(state.snapshots.length - 1, state.index + 1);
      return { ...state, index, document: state.snapshots[index], gestureStart: null };
    }
  }
}
