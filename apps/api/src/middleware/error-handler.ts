import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorResponse } from '@visionattend/shared';
import { AppError, NotFoundError } from '../lib/errors.js';

/** Errors raised by Express' body parser carry an HTTP status and a type. */
interface HttpParserError {
  status: number;
  type: string;
}

function isHttpParserError(error: unknown): error is HttpParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'type' in error &&
    typeof error.status === 'number'
  );
}

export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Route ${req.method} ${req.path} not found`);
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const requestId = String(req.id);
  const send = (status: number, body: ApiErrorResponse['error']) => {
    res.status(status).json({ error: { ...body, requestId } } satisfies ApiErrorResponse);
  };

  if (error instanceof AppError) {
    send(error.statusCode, { code: error.code, message: error.message, details: error.details });
    return;
  }

  if (error instanceof ZodError) {
    send(400, {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
    });
    return;
  }

  if (isHttpParserError(error) && error.status < 500) {
    const code = error.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'BAD_REQUEST';
    send(error.status, { code, message: 'Malformed request body' });
    return;
  }

  // Unexpected: log everything, reveal nothing.
  req.log.error({ err: error }, 'unhandled error');
  send(500, { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
};
