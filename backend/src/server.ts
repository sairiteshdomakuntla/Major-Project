import { createServer } from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { attachLiveWebSocket } from './live/liveWebSocket.js';

const app = createApp();

// Use http.createServer so both Express and WebSocket share the same port.
const server = createServer(app);

// Attach the live narration WebSocket endpoint.
attachLiveWebSocket(server);

server.listen(config.port, () => {
  console.log(`[agentbridge-api] listening on http://localhost:${config.port} (${config.nodeEnv})`);
  console.log(`[agentbridge-api] live WebSocket at ws://localhost:${config.port}/api/v1/live`);
});
