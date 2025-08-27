import { NextResponse } from 'next/server'

export async function GET() {
  // Simple, fast health check - no auth, no database, no external calls
  const response = NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'mcp-gtm-command-center',
    version: process.env.npm_package_version || '1.0.0'
  })
  
  // Add cache headers to reduce unnecessary requests
  response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30') // Cache for 60 seconds
  response.headers.set('X-Health-Check', 'true')
  
  return response
}