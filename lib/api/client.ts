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
    throw new ApiClientError(401, 'unauthenticated', 'Please sign in again')
  }
  const data = await res.json().catch(() => null)
  if (res.ok && !(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new ApiClientError(res.status, 'internal', 'Something went wrong')
  }
  if (!res.ok) {
    const e = data?.error
    throw new ApiClientError(
      res.status,
      typeof e?.code === 'string' ? e.code : 'internal',
      typeof e?.message === 'string' ? e.message : 'Something went wrong',
    )
  }
  return data as T
}
