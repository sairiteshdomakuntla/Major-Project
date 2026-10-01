import type { NextFunction, Request, Response } from 'express';

// 404 handler — must be registered after all routes.
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      message: 'Not Found',
      statusCode: 404,
    },
  });
}

// Centralized error handler — must be registered last with 4 args.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Malformed JSON bodies (thrown by express.json) → 400, not 500.
  if (
    err instanceof SyntaxError &&
    typeof err === 'object' &&
    'status' in err &&
    (err as { status: unknown }).status === 400
  ) {
    res.status(400).json({
      error: { message: 'Request body must be valid JSON.', statusCode: 400 },
    });
    return;
  }

  const statusCode =
    typeof err === 'object' && err !== null && 'statusCode' in err
      ? Number((err as { statusCode: unknown }).statusCode) || 500
      : 500;

  const message =
    err instanceof Error ? err.message : 'Internal Server Error';

  if (process.env.NODE_ENV !== 'test') {
    // Keep logging minimal; morgan already logs requests.
    console.error('[error]', message);
  }

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
    },
  });
}
