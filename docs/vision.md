# Vision Agent

Voice-first image assistance for blind and low-vision users. Mobile captures
a photo → backend analyzes it with Gemini multimodal → result is shown as
text and spoken aloud. Follow-ups reuse the same photo without recapturing.

## Backend endpoint

`POST /api/v1/vision/analyze` (12 MB JSON limit on this route only)

Request:

```json
{
  "image": "<base64 jpeg/png/webp, data-URL prefix optional>",
  "mimeType": "image/jpeg",
  "message": "Describe this image for a blind person",
  "history": [{ "role": "user", "text": "..." }],
  "language": "en"
}
```

- `image`: required, ≤ 8 MB decoded. Analyzed in memory, never stored.
- `message`: optional prompt (describe / read / find X). Defaults to a full
  description tuned for blind users.
- `history` / `language`: same rules as the text assistant.
- Response: `{ reply, intent, capability: "vision", model, language,
  availability }` with intents `vision-describe | vision-read |
  vision-followup`.

Errors use the standard `{ error: { message, statusCode } }` shape
(400 validation, 429 busy, 502 provider failure, 503 key missing).

No new credentials: same `GEMINI_API_KEY` as the text assistant.
Optional: `GEMINI_VISION_TIMEOUT_MS` (default 60000).

## Mobile flow (`app/vision.tsx`)

1. Camera permission card → system prompt via `expo-camera`.
2. Big **Listen** button: on-device speech recognition
   (`expo-speech-recognition`, locale from profile: en-US / hi-IN / te-IN)
   → multilingual command matcher (`describe`, `read`, `find X`,
   `open camera`, `repeat`, `stop`, anything else = follow-up question).
3. Photo captured at quality 0.6 JPEG → base64 stays in session memory only.
4. Reply arrives → shown as text + spoken via `expo-speech` (only if the
   profile's output modes include speech).
5. **Repeat** re-speaks, **Stop** silences, **New photo** discards the image
   and clears context, follow-up composer reuses the same photo.
6. Every state (listening, capturing, analyzing, speaking, errors) is
   announced visually and aloud; all voice actions have touch equivalents.

## Important: voice input needs a development build

`expo-speech-recognition` contains native code, so **voice commands do not
work in Expo Go**. In Expo Go the mic button honestly reports this and the
touch buttons do everything voice does. Camera and speech output work in
both. See README for the one-time dev-build setup.

## Known limitations

- Single photos only — no video, live tracking, or navigation guidance.
- Descriptions may be inaccurate; the UI says so and never guarantees accuracy.
- Speech recognition needs internet (Google service) unless on-device packs
  are installed; Hindi/Telugu accuracy depends on the device engine.
- No wake word (by design, not yet implemented).
