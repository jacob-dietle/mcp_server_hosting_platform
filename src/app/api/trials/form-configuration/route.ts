import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trialApplicationService } from '@/lib/trial'
import logger from '@/lib/logger'

// GET /api/trials/form-configuration - Get active form configuration
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Form configuration request started', { requestId })
    
    // Initialize Supabase client and get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('Unauthenticated form configuration request', { requestId, error: authError?.message })
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to view form configuration'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 401 })
    }

    // Get active form configuration
    const formConfiguration = await trialApplicationService.getActiveFormConfiguration()
    
    if (!formConfiguration) {
      logger.warn('No active form configuration found', { requestId, userId: user.id })
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No active form configuration available. Please contact support.'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 404 })
    }

    const duration = Date.now() - startTime
    logger.info('Form configuration retrieved successfully', {
      requestId,
      userId: user.id,
      formId: formConfiguration.id,
      questionCount: formConfiguration.questions.length,
      duration
    })

    return NextResponse.json({
      success: true,
      configuration: formConfiguration,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Unexpected error in form configuration retrieval', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while retrieving form configuration'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}
