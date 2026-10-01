import { Router } from 'express';
import {
  getApiInfo,
  getHealth,
  getRoot,
} from '../controllers/healthController.js';
import { postAssistantMessage } from '../controllers/assistantController.js';

export const router = Router();

router.get('/', getRoot);
router.get('/health', getHealth);
router.get('/api/v1', getApiInfo);
router.post('/api/v1/assistant/message', postAssistantMessage);
