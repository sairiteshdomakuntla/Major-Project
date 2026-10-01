import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[agentbridge-api] listening on http://localhost:${config.port} (${config.nodeEnv})`);
});
