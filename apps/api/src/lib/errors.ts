/**
 * Expected, client-facing errors. Anything else that reaches the error
 * handler is treated as an unexpected 500 and its details are not exposed.
 */
export class AppError extends Error {
  override readonly name = 'AppError';

  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}
