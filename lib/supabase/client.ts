import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    // Fallback values prevent build-time throws when env vars aren't set yet.
    // Real values are required at runtime (see SETUP.md step 4).
    process.env.NEXT_PUBLIC_SUPABASE_URL    ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  )
}
