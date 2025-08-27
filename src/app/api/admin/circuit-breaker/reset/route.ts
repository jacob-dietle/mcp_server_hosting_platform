import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { railwayApiCircuitBreaker, supabaseCircuitBreaker } from '@/lib/error-handling'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    // Verify admin authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has admin role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || userRole?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Get request body
    const body = await request.json()
    const { service } = body

    // Reset the appropriate circuit breaker
    if (service === 'railway') {
      railwayApiCircuitBreaker.reset()
      console.log(`[${requestId}] Railway API circuit breaker reset by admin:`, user.email)
    } else if (service === 'supabase') {
      supabaseCircuitBreaker.reset()
      console.log(`[${requestId}] Supabase circuit breaker reset by admin:`, user.email)
    } else if (service === 'all') {
      railwayApiCircuitBreaker.reset()
      supabaseCircuitBreaker.reset()
      console.log(`[${requestId}] All circuit breakers reset by admin:`, user.email)
    } else {
      return NextResponse.json(
        { error: 'Invalid service. Must be "railway", "supabase", or "all"' },
        { status: 400 }
      )
    }

    // Return current states
    return NextResponse.json({
      success: true,
      states: {
        railway: railwayApiCircuitBreaker.getState(),
        supabase: supabaseCircuitBreaker.getState()
      }
    })

  } catch (error) {
    console.error(`[${requestId}] Circuit breaker reset failed:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
