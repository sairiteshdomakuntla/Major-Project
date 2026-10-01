import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import type {
  AssistantHistoryTurn,
  AssistantLanguage,
} from '../api/client';
import { ApiError, sendAssistantMessage } from '../api/client';
import { useProfileStore } from '../profile/store';
import { MAX_CONTEXT_TURNS, type ChatMessage } from './types';

function toHistory(messages: ChatMessage[]): AssistantHistoryTurn[] {
  return messages
    .filter((m) => m.status === 'sent' && m.text.length > 0)
    .slice(-MAX_CONTEXT_TURNS)
    .map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      text: m.text,
    }));
}

/** Maps technical failures to short, actionable sentences. */
export function friendlyErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.statusCode === 429) {
      return 'The assistant is busy. Wait a moment, then try again.';
    }
    if (err.statusCode === 503) {
      return 'The assistant is not set up yet. Please try again later.';
    }
    if (err.message.toLowerCase().includes('timed out')) {
      return 'The request took too long. Check your connection and try again.';
    }
    return err.message;
  }
  return 'Something went wrong. Check your connection and try again.';
}

interface SendVariables {
  text: string;
  context: AssistantHistoryTurn[];
}

/**
 * Session-scoped conversation. History is kept in memory only and cleared
 * when the conversation is reset or the app restarts — nothing is persisted.
 */
export function useConversation() {
  const language = useProfileStore((s) => s.language) as AssistantLanguage;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const idCounter = useRef(0);

  const nextId = useCallback(() => {
    idCounter.current += 1;
    return `msg-${Date.now().toString(36)}-${idCounter.current}`;
  }, []);

  const mutation = useMutation({
    mutationFn: (vars: SendVariables) =>
      sendAssistantMessage({
        message: vars.text,
        history: vars.context,
        language,
      }),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', text: data.reply, status: 'sent' },
      ]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text: '',
          status: 'error',
          error: friendlyErrorMessage(err),
        },
      ]);
    },
  });

  const send = useCallback(
    (rawText: string) => {
      const text = rawText.trim().slice(0, 4000);
      if (text.length === 0 || mutation.isPending) return;
      const context = toHistory(messages);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', text, status: 'sent' },
      ]);
      mutation.mutate({ text, context });
    },
    [messages, mutation, nextId],
  );

  /** Drops error entries and re-sends the latest user message. */
  const retry = useCallback(() => {
    if (mutation.isPending) return;
    const withoutErrors = messages.filter((m) => m.status !== 'error');
    const lastUser = [...withoutErrors]
      .reverse()
      .find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages(withoutErrors);
    mutation.mutate({ text: lastUser.text, context: toHistory(withoutErrors) });
  }, [messages, mutation]);

  const newConversation = useCallback(() => {
    mutation.reset();
    setMessages([]);
  }, [mutation]);

  return {
    messages,
    isSending: mutation.isPending,
    send,
    retry,
    newConversation,
    language,
  };
}
