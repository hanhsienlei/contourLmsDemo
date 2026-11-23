import { updateSession } from '@/lib/supabase/proxy'
import { buildCsp, createNonce } from '@/lib/csp'
import { type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // A new nonce per request. Next.js reads it from the request's CSP header and
  // puts it on its own scripts; the browser enforces the response's copy.
  const csp = buildCsp(createNonce(), {
    isDev: process.env.NODE_ENV === 'development',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  })
  const response = await updateSession(request, { 'Content-Security-Policy': csp })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
