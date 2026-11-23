export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

/** Shown when the server gives no usable message. Says what happened, then what to do (UI spec §3.5). */
export const GENERIC_ERROR = 'Something went wrong. Try again in a moment.'

type Init = { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown }

export async function apiFetch<T>(path: string, init: Init = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  // A followed redirect (e.g. to the login page) or a non-JSON 2xx is never a
  // real API success.
  if (res.redirected) {
    throw new ApiClientError(401, 'unauthenticated', 'Your session has ended. Sign in again.')
  }
  const data = await res.json().catch(() => null)
  if (res.ok && !(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new ApiClientError(res.status, 'internal', GENERIC_ERROR)
  }
  if (!res.ok) {
    const e = data?.error
    throw new ApiClientError(
      res.status,
      typeof e?.code === 'string' ? e.code : 'internal',
      typeof e?.message === 'string' && res.status < 500 ? e.message : GENERIC_ERROR,
    )
  }
  return data as T
}
