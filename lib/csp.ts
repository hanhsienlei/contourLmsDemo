/** A fresh, unguessable nonce for one response. */
export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

/**
 * The Content-Security-Policy for one response. Scripts run only with this
 * response's nonce ('strict-dynamic' lets those scripts load Next.js chunks),
 * so an injected inline script can't run and read the JS-readable session
 * cookie. Next.js finds the nonce in the request's CSP header and adds it to
 * its own scripts.
 *
 * Styles still allow 'unsafe-inline': Radix and Sonner set inline style
 * attributes, which a nonce can't cover. Injected CSS can't run script.
 */
export function buildCsp(nonce: string, opts: { isDev: boolean; supabaseUrl: string }): string {
  return [
    "default-src 'self'",
    // React uses eval in development only, for better error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${opts.supabaseUrl}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** The nonce in a CSP header built by buildCsp, for code that must pass it on by hand. */
export function extractNonce(csp: string | null): string | undefined {
  return csp?.match(/'nonce-([^']+)'/)?.[1]
}
