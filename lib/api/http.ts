import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

export type ApiErrorCode =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'internal';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errors = {
  validation: (msg: string) => new ApiError(400, 'validation', msg),
  unauthenticated: () => new ApiError(401, 'unauthenticated', 'Authentication required'),
  forbidden: () => new ApiError(403, 'forbidden', 'Forbidden'),
  notFound: () => new ApiError(404, 'not_found', 'Not found'),
  conflict: (msg: string) => new ApiError(409, 'conflict', msg),
};

export function mapDbError(e: { code?: string; message: string }): ApiError {
  if (e.code === '23505') return errors.conflict('That time slot is already booked');
  if (e.code === '22P02') return errors.validation('Invalid id');
  console.error(e);
  return new ApiError(500, 'internal', 'Something went wrong');
}

export function assertSameOrigin(req: Request): void {
  const type = req.headers.get('content-type') ?? '';
  const origin = req.headers.get('origin');
  if (!type.toLowerCase().startsWith('application/json')) throw errors.forbidden();
  if (!origin || origin !== new URL(req.url).origin) throw errors.forbidden();
}

export async function parseJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw errors.validation('Invalid JSON body');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw errors.validation(result.error.issues[0]?.message ?? 'Invalid request');
  }
  return result.data;
}

function errorResponse(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handle<A extends unknown[]>(
  fn: (...a: A) => Promise<Response>,
): (...a: A) => Promise<Response> {
  return async (...a: A) => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e.status, e.code, e.message);
      if (e instanceof ZodError) {
        return errorResponse(400, 'validation', e.issues[0]?.message ?? 'Invalid request');
      }
      console.error(e);
      return errorResponse(500, 'internal', 'Something went wrong');
    }
  };
}
