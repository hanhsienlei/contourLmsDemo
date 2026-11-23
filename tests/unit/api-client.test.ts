import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError, GENERIC_ERROR, apiFetch } from '@/lib/api/client'

function stubFetch(res: Response) {
  const fn = vi.fn().mockResolvedValue(res)
  vi.stubGlobal('fetch', fn)
  return fn
}

async function rejection(p: Promise<unknown>): Promise<ApiClientError> {
  return p.then(
    () => {
      throw new Error('expected rejection')
    },
    (e: ApiClientError) => e,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('resolves to the body on 2xx and sends JSON', async () => {
    const fn = stubFetch(Response.json({ item: { id: '1' } }, { status: 201 }))
    const out = await apiFetch<{ item: { id: string } }>('/api/consultations', {
      method: 'POST',
      body: { reason: 'x' },
    })
    expect(out).toEqual({ item: { id: '1' } })
    const [path, init] = fn.mock.calls[0]
    expect(path).toBe('/api/consultations')
    expect(init.method).toBe('POST')
    expect(init.headers['content-type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ reason: 'x' }))
  })

  it('throws ApiClientError from the error body on 409', async () => {
    stubFetch(
      Response.json(
        { error: { code: 'conflict', message: 'That time slot is already booked' } },
        { status: 409 },
      ),
    )
    const err = await rejection(apiFetch('/api/consultations'))
    expect(err).toBeInstanceOf(ApiClientError)
    expect(err.status).toBe(409)
    expect(err.code).toBe('conflict')
    expect(err.message).toBe('That time slot is already booked')
  })

  it('throws code internal for a non-JSON 500', async () => {
    stubFetch(new Response('<html>boom</html>', { status: 500 }))
    const err = await rejection(apiFetch('/api/consultations'))
    expect(err).toBeInstanceOf(ApiClientError)
    expect(err.status).toBe(500)
    expect(err.code).toBe('internal')
    expect(err.message).toBe(GENERIC_ERROR)
  })

  it('shows the generic next-step message for a JSON 5xx, not the server text', async () => {
    stubFetch(Response.json({ error: { code: 'internal', message: 'Something went wrong' } }, { status: 500 }))
    const err = await rejection(apiFetch('/api/consultations'))
    expect(err.code).toBe('internal')
    expect(err.message).toBe(GENERIC_ERROR)
  })

  it('rejects when the response was redirected (signed out)', async () => {
    const res = new Response('<html>login</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
    Object.defineProperty(res, 'redirected', { value: true })
    stubFetch(res)
    const err = await rejection(apiFetch('/api/consultations', { method: 'POST', body: {} }))
    expect(err).toBeInstanceOf(ApiClientError)
    expect(err.status).toBe(401)
    expect(err.code).toBe('unauthenticated')
    expect(err.message).not.toMatch(/please/i)
  })

  it('rejects a 2xx that is not JSON', async () => {
    stubFetch(new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    const err = await rejection(apiFetch('/api/consultations'))
    expect(err.code).toBe('internal')
  })
})
