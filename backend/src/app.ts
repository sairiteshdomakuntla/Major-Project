import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { router } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  // Allow up to 20mb for base64 camera image uploads
  app.use(express.json({ limit: '20mb' }));
  app.use(morgan(config.logLevel === 'dev' ? 'dev' : 'combined'));

  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
