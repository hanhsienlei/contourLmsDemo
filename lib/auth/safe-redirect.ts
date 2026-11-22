// Any ASCII control character or a backslash. Browsers strip tab/CR/LF from
// URLs and treat "\" like "/", so "/\t/evil.com" or "/\evil.com" would become
// the protocol-relative "//evil.com".
const UNSAFE_CHARS = /[\u0000-\u001f\u007f\\]/;
const BASE = 'http://same-origin.invalid';

/**
 * Returns `next` only when it is a same-site relative path; otherwise "/".
 * Used for post-auth redirects so a crafted link can't send users off-site.
 */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || UNSAFE_CHARS.test(next)) return '/';
  const url = new URL(next, BASE);
  if (url.origin !== BASE) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}
