// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import { trialApplicationService } from '@/lib/trial'
import logger from '@/lib/logger'
import type { 
  ApproveTrialRequest, 
  ApproveTrialResponse 
} from '@/contracts/api-contracts'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApproveTrialResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const { id: applicationId } = params
  
  try {
    logger.info('Admin trial approval request started', { requestId, applicationId })
    
    // Parse request body
    const body: ApproveTrialRequest = await request.json().catch(() => ({}))
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin trial approval request', { requestId, applicationId, error: authError?.message })
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

    // Require admin access
    const roleInfo = await adminAuthService.requireAdminAccess(user.id)
    
    // Check specific permission for trial management
    const hasTrialManagementPermission = await adminAuthService.hasPermission('manage_trials', user.id)
    if (!hasTrialManagementPermission) {
      logger.warn('Insufficient permissions for trial approval', { 
        requestId, 
        applicationId,
        userId: user.id,
        requiredPermission: 'manage_trials'
      })
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to approve trials'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 403 })
    }

    // Validate trial application exists and is pending
    const existingApplication = await trialApplicationService.getTrialApplication(applicationId)
    if (!existingApplication) {
      logger.warn('Trial application not found for approval', { requestId, applicationId, userId: user.id })
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Trial application not found'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 404 })
    }

    if (existingApplication.status !== 'pending') {
      logger.warn('Trial application not in pending status for approval', { 
        requestId, 
        applicationId, 
        userId: user.id,
        currentStatus: existingApplication.status 
      })
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Trial application is ${existingApplication.status} and cannot be approved`
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 400 })
    }

    // Approve the trial application
    const { application, deploymentTrial } = await trialApplicationService.approveTrialApplication(
      applicationId,
      user.id,
      {
        trialDurationDays: body.trial_duration_days || 7,
        customMessage: body.custom_message
      }
    )

    // Log the admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'approve_trial_application',
      resource_type: 'trial_applications',
      resource_id: applicationId,
      details: {
        trial_duration_days: body.trial_duration_days || 7,
        custom_message: body.custom_message,
        priority_deployment: body.priority_deployment || false,
        deployment_trial_id: deploymentTrial.id
      },
      success: true
    })

    const duration = Date.now() - startTime
    logger.info('Trial application approved successfully', {
      requestId,
      applicationId,
      adminUserId: user.id,
      trialDurationDays: body.trial_duration_days || 7,
      deploymentTrialId: deploymentTrial.id,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        trial_application: {
          id: application.id,
          status: 'approved' as const,
          approved_at: application.reviewed_at!,
          approved_by: user.id
        },
        deployment_trial: {
          id: deploymentTrial.id,
          trial_start: deploymentTrial.trial_start,
          trial_end: deploymentTrial.trial_end,
          trial_duration_days: body.trial_duration_days || 7
        },
        next_steps: {
          deployment_instructions: 'The user can now create their trial deployment through the dashboard.',
          trial_guidelines: [
            'Trial is limited to 7 days by default',
            'User will receive email notifications about trial status',
            'Conversion prompts will be shown 3 days before expiry',
            'Admin can extend trial if needed'
          ]
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
    
    // Log failed admin action
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await adminAuthService.logAdminAction({
          user_id: user.id,
          action: 'approve_trial_application',
          resource_type: 'trial_applications',
          resource_id: applicationId,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action error', { requestId, applicationId, logError })
    }

    logger.error('Unexpected error in trial approval', { 
      requestId, 
      applicationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while approving the trial application'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}
