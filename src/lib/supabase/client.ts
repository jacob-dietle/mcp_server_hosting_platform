import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Simple implementation as per Supabase docs
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
