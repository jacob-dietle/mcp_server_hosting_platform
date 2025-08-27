import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Only allow this in development/preview - NOT production
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV?.includes('preview')) {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  return NextResponse.json({
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...',
    },
    timestamp: new Date().toISOString()
  })
} 