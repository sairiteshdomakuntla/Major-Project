import express from 'express';
import { Router } from 'express';
import {
  getApiInfo,
  getHealth,
  getRoot,
} from '../controllers/healthController.js';
import { postAssistantMessage } from '../controllers/assistantController.js';
import { postVisionAnalyze } from '../controllers/visionController.js';
import {
  postTranslate,
  postTranslateImage,
} from '../controllers/translationController.js';

export const router = Router();

router.get('/', getRoot);
router.get('/health', getHealth);
router.get('/api/v1', getApiInfo);
router.post('/api/v1/assistant/message', postAssistantMessage);
router.post('/api/v1/vision/analyze', postVisionAnalyze);
router.post('/api/v1/translate', postTranslate);
router.post('/api/v1/translate/image', postTranslateImage);

