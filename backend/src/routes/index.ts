import express from 'express';
import { Router } from 'express';
import {
  getApiInfo,
  getHealth,
  getRoot,
} from '../controllers/healthController.js';
import { postAssistantMessage } from '../controllers/assistantController.js';
import { postVisionAnalyze } from '../controllers/visionController.js';

export const router = Router();

router.get('/', getRoot);
router.get('/health', getHealth);
router.get('/api/v1', getApiInfo);
router.post('/api/v1/assistant/message', postAssistantMessage);
// Vision uploads carry base64 images — larger limit applies to this route only.
router.post(
  '/api/v1/vision/analyze',
  express.json({ limit: '12mb' }),
  postVisionAnalyze,
);
