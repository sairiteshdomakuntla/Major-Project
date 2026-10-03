# AgentBridge — Feature Progress Tracker

> **Legend** · ? Implemented · ?? Partial / Stub · ? Not started

_Last updated: 2026-10-02_

---

## Table of Contents
1. [Multi-Disability Accessibility](#1-multi-disability-accessibility)
2. [Multilingual Assistance](#2-multilingual-assistance)
3. [Personalized & Context-Aware Assistance](#3-personalized--context-aware-assistance)
4. [Agent Architecture](#4-agent-architecture)
5. [Infrastructure & DevX](#5-infrastructure--devx)
6. [What to Build Next](#6-what-to-build-next)

---

## 1. Multi-Disability Accessibility

### 1.1 Blind / Low-Vision Users
| Feature | Status | Where |
|---|---|---|
| Accessibility labels (`accessibilityLabel`) on every interactive element | ? | All screens (`app/*.tsx`) |
| `accessibilityRole` on buttons, headers, inputs | ? | All screens |
| `accessibilityLiveRegion="polite"` for assistant "thinking" indicator | ? | `app/assistant.tsx` |
| `accessibilityState={{ disabled }}` on send button | ? | `app/assistant.tsx` |
| Vision screen — describe surroundings via AI camera | ✅ | `app/vision.tsx` + `src/vision/useVisionSession.ts` |
| Vision screen — read visible text (OCR via Gemini Vision) | ✅ | `src/vision/useVisionSession.ts` (`READ_PROMPT`) |
| Vision screen — locate/find objects by name | ✅ | `src/vision/useVisionSession.ts` (`findPrompt`) |
| Live camera narration — continuous real-time narration via WebSocket | ✅ | `app/live.tsx` + `src/vision/useLiveSession.ts` + `backend/src/live/` |
| TTS — spoken response after every vision analysis | ? | `src/speech/tts.ts` ? `speakText()` |
| TTS — EN / HI / TE language support | ? | `src/speech/tts.ts` (`VOICE_LANGUAGE`) |
| Voice commands for the vision screen (describe / read / find / stop / repeat) | ? | `src/vision/voiceCommands.ts` |
| Voice commands in Hindi native + transliteration | ? | `src/vision/voiceCommands.ts` |
| Voice commands in Telugu native + transliteration | ? | `src/vision/voiceCommands.ts` |
| Voice commands in Tamil / Kannada / Malayalam | ? | `src/vision/voiceCommands.ts` — only EN / HI / TE |
| Screen reader (TalkBack / VoiceOver) full audit | ? | Not formally tested |
| High-contrast / large-text theme | ? | Theme system exists (`src/theme/`) but no high-contrast variant |
| Haptic feedback for key actions | ? | Not started |

### 1.2 Deaf / Hard-of-Hearing Users
| Feature | Status | Where |
|---|---|---|
| Full text chat — all AI replies displayed on screen | ? | `app/assistant.tsx` |
| All vision analysis results shown as text bubbles | ? | `app/vision.tsx` |
| Onboarding "Hearing audio" need flag captured | ? | `src/profile/options.ts` (`hearing`) |
| Visual "Analyzing…" status text instead of audio-only cues | ? | `app/vision.tsx` (`STATUS_TEXT`) |
| Captions / visual alerts for audio events | ? | Not started |
| Vibration alert when analysis is complete | ? | Not started |

### 1.3 Speech-Impaired Users
| Feature | Status | Where |
|---|---|---|
| Onboarding "Speech" need flag captured | ? | `src/profile/options.ts` (`speech`) |
| Text-first interaction (typing as primary input) | ? | `app/assistant.tsx` |
| Camera input as alternative to voice | ? | `app/vision.tsx` |
| Suggestion chips on empty assistant screen | ? | `app/assistant.tsx` (`SUGGESTIONS`) |
| Touch-button fallback for every voice command | ? | `app/vision.tsx` (buttons cover all voice actions) |
| AAC-style symbol board / quick-phrase shortcuts | ? | Not started |
| Predictive / phrase completion in text input | ? | Not started |

---

## 2. Multilingual Assistance

### 2.1 AI Text Assistant (backend)
| Language | Status | Notes |
|---|---|---|
| English | ? | Fully supported — Gemini responds in EN |
| Hindi (??????) | ? | `SupportedAssistantLanguage = 'hi'`; system prompt sets language |
| Telugu (??????) | ? | `SupportedAssistantLanguage = 'te'`; system prompt sets language |
| Tamil (?????) | ?? | Shown as "coming soon" in UI; not wired to backend |
| Kannada (?????) | ?? | Shown as "coming soon" in UI; not wired to backend |
| Malayalam (??????) | ?? | Shown as "coming soon" in UI; not wired to backend |
| Konkani (??????) | ?? | Shown as "coming soon" in UI; not wired to backend |
| North Indian languages (Marathi, Punjabi, Bengali, etc.) | ? | Not started |
| South Indian languages beyond the above 4 | ? | Not started |

### 2.2 Voice Input (STT) — Mobile
| Language | Status | Notes |
|---|---|---|
| English (en-US) | ? | `src/speech/stt.ts` (`STT_LOCALES`) |
| Hindi (hi-IN) | ? | `src/speech/stt.ts` (`STT_LOCALES`) |
| Telugu (te-IN) | ? | `src/speech/stt.ts` (`STT_LOCALES`) |
| Tamil / Kannada / Malayalam / Konkani | ? | Locale not wired; needs `SupportedLanguage` type expansion |

### 2.3 Voice Output (TTS) — Mobile
| Language | Status | Notes |
|---|---|---|
| English | ? | `src/speech/tts.ts` |
| Hindi | ? | `src/speech/tts.ts` |
| Telugu | ? | `src/speech/tts.ts` |
| Tamil / Kannada / Malayalam / Konkani | ? | Not wired; depends on `SupportedLanguage` type expansion |

### 2.4 Voice Commands (Vision Screen)
| Language | Status | Notes |
|---|---|---|
| English commands | ? | `src/vision/voiceCommands.ts` |
| Hindi commands (Devanagari + transliteration) | ? | `src/vision/voiceCommands.ts` |
| Telugu commands (Telugu script + transliteration) | ? | `src/vision/voiceCommands.ts` |
| Tamil / Kannada / Malayalam commands | ? | Not started |

### 2.5 Localized UI Text
| Area | Status | Notes |
|---|---|---|
| Home screen greeting (EN / HI / TE) | ? | `app/home.tsx` (`GREETINGS` map) |
| Full UI string i18n (i18next or similar) | ? | Not started — all other strings are English-only |
| RTL layout support | ? | Not needed for current languages but unstarted |

---

## 3. Personalized & Context-Aware Assistance

### 3.1 User Onboarding & Profile
| Feature | Status | Where |
|---|---|---|
| Multi-step onboarding flow | ? | `app/onboarding/` (5 screens: welcome ? needs ? language ? interaction ? review) |
| Disability needs selection (visual / hearing / speech / general) | ? | `app/onboarding/needs.tsx` + `src/profile/types.ts` |
| Language preference selection with "coming soon" labels | ? | `app/onboarding/language.tsx` + `src/profile/options.ts` |
| Input mode preference (voice / text / camera) | ? | `app/onboarding/interaction.tsx` |
| Output mode preference (speech / text) | ? | `app/onboarding/interaction.tsx` |
| Profile persisted via Zustand (in-memory, survives re-renders) | ? | `src/profile/store.ts` |
| Profile persisted to device storage (AsyncStorage / MMKV) | ? | Store uses Zustand but no persistence middleware yet |
| Onboarding skip detection + redirect on first launch | ? | `app/index.tsx` + `src/profile/store.ts` |
| Profile edit screen (post-onboarding) | ? | Not started — reset only via hidden button on Home |

### 3.2 Context-Aware AI Behavior
| Feature | Status | Where |
|---|---|---|
| Language injected into every AI request | ? | `src/assistant/useConversation.ts` ? `sendAssistantMessage` |
| Language injected into every vision request | ? | `src/vision/useVisionSession.ts` ? `analyzeVisionImage` |
| Conversation history (multi-turn context) passed to backend | ? | `src/assistant/useConversation.ts` + `src/vision/useVisionSession.ts` |
| Vision history context capped to avoid token overload | ? | `src/vision/types.ts` (`MAX_VISION_CONTEXT_TURNS`) |
| Intent detection on backend (question / help / translation / vision-*) | ? | `backend/src/agents/master/index.ts` (`detectIntent`) |
| Accessibility-need-aware prompting (e.g. blind-specific descriptions) | ? | `DESCRIBE_PROMPT` in `useVisionSession.ts` |
| Profile needs forwarded to backend to further personalize Gemini prompts | ? | Needs selected in onboarding but not included in API requests |
| Output-mode-aware UI (hide speech button when output pref is text-only) | ? | Not started |

### 3.3 Connectivity Awareness
| Feature | Status | Where |
|---|---|---|
| Connectivity card on Home (Connecting / Connected / Failed / Retry) | ? | `src/components/ConnectivityCard.tsx` |
| Graceful error messages per error type (rate limit / timeout / not configured) | ? | `src/assistant/useConversation.ts` + `src/vision/useVisionSession.ts` |
| Offline mode / cached responses | ? | Not started |

---

## 4. Agent Architecture

| Agent | Backend Status | Mobile Integration |
|---|---|---|
| **Master Agent** — orchestration, intent detection, routing | ? Full | ? Wired via `/api/v1/assistant/message` |
| **Vision Agent** — Gemini multimodal | ? Routed through Master (`handleVision`); dedicated `agents/vision/index.ts` is a stub | ? Wired via `/api/v1/vision/analyze` |
| **Live Vision Streaming** — Real-time camera feed narration | ✅ Dedicated WebSocket streaming session (`liveWebSocket.ts`, `liveSessionManager.ts`) | ✅ Wired via `ws://.../api/v1/live` + `useLiveSession.ts` |
| **Speech Agent** — STT + TTS | ?? Backend stub only (`agents/speech/index.ts`) | ? Fully implemented client-side (`stt.ts`, `tts.ts`) |
| **Translation Agent** | ?? Backend stub only (`agents/translation/index.ts`) | ? No dedicated translation UI/flow |

### Capability Registry (live flags in code)
```
text-chat   ? true   ? live
vision      ? true   ? live
live-vision ? true   ? live
speech      ? false  ?? client-side only; backend agent pending
translation ? false  ? pending
```
_Source: `backend/src/agents/master/index.ts` ? `CAPABILITY_AVAILABILITY`_

### AI Provider
| Provider | Status | Notes |
|---|---|---|
| Gemini (`@google/genai`) | ? | `GeminiProvider` — text + vision; model via `GEMINI_MODEL` env |
| Live Vision Pipeline | ✅ | Multi-model fallback (`gemini-3.5-flash-lite`, `gemini-2.5-flash`, `gemini-flash-latest`) |
| Provider abstraction (`AITextProvider` / `AIVisionProvider`) | ? | `backend/src/providers/aiProvider.ts` — easy to swap |
| OpenAI / other provider | ? | Interface ready; no second implementation |

---

## 5. Infrastructure & DevX

| Item | Status | Notes |
|---|---|---|
| Express REST API (Node.js + TypeScript) | ? | `backend/src/` |
| WebSocket Server (`ws`) | ✅ | `backend/src/live/liveWebSocket.ts` mounted on `/api/v1/live` |
| Expo React Native app (SDK 57 + Expo Router) | ? | `mobile/` |
| NativeWind v4 (Tailwind CSS for RN) | ? | `tailwind.config.js`, `babel.config.js`, `metro.config.js` |
| TanStack Query for async state | ? | `src/vision/useVisionSession.ts` |
| Zustand for global state | ? | `src/profile/store.ts`, `src/state/useAppStore.ts` |
| CORS configured on backend | ? | `backend/src/app.ts` |
| Request timeout on both sides | ? | Client `AbortController`; backend Gemini timeout param |
| Env-based API URL (`EXPO_PUBLIC_API_URL`) | ? | `src/api/client.ts` |
| TypeScript strict mode | ? | Both packages |
| `typecheck` script (`tsc --noEmit`) | ? | Both packages |
| ESLint / Prettier | ? | Not configured |
| Unit tests | ? | No test runner set up |
| E2E tests (Detox / Maestro) | ? | Not started |
| CI pipeline (GitHub Actions) | ? | Not started |
| Production build / deployment docs | ? | Not started |

---

## 6. What to Build Next

> Suggested priority order — highest impact for the stated goals first.

### ?? High Priority
1. **Persist profile to device storage** — use Zustand `persist` middleware with AsyncStorage so preferences survive restarts.
2. **Expand language support (TA / KN / ML / KOK)** — extend `SupportedLanguage`, add backend `LANGUAGE_NAMES` entries, STT/TTS locales, and unlock the "coming soon" UI toggle.
3. **Forward accessibility needs to backend** — include `needs[]` in API requests so Gemini tailors verbosity and description depth.
4. **Backend Speech Agent** — integrate Google Cloud STT or Whisper server-side for environments where device STT is unavailable.
5. **Translation Agent** — dedicated translation screen + wire `agents/translation/index.ts`.

### ?? Medium Priority
6. **Profile edit screen** — let users revisit preferences post-onboarding.
7. **Output-mode-aware UI** — hide/show voice buttons based on user output preference.
8. **Tamil / Kannada / Malayalam voice commands** — extend `voiceCommands.ts`.
9. **Full UI i18n** — integrate `i18next` / `expo-localization` for all strings.
10. **High-contrast theme** — add a second theme token set switchable from profile.

### ?? Lower Priority
11. **Haptic feedback** — on camera capture, analysis complete, and errors.
12. **Offline mode** — cache last N replies for no-connectivity usage.
13. **AAC / quick-phrase board** — for speech-impaired users.
14. **Unit tests** — start with `voiceCommands.ts` (pure, easy to test) and `detectIntent`.
15. **CI pipeline** — GitHub Actions typecheck + test on every PR.
16. **ESLint + Prettier** — code quality baseline.

---

_This file is a manually maintained audit of the source code. Update it whenever a feature is completed or a new one is started._

