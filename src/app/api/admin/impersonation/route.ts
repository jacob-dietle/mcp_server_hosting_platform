// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminImpersonationService } from '@/lib/admin/server'
import logger from '@/lib/logger'

// Start impersonation session
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Admin impersonation start request', { requestId })
    
    // Get authenticated admin user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('Unauthenticated impersonation request', { requestId, error: authError?.message })
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { target_user_id } = body

    if (!target_user_id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Target user ID is required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 400 })
    }

    // Start impersonation session
    const session = await adminImpersonationService.startImpersonation(
      user.id,
      target_user_id
    )

    const duration = Date.now() - startTime
    logger.info('Admin impersonation started successfully', {
      requestId,
      adminUserId: user.id,
      targetUserId: target_user_id,
      sessionToken: session.session_token,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        session: {
          admin_user_id: session.admin_user_id,
          impersonated_user_id: session.impersonated_user_id,
          impersonated_user_email: session.impersonated_user_email,
          started_at: session.started_at,
          expires_at: session.expires_at,
          session_token: session.session_token
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Failed to start admin impersonation', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

// End impersonation session
export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Admin impersonation end request', { requestId })
    
    // Get session token from query params
    const { searchParams } = new URL(request.url)
    const sessionToken = searchParams.get('session_token')

    if (!sessionToken) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Session token is required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 400 })
    }

    // End impersonation session
    await adminImpersonationService.endImpersonation(sessionToken)

    const duration = Date.now() - startTime
    logger.info('Admin impersonation ended successfully', {
      requestId,
      sessionToken,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'Impersonation session ended successfully'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Failed to end admin impersonation', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

// Get impersonation candidates
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Admin impersonation candidates request', { requestId })
    
    // Get authenticated admin user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('Unauthenticated impersonation candidates request', { requestId, error: authError?.message })
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 401 })
    }

    // Get impersonation candidates
    const candidates = await adminImpersonationService.getImpersonationCandidates()

    const duration = Date.now() - startTime
    logger.info('Admin impersonation candidates retrieved successfully', {
      requestId,
      adminUserId: user.id,
      candidateCount: {
        no_trial: candidates.no_trial.length,
        pending_trial: candidates.pending_trial.length,
        active_trial: candidates.active_trial.length,
        expired_trial: candidates.expired_trial.length
      },
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        candidates
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Failed to get admin impersonation candidates', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
} 
