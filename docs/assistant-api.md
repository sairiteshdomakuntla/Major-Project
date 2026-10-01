# Assistant API

Real AI text assistant. Mobile → backend → Gemini. Keys never leave the server.

## Setup

```powershell
cd backend
copy .env.example .env   # if not already done
```

Add to `backend/.env` (get a key at https://aistudio.google.com/apikey):

```ini
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=25000
```

Restart `npm run dev` after changing `.env`. Never commit `.env`.

## Endpoint

`POST /api/v1/assistant/message`

Request:

```json
{
  "message": "Hello, what can you do?",
  "history": [{ "role": "user", "text": "Hi" }],
  "language": "en"
}
```

- `message`: required, 1–4000 chars.
- `history`: optional, ≤ 20 turns of `{ role: "user" | "model", text }`.
  `"assistant"` is accepted as an alias of `"model"`. The client manages
  history; the server stores nothing (MVP).
- `language`: optional `en | hi | te` (default `en`). Only the language
  name is sent to the model — no other profile data leaves the device.

Success (200):

```json
{
  "reply": "...",
  "intent": "question | help | translation-request | chat",
  "capability": "text-chat",
  "model": "gemini-2.5-flash",
  "language": "en",
  "availability": { "text-chat": true, "vision": false, "speech": false, "translation": false }
}
```

Errors (consistent `{ error: { message, statusCode } }` shape):

| Status | Meaning |
| ------ | ------- |
| 400 | Empty/oversized message, bad history, bad language, malformed JSON |
| 429 | Provider rate limit — retry after a moment |
| 502 | Provider failure or timeout — retry |
| 503 | `GEMINI_API_KEY` missing or rejected |

Logs record message sizes only, never content or keys.

## Architecture

- `src/providers/aiProvider.ts` — `AITextProvider` interface + typed errors.
- `src/providers/geminiProvider.ts` — Gemini implementation (lazy client,
  own timeout via `Promise.race`, status-mapped errors).
- `src/agents/master/index.ts` — `MasterAgent.handle()`: labels intent,
  routes to the live `text-chat` capability, returns a uniform response.
  Vision/speech/translation are registered in `CAPABILITY_AVAILABILITY`
  as unavailable until built.
- `src/controllers/assistantController.ts` — validation + error mapping.
  Provider-specific code stays out of routes/controllers.

## Known limitations

- Text only. Image/audio attachments are not accepted yet.
- No server-side conversation storage; context is client-managed per session.
- No guaranteed language accuracy; unsupported languages are rejected
  transparently (400) rather than guessed.
