import type { Request, Response } from 'express';
import type { ApiInfoResponse, HealthResponse } from '../types/index.js';

export function getRoot(_req: Request, res: Response): void {
  res.status(200).json({
    name: 'agentbridge-api',
    status: 'ok',
    docs: [
      'GET /health',
      'GET /api/v1',
      'POST /api/v1/assistant/message',
      'POST /api/v1/vision/analyze',
    ],
  });
}

export function getHealth(_req: Request, res: Response): void {
  const body: HealthResponse = {
    status: 'ok',
    service: 'agentbridge-api',
  };
  res.status(200).json(body);
}

export function getApiInfo(_req: Request, res: Response): void {
  const body: ApiInfoResponse = {
    name: 'agentbridge-api',
    version: 'v1',
    status: 'ok',
    endpoints: [
      'GET /health',
      'GET /api/v1',
      'POST /api/v1/assistant/message',
      'POST /api/v1/vision/analyze',
    ],
  };
  res.status(200).json(body);
}
