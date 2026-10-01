import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConversation } from '../src/assistant/useConversation';
import type { ChatMessage } from '../src/assistant/types';
import { languageLabel } from '../src/profile/options';

const MAX_INPUT_CHARS = 4000;

const SUGGESTIONS = [
  'What can you help me with?',
  'Explain this in simple words',
  'Help me write a polite message',
];

function MessageBubble({
  message,
  onRetry,
}: {
  message: ChatMessage;
  onRetry: () => void;
}) {
  if (message.role === 'user') {
    return (
      <View
        accessibilityLabel={`You said: ${message.text}`}
        className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-sky-400 px-4 py-3"
      >
        <Text className="text-base leading-6 text-slate-900">{message.text}</Text>
      </View>
    );
  }

  if (message.status === 'error') {
    return (
      <View
        accessibilityLabel={`Assistant error: ${message.error ?? 'Request failed'}`}
        className="max-w-[85%] gap-2 self-start rounded-2xl rounded-bl-md border-2 border-red-400 bg-slate-800 px-4 py-3"
      >
        <View className="flex-row items-center gap-2">
          <Text
            importantForAccessibility="no"
            className="text-base font-bold text-red-400"
          >
            !
          </Text>
          <Text className="text-base font-semibold text-slate-50">
            Couldn&apos;t reply
          </Text>
        </View>
        <Text className="text-sm leading-5 text-slate-300">{message.error}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry sending your message"
          onPress={onRetry}
          className="min-h-[48px] items-center justify-center rounded-xl bg-sky-400 px-4 active:opacity-80"
        >
          <Text className="text-sm font-bold text-slate-900">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={`Assistant: ${message.text}`}
      className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-slate-800 px-4 py-3"
    >
      <Text className="text-base leading-6 text-slate-50">{message.text}</Text>
    </View>
  );
}

export default function AssistantScreen() {
  const { messages, isSending, send, retry, newConversation, language } =
    useConversation();
  const [draft, setDraft] = useState('');

  const canSend = draft.trim().length > 0 && !isSending;

  const handleSend = () => {
    if (!canSend) return;
    send(draft);
    setDraft('');
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center gap-2 border-b border-slate-800 px-4 py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to home"
            onPress={() => router.back()}
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-xl active:opacity-80"
          >
            <Text className="text-2xl font-bold text-slate-100">‹</Text>
          </Pressable>
          <View className="flex-1 gap-0.5">
            <Text accessibilityRole="header" className="text-lg font-bold text-slate-50">
              Assistant
            </Text>
            <Text className="text-xs text-slate-400">
              {languageLabel(language)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new conversation"
            onPress={newConversation}
            className="min-h-[48px] items-center justify-center rounded-xl px-3 active:opacity-80"
          >
            <Text className="text-sm font-bold text-sky-400">New chat</Text>
          </Pressable>
        </View>

        {/* Messages */}
        {messages.length === 0 && !isSending ? (
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <Text
              accessibilityRole="header"
              className="text-center text-xl font-bold text-slate-100"
            >
              How can I help?
            </Text>
            <Text className="text-center text-sm leading-5 text-slate-400">
              Ask anything in {languageLabel(language)}. Try one of these:
            </Text>
            <View className="w-full gap-2">
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask: ${s}`}
                  onPress={() => send(s)}
                  className="min-h-[52px] items-center justify-center rounded-2xl border border-slate-700 px-4 active:opacity-80"
                >
                  <Text className="text-center text-sm font-medium text-slate-200">
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={[...messages].reverse()}
            keyExtractor={(m) => m.id}
            inverted
            className="flex-1"
            contentContainerClassName="gap-3 p-4"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              isSending ? (
                <View
                  accessibilityLiveRegion="polite"
                  accessibilityLabel="AgentBridge is thinking"
                  className="flex-row items-center gap-2 self-start rounded-2xl rounded-bl-md bg-slate-800 px-4 py-3"
                >
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text className="text-sm text-slate-300">
                    AgentBridge is thinking…
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <MessageBubble message={item} onRetry={retry} />
            )}
          />
        )}

        {/* Composer */}
        <View className="flex-row items-end gap-2 border-t border-slate-800 p-3">
          <TextInput
            accessibilityLabel="Type your message"
            accessibilityHint={`Up to ${MAX_INPUT_CHARS} characters. Sends when you press Send.`}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type your message…"
            placeholderTextColor="#64748B"
            multiline
            maxLength={MAX_INPUT_CHARS}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!isSending}
            className="max-h-32 min-h-[52px] flex-1 rounded-2xl bg-slate-800 px-4 py-3 text-base leading-6 text-slate-50"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={handleSend}
            className={`min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl px-4 active:opacity-80 ${
              canSend ? 'bg-sky-400' : 'bg-slate-700 opacity-60'
            }`}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#0F172A" />
            ) : (
              <Text
                className={`text-base font-bold ${canSend ? 'text-slate-900' : 'text-slate-500'}`}
              >
                ↑
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
