import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { ApiError, errors, mapDbError, assertSameOrigin, parseJson, handle } from '@/lib/api/http';

afterEach(() => vi.restoreAllMocks());

const mk = (headers: Record<string, string>, body?: string) =>
  new Request('http://localhost:3000/api/x', { method: 'POST', headers, body });

describe('mapDbError', () => {
  it('maps 23505 to conflict', () => {
    const e = mapDbError({ code: '23505', message: 'dup' });
    expect(e.status).toBe(409);
    expect(e.code).toBe('conflict');
  });
  it('maps 22P02 to 400', () => {
    expect(mapDbError({ code: '22P02', message: 'x' }).status).toBe(400);
  });
  it('hides unknown errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const e = mapDbError({ code: 'XX', message: 'secret raw' });
    expect(e.status).toBe(500);
    expect(e.message).not.toContain('secret');
    expect(spy).toHaveBeenCalled();
  });
});

describe('assertSameOrigin', () => {
  const json = 'application/json';
  it('passes for same origin json', () => {
    expect(() => assertSameOrigin(mk({ origin: 'http://localhost:3000', 'content-type': json }))).not.toThrow();
  });
  it('accepts charset suffix', () => {
    expect(() =>
      assertSameOrigin(mk({ origin: 'http://localhost:3000', 'content-type': 'application/json; charset=utf-8' })),
    ).not.toThrow();
  });
  it('rejects foreign origin', () => {
    expect(() => assertSameOrigin(mk({ origin: 'http://evil.test', 'content-type': json }))).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
  it('rejects missing origin', () => {
    expect(() => assertSameOrigin(mk({ 'content-type': json }))).toThrow(expect.objectContaining({ status: 403 }));
  });
  it('rejects text/plain', () => {
    expect(() => assertSameOrigin(mk({ origin: 'http://localhost:3000', 'content-type': 'text/plain' }))).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});

describe('parseJson', () => {
  const schema = z.object({ n: z.number('n must be a number') });
  it('parses valid body', async () => {
    expect(await parseJson(mk({}, '{"n":1}'), schema)).toEqual({ n: 1 });
  });
  it('rejects invalid JSON', async () => {
    await expect(parseJson(mk({}, '{bad'), schema)).rejects.toMatchObject({ status: 400, message: 'Invalid JSON body' });
  });
  it('rejects schema failure with first issue', async () => {
    await expect(parseJson(mk({}, '{"n":"a"}'), schema)).rejects.toMatchObject({
      status: 400,
      code: 'validation',
      message: 'n must be a number',
    });
  });
});

describe('handle', () => {
  it('serializes ApiError', async () => {
    const res = await handle(async () => {
      throw errors.notFound();
    })();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
  });
  it('maps ZodError to 400', async () => {
    const res = await handle(async () => {
      z.string().parse(1);
      return new Response();
    })();
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('validation');
  });
  it('hides unknown errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handle(async () => {
      throw new Error('db password leaked');
    })();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('leaked');
    expect(spy).toHaveBeenCalled();
  });
  it('passes through success', async () => {
    const res = await handle(async (x: number) => Response.json({ x }))(5);
    expect(await res.json()).toEqual({ x: 5 });
  });
});
