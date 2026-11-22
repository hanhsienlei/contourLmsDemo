const ALLOWED_HOSTS = ['localhost', '127.0.0.1']

export function assertLocalSupabaseUrl(url: string): void {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    throw new Error(`Refusing to run: "${url}" is not a valid URL`)
  }
  if (!ALLOWED_HOSTS.includes(hostname)) {
    throw new Error(`Refusing to run against non-local Supabase host "${hostname}"`)
  }
}
