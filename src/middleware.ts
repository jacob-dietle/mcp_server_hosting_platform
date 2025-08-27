import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

// Define protected routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/admin']

// Define protected API routes that require authentication but return 401 instead of redirecting
const PROTECTED_API_ROUTES = ['/api/agents', '/api/runtime', '/api/deployments', '/api/railway']

// Define public routes that should NEVER require authentication
const PUBLIC_ROUTES = [
  '/terms', 
  '/privacy', 
  '/auth', 
  '/', 
  '/sprint', 
  '/design-partner',
  '/api/health',        // Health checks should be public
  '/api/health/',       // Health checks should be public
  '/api/runtime-info'   // Runtime info should be public
]

export async function middleware(req: NextRequest) {
  // Always allow access to public routes - NO AUTH CHECKS
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    req.nextUrl.pathname === route || req.nextUrl.pathname.startsWith(`${route}/`)
  )
  
  if (isPublicRoute) {
    return NextResponse.next() // Skip all auth logic for public routes
  }
  
  // Handle Supabase session for protected routes only
  const supabaseResponse = await updateSession(req)
  
  // Check if current route is protected (UI routes or API routes)
  const isProtectedUIRoute = PROTECTED_ROUTES.some(route => 
    req.nextUrl.pathname === route || req.nextUrl.pathname.startsWith(`${route}/`)
  )
  
  const isProtectedAPIRoute = PROTECTED_API_ROUTES.some(route => 
    req.nextUrl.pathname === route || req.nextUrl.pathname.startsWith(`${route}/`)
  )
  
  if (isProtectedUIRoute || isProtectedAPIRoute) {
    // Get Supabase session to check if user is authenticated
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return req.cookies.get(name)?.value
          },
          set() {}, // No-op as we're using supabaseResponse
          remove() {}, // No-op as we're using supabaseResponse
        },
      }
    )
    
    // Get the user if they're logged in
    const { data, error } = await supabase.auth.getUser()
    
    if (error || !data.user) {
      if (isProtectedAPIRoute) {
        // For API routes, return 401 Unauthorized
        return new NextResponse(
          JSON.stringify({ 
            error: 'Unauthorized',
            message: 'Authentication required to access this API endpoint'
          }),
          { 
            status: 401, 
            headers: { 'Content-Type': 'application/json' } 
          }
        )
      } else {
        // For UI routes, redirect to login
        const redirectUrl = new URL('/auth/login', req.url)
        // Add the original URL as a next parameter (consistent with callback routes)
        redirectUrl.searchParams.set('next', req.nextUrl.pathname)
        return NextResponse.redirect(redirectUrl)
      }
    }
  }
  
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
