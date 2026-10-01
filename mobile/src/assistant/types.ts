// Session-only conversation types. Messages live in memory for the current
// app session — nothing here is persisted to storage.

export type ChatRole = 'user' | 'assistant';

export type ChatMessageStatus = 'sent' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  status: ChatMessageStatus;
  /** Set when status is 'error'. Safe, user-facing message. */
  error?: string;
}

/** Max turns sent to the backend as context (matches server cap). */
export const MAX_CONTEXT_TURNS = 20;
