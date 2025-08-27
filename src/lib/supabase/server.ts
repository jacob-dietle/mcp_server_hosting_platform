import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient(options = { schema: 'auth_logic' }) {
  const cookieStore = await cookies()
  
  console.log(`[createClient] Creating Supabase client with schema: ${options.schema}`)

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      db: {
        schema: options.schema
      }
    }
  )
}

// Admin client with service role key for auth.admin operations
export function createAdminClient(options = { schema: 'auth_logic' }) {
  console.log(`[createAdminClient] Creating Supabase admin client with schema: ${options.schema}`)
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations')
  }

  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: options.schema },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      }
    }
  )
}

export async function createDatasetClient() {
  return createClient({ schema: 'public' })
}
