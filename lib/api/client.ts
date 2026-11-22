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
  const data = await res.json().catch(() => null)
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
