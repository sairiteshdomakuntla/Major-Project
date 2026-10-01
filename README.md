# AgentBridge

Multilingual, multimodal AI accessibility companion.

Monorepo:

```text
agentbridge/
  mobile/    Expo + TypeScript + Expo Router + NativeWind + Zustand + TanStack Query
  backend/   Node.js + Express + TypeScript (REST API + Master Agent + Gemini)
  docs/
```

## Prerequisites (Windows)

- Node.js LTS (verified with v22.16.0) — https://nodejs.org/
- npm 11.x (use npm only; do not mix package managers)
- Expo Go on a phone, or an Android emulator, for device testing
- PowerShell 7+ (`pwsh`)

## Backend — setup & run

```powershell
cd backend
npm install
copy .env.example .env   # then edit PORT if needed
npm run dev              # http://localhost:4000
```

Endpoints:

- `GET /` → service info
- `GET /health` → `{"status":"ok","service":"agentbridge-api"}`
- `GET /api/v1` → API identification
- `POST /api/v1/assistant/message` → AI assistant (needs `GEMINI_API_KEY`,
  see `docs/assistant-api.md`)

Other scripts:

```powershell
npm run typecheck  # tsc --noEmit
npm run build      # tsc -> dist/
npm start          # node dist/server.js (production)
```

## Mobile — setup & run

```powershell
cd mobile
npm install --legacy-peer-deps   # required: upstream Expo SDK 57 react-dom@19.3.0 peer vs react@19.2.3
copy .env.example .env           # then set EXPO_PUBLIC_API_URL (see docs/api-url.md)
npx expo start
```

- Press `w` for web, `a` for Android emulator, or scan the QR with Expo Go.
- Starter screen shows NativeWind styling + backend connectivity card
  (Connecting / Connected / Connection Failed + Retry, 8s timeout).
- Complete onboarding, then open **Ask anything** on Home for the AI assistant
  (requires backend with `GEMINI_API_KEY`).

Type check:

```powershell
npm run typecheck
```

Diagnostics:

```powershell
npx expo doctor
```

## Notes

- NativeWind v4.2.7 (stable, Tailwind CSS v3) is used — not v5 RC.
  Config: `tailwind.config.js`, `global.css`, `babel.config.js`
  (`nativewind/babel`), `metro.config.js` (`withNativeWind`), `app.json`
  `web.bundler: metro`.
- If `npm install` fails with `ERESOLVE ... react-dom@19.3.0 ... react@"^19.3.0"`,
  re-run with `--legacy-peer-deps`. This is an upstream Expo SDK 57
  peer conflict (`@expo/metro-runtime` pulls react-dom 19.3.0 while Expo pins
  react 19.2.3), not caused by our code.
- The assistant needs a Gemini key (free from https://aistudio.google.com/apikey)
  in `backend/.env` — without it, the assistant API returns 503 and the app
  shows a "not set up yet" message. Keys stay server-side, never in the app.
