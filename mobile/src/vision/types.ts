// Session-only vision state. The captured image lives in memory for
// follow-up questions and is discarded on new photo / unmount —
// images are never persisted to storage.

export type VisionRole = 'user' | 'assistant';

export interface VisionMessage {
  id: string;
  role: VisionRole;
  text: string;
  status: 'sent' | 'error';
  /** Set when status is 'error'. Safe, user-facing message. */
  error?: string;
}

/** Max turns sent to the backend as context (matches server cap). */
export const MAX_VISION_CONTEXT_TURNS = 20;
