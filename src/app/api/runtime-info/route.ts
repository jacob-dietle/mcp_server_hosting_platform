import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    environment: process.env.NODE_ENV || 'development',
    runtime: 'nodejs',
    platform: process.platform,
    nodeVersion: process.version,
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal
    },
    timestamp: new Date().toISOString()
  })
}