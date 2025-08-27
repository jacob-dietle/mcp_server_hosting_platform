
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trialApplicationService } from '@/lib/trial'
import logger from '@/lib/logger'
import type { 
  TrialApplicationRequest, 
  TrialApplicationResponse 
} from '@/contracts/api-contracts'

export async function POST(request: NextRequest): Promise<NextResponse<TrialApplicationResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Trial application request started', { requestId })
    
    // Parse request body
    const body: TrialApplicationRequest = await request.json()
    
    // Log the received data for debugging
    logger.info('Trial application request body', { 
      requestId, 
      body,
      qualificationAnswersKeys: body.qualification_answers ? Object.keys(body.qualification_answers) : []
    })
    
    // Validate required fields
    if (!body.mcp_server_type || !body.qualification_answers) {
      logger.warn('Invalid trial application request - missing required fields', { requestId })
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: mcp_server_type and qualification_answers are required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 400 })
    }

    // Validate that we have qualification answers (dynamic validation)
    const { qualification_answers } = body
    
    if (!qualification_answers || typeof qualification_answers !== 'object') {
      logger.warn('Invalid qualification answers structure', { requestId })
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Qualification answers must be a valid object'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 400 })
    }

    // Validate against the active form configuration
    const formConfig = await trialApplicationService.getActiveFormConfiguration()
    if (!formConfig) {
      logger.warn('No active form configuration found', { requestId })
      return NextResponse.json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'No active form configuration available'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 500 })
    }

    // Validate required fields based on form configuration
    const requiredQuestions = formConfig.questions.filter(q => q.required)
    const missingFields = requiredQuestions
      .filter(q => {
        const value = (qualification_answers as any)[q.id]
        return !value || value === '' || (Array.isArray(value) && value.length === 0)
      })
      .map(q => q.label)
    
    if (missingFields.length > 0) {
      logger.warn('Missing required form fields', { requestId, missingFields })
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Please complete all required fields: ${missingFields.join(', ')}`
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 400 })
    }

    // Initialize Supabase client and get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('Unauthenticated trial application request', { requestId, error: authError?.message })
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to apply for trial'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 401 })
    }

    // Check for impersonation headers
    const impersonationSession = request.headers.get('X-Impersonation-Session')
    const impersonatedUserId = request.headers.get('X-Impersonated-User-Id')
    
    let effectiveUserId = user.id
    let isImpersonating = false
    
    if (impersonationSession && impersonatedUserId) {
      effectiveUserId = impersonatedUserId
      isImpersonating = true
      logger.info('Impersonation detected for trial application', { 
        requestId,
        adminUserId: user.id,
        impersonatedUserId
      })
    }

    // Submit trial application
    const { application, qualificationScore } = await trialApplicationService.submitTrialApplication(
      effectiveUserId,
      body
    )

    // Determine next steps based on auto-qualification result
    const nextSteps = qualificationScore.auto_approved 
      ? {
          message: 'Congratulations! Your trial has been automatically approved. You can now create your deployment.',
          action_required: true,
          estimated_approval_time: undefined
        }
      : {
          message: 'Your trial application is under review. We\'ll notify you once it\'s been processed.',
          action_required: false,
          estimated_approval_time: '1-2 business days'
        }

    const duration = Date.now() - startTime
    logger.info('Trial application completed successfully', {
      requestId,
      userId: user.id,
      effectiveUserId,
      isImpersonating,
      applicationId: application.id,
      autoApproved: qualificationScore.auto_approved,
      qualificationScore: qualificationScore.total_score,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        application: {
          id: application.id,
          status: application.status,
          auto_qualification_score: qualificationScore.total_score,
          applied_at: application.applied_at,
          estimated_review_time: nextSteps.estimated_approval_time
        },
        next_steps: nextSteps
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    
    // Handle rate limiting errors
    if (error instanceof Error && error.message.includes('trial every')) {
      logger.warn('Trial application rate limited', { requestId, error: error.message, duration })
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 429 })
    }

    // Handle validation errors
    if (error instanceof Error && error.message.includes('not allowed')) {
      logger.warn('Trial application not allowed', { requestId, error: error.message, duration })
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: error.message
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 403 })
    }

    // Handle unexpected errors
    logger.error('Unexpected error in trial application', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while processing your trial application'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

// Get trial application status
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Trial application status request started', { requestId })
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
         // Get authenticated user
     const supabase = await createClient()
     const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('Unauthenticated trial status request', { requestId, error: authError?.message })
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to check trial status'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 401 })
    }

    // Check for impersonation headers
    const impersonationSession = request.headers.get('X-Impersonation-Session')
    const impersonatedUserId = request.headers.get('X-Impersonated-User-Id')
    
    let effectiveUserId = userId || user.id
    let isImpersonating = false
    
    if (impersonationSession && impersonatedUserId) {
      effectiveUserId = impersonatedUserId
      isImpersonating = true
      logger.info('Impersonation detected for trial status check', { 
        requestId,
        adminUserId: user.id,
        impersonatedUserId
      })
    }
    
    // Use effective user ID for data access
    const targetUserId = effectiveUserId
    
         // Get trial application status - find the most recent application for this user
     const supabaseForQuery = await createClient()
     const { data: applications, error: queryError } = await supabaseForQuery
       .from('trial_applications')
       .select('*')
       .eq('user_id', targetUserId)
       .order('applied_at', { ascending: false })
       .limit(1)
     
     if (queryError) {
       throw new Error('Failed to retrieve trial application status')
     }
     
     const application = applications && applications.length > 0 ? applications[0] : null
    
    const duration = Date.now() - startTime
    logger.info('Trial application status retrieved successfully', {
      requestId,
      userId: user.id,
      effectiveUserId,
      isImpersonating,
      targetUserId,
      hasApplication: !!application,
      duration
    })
    
    return NextResponse.json({
      success: true,
      data: {
        application: application ? {
          id: application.id,
          status: application.status,
          applied_at: application.applied_at,
          approved_at: application.approved_at,
          auto_qualification_score: application.auto_qualification_score
        } : null
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Unexpected error in trial status check', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while checking trial status'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}
