export type SheetPhase = 'pick' | 'coach' | 'scan' | 'review' | 'error';

export interface SheetState {
  phase: SheetPhase;
  blocked: boolean;
  listening: boolean;
  isVoice: boolean;
  completeOpen: boolean;
  /** A matched line and a scan to confirm against. */
  canComplete: boolean;
  hasScanError: boolean;
  saving: boolean;
}

export type SheetBody =
  | 'blocked' | 'pick' | 'coach' | 'listening' | 'scan' | 'error' | 'complete' | 'review' | 'saving' | 'none';

/** What the Add sheet draws. 'none' would be an empty sheet with only its handle. */
export function sheetBody(s: SheetState): SheetBody {
  if (s.saving) return 'saving';
  switch (s.phase) {
    case 'pick': return s.blocked ? 'blocked' : 'pick';
    case 'coach': return 'coach';
    case 'scan': return s.isVoice && s.listening ? 'listening' : 'scan';
    case 'error': return s.hasScanError ? 'error' : 'none';
    case 'review': return s.completeOpen && s.canComplete ? 'complete' : 'review';
    default: return 'none';
  }
}
