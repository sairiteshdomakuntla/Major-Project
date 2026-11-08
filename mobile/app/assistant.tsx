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
import { Icon } from '../src/components/Icon';

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
        className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#0F766E] px-4 py-3"
      >
        <Text className="text-base leading-6 text-white">{message.text}</Text>
      </View>
    );
  }

  if (message.status === 'error') {
    return (
      <View
        accessibilityLabel={`Assistant error: ${message.error ?? 'Request failed'}`}
        className="max-w-[85%] gap-2 self-start rounded-2xl rounded-bl-md border-2 border-[#DC2626] bg-white px-4 py-3"
      >
        <View className="flex-row items-center gap-2">
          <Icon name="error-circle" size={18} color="#DC2626" />
          <Text className="text-base font-semibold text-[#991B1B]">
            Couldn&apos;t reply
          </Text>
        </View>
        <Text className="text-sm leading-5 text-[#6B7280]">{message.error}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry sending your message"
          onPress={onRetry}
          className="min-h-[48px] items-center justify-center rounded-xl bg-[#0F766E] px-4 active:opacity-80"
        >
          <Text className="text-sm font-bold text-white">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={`Assistant: ${message.text}`}
      className="max-w-[85%] self-start rounded-2xl rounded-bl-md border border-[#E5E7EB] bg-white px-4 py-3"
    >
      <Text className="text-base leading-6 text-[#111827]">{message.text}</Text>
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
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center gap-2 border-b border-[#CCFBF1] bg-[#F0FDFA] px-4 py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to home"
            onPress={() => router.back()}
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-xl active:opacity-80"
          >
            <Icon name="arrow-left" size={20} color="#111827" />
          </Pressable>
          <View className="flex-1 gap-0.5">
            <Text accessibilityRole="header" className="text-lg font-bold text-[#111827]">
              Assistant
            </Text>
            <Text className="text-xs text-[#6B7280]">
              {languageLabel(language)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new conversation"
            onPress={newConversation}
            className="min-h-[48px] items-center justify-center rounded-xl px-3 active:opacity-80"
          >
            <Text className="text-sm font-bold text-[#115E59]">New chat</Text>
          </Pressable>
        </View>

        {/* Messages */}
        {messages.length === 0 && !isSending ? (
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <Text
              accessibilityRole="header"
              className="text-center text-xl font-bold text-[#111827]"
            >
              How can I help?
            </Text>
            <Text className="text-center text-sm leading-5 text-[#6B7280]">
              Ask anything in {languageLabel(language)}. Try one of these:
            </Text>
            <View className="w-full gap-2">
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask: ${s}`}
                  onPress={() => send(s)}
                  className="min-h-[52px] items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white px-4 active:opacity-80"
                >
                  <Text className="text-center text-sm font-medium text-[#111827]">
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
            className="flex-1 bg-[#F8FAFC]"
            contentContainerClassName="gap-3 p-4"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              isSending ? (
                <View
                  accessibilityLiveRegion="polite"
                  accessibilityLabel="AgentBridge is thinking"
                  className="flex-row items-center gap-2 self-start rounded-2xl rounded-bl-md border border-[#E5E7EB] bg-white px-4 py-3"
                >
                  <ActivityIndicator size="small" color="#0F766E" />
                  <Text className="text-sm text-[#6B7280]">
                    AgentBridge is thinking…
                  </Text>
                </View>
              ) : undefined
            }
            renderItem={({ item }) => (
              <MessageBubble message={item} onRetry={retry} />
            )}
          />
        )}

        {/* Composer */}
        <View className="flex-row items-end gap-2 border-t border-[#E5E7EB] bg-white p-3">
          <TextInput
            accessibilityLabel="Type your message"
            accessibilityHint={`Up to ${MAX_INPUT_CHARS} characters. Sends when you press Send.`}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type your message…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={MAX_INPUT_CHARS}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!isSending}
            className="max-h-32 min-h-[52px] flex-1 rounded-[12px] border border-[#D1D5DB] bg-[#F8FAFC] px-4 py-3 text-base leading-6 text-[#111827]"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={handleSend}
            className={`min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl px-4 active:opacity-80 ${
              canSend ? 'bg-[#0F766E]' : 'bg-[#E5E7EB] opacity-60'
            }`}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Icon name="arrow-up" size={20} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
