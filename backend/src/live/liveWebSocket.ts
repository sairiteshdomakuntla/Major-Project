// ---------------------------------------------------------------------------
// Live WebSocket handler — bridges mobile clients to Gemini Live sessions.
//
// Protocol (JSON messages over WebSocket):
//
// Client → Server:
//   { type: "start",  language: "en", needs: ["visual"] }
//   { type: "frame",  data: "<base64 JPEG>" }
//   { type: "stop" }
//   { type: "ping" }
//
// Server → Client:
//   { type: "ready" }
//   { type: "narration", text: "...", turnComplete: true, ts: 1234567890 }
//   { type: "error",     message: "..." }
//   { type: "closed",    reason: "..." }
//   { type: "stats",     framesForwarded: N, framesDropped: N }
//   { type: "pong" }
// ---------------------------------------------------------------------------

import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { LiveSessionManager } from './liveSessionManager.js';

// ---------------------------------------------------------------------------
// Types for protocol messages
// ---------------------------------------------------------------------------

interface StartMessage {
  type: 'start';
  language: string;
  needs: string[];
}

interface FrameMessage {
  type: 'frame';
  data: string;
}

interface StopMessage {
  type: 'stop';
}

interface PingMessage {
  type: 'ping';
}

type ClientMessage = StartMessage | FrameMessage | StopMessage | PingMessage;

// ---------------------------------------------------------------------------
// Per-client state
// ---------------------------------------------------------------------------

interface ClientState {
  manager: LiveSessionManager | null;
  alive: boolean;
  /** Timestamp of last received message for idle detection. */
  lastActivity: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max idle time before we close the connection (ms). */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
/** Heartbeat ping interval (ms). */
const HEARTBEAT_INTERVAL_MS = 30_000;
/** Max payload size for a single frame message (base64 string length). */
const MAX_FRAME_SIZE = 4 * 1024 * 1024; // 4 MB — Samsung high-res cameras can produce large frames

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function attachLiveWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/api/v1/live',
    maxPayload: 5 * 1024 * 1024, // 5 MB — Samsung/high-res phones need headroom
    perMessageDeflate: {
      zlibDeflateOptions: { level: 1 }, // fast compression
      threshold: 1024, // only compress messages > 1 KB
    },
  });

  // Heartbeat: detect dead connections
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const state = clientStates.get(ws);
      if (!state) continue;

      // Check idle timeout
      if (Date.now() - state.lastActivity > IDLE_TIMEOUT_MS) {
        console.log('[live-ws] Closing idle connection');
        state.manager?.close();
        ws.terminate();
        clientStates.delete(ws);
        continue;
      }

      // WebSocket-level ping/pong for connection liveness
      if (!state.alive) {
        console.log('[live-ws] Terminating unresponsive connection');
        state.manager?.close();
        ws.terminate();
        clientStates.delete(ws);
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  const clientStates = new Map<WebSocket, ClientState>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('[live-ws] Client connected');

    const state: ClientState = {
      manager: null,
      alive: true,
      lastActivity: Date.now(),
    };
    clientStates.set(ws, state);

    ws.on('pong', () => {
      state.alive = true;
    });

    ws.on('message', (raw: Buffer | string) => {
      state.alive = true;
      state.lastActivity = Date.now();

      let msg: ClientMessage;
      try {
        const str = typeof raw === 'string' ? raw : raw.toString('utf-8');
        msg = JSON.parse(str) as ClientMessage;
      } catch {
        sendJson(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      switch (msg.type) {
        case 'start':
          handleStart(ws, state, msg);
          break;
        case 'frame':
          handleFrame(ws, state, msg);
          break;
        case 'stop':
          handleStop(ws, state);
          break;
        case 'ping':
          sendJson(ws, { type: 'pong' });
          break;
        default:
          sendJson(ws, { type: 'error', message: `Unknown message type` });
      }
    });

    ws.on('close', () => {
      console.log('[live-ws] Client disconnected');
      state.manager?.close();
      state.manager = null;
      clientStates.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[live-ws] WebSocket error:', err.message);
      state.manager?.close();
      state.manager = null;
      clientStates.delete(ws);
    });
  });

  console.log('[live-ws] WebSocket server attached on /api/v1/live');
  return wss;
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

function handleStart(ws: WebSocket, state: ClientState, msg: StartMessage): void {
  // Close any existing session
  if (state.manager) {
    state.manager.close();
    state.manager = null;
  }

  const language = typeof msg.language === 'string' ? msg.language : 'en';
  const needs = Array.isArray(msg.needs) ? msg.needs : [];

  console.log(`[live-ws] Starting session: lang=${language} needs=[${needs.join(',')}]`);

  try {
    const manager = new LiveSessionManager(
      {
        onReady: () => {
          if (ws.readyState === WebSocket.OPEN) {
            sendJson(ws, { type: 'ready' });
          }
        },
        onNarration: (text: string, turnComplete: boolean) => {
          if (ws.readyState === WebSocket.OPEN) {
            sendJson(ws, {
              type: 'narration',
              text,
              turnComplete,
              ts: Date.now(),
            });
          }
        },
        onError: (message: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            sendJson(ws, { type: 'error', message });
          }
        },
        onClose: (reason: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            sendJson(ws, { type: 'closed', reason });
          }
          state.manager = null;
        },
      },
      { language, needs },
    );

    state.manager = manager;
    void manager.connect();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Failed to create session';
    sendJson(ws, { type: 'error', message: errMsg });
  }
}

function handleFrame(ws: WebSocket, state: ClientState, msg: FrameMessage): void {
  if (!state.manager) {
    sendJson(ws, { type: 'error', message: 'No active session — send "start" first' });
    return;
  }

  if (typeof msg.data !== 'string' || msg.data.length === 0) {
    return; // Silently ignore empty frames
  }

  // Reject oversized frames
  if (msg.data.length > MAX_FRAME_SIZE) {
    console.warn(`[live-ws] Dropping oversized frame: ${(msg.data.length / 1024).toFixed(0)} KB`);
    return;
  }

  state.manager.sendFrame(msg.data);
}

function handleStop(ws: WebSocket, state: ClientState): void {
  if (state.manager) {
    const stats = state.manager.getStats();
    state.manager.close();
    state.manager = null;
    sendJson(ws, { type: 'stats', ...stats });
  }
  sendJson(ws, { type: 'closed', reason: 'Stopped by client' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJson(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(data));
  } catch {
    // Connection already closing
  }
}
