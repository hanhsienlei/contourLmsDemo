import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL must be set (proxy.ts needs it for the CSP connect-src directive)')
}

const nextConfig: NextConfig = {
  // Every route is per-user, so nothing is cached or prerendered across users;
  // the page guards are the access boundary.
  cacheComponents: false,
  // The Content-Security-Policy is set per request in proxy.ts, because it
  // carries a fresh nonce.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
