// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import { trialApplicationService } from '@/lib/trial'
import logger from '@/lib/logger'
import type { 
  RejectTrialRequest, 
  RejectTrialResponse 
} from '@/contracts/api-contracts'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<RejectTrialResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const { id: applicationId } = params
  
  try {
    logger.info('Admin trial rejection request started', { requestId, applicationId })
    
    // Parse request body
    const body: RejectTrialRequest = await request.json()
    
    // Validate required fields
    if (!body.rejection_reason || body.rejection_reason.trim() === '') {
      logger.warn('Invalid trial rejection request - missing rejection reason', { requestId, applicationId })
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Rejection reason is required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 400 })
    }
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin trial rejection request', { requestId, applicationId, error: authError?.message })
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
      logger.warn('Insufficient permissions for trial rejection', { 
        requestId, 
        applicationId,
        userId: user.id,
        requiredPermission: 'manage_trials'
      })
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to reject trials'
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
      logger.warn('Trial application not found for rejection', { requestId, applicationId, userId: user.id })
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
      logger.warn('Trial application not in pending status for rejection', { 
        requestId, 
        applicationId, 
        userId: user.id,
        currentStatus: existingApplication.status 
      })
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Trial application is ${existingApplication.status} and cannot be rejected`
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 400 })
    }

    // Reject the trial application
    const application = await trialApplicationService.rejectTrialApplication(
      applicationId,
      user.id,
      body.rejection_reason,
      {
        customMessage: body.custom_message,
        reapplicationAllowed: body.reapplication_allowed !== false // Default to true
      }
    )

    // Calculate reapplication date if allowed
    let reapplicationDate: string | undefined
    if (body.reapplication_allowed !== false) {
      const waitDays = body.reapplication_wait_days || 30 // Default 30 days
      const reapplicationDateObj = new Date()
      reapplicationDateObj.setDate(reapplicationDateObj.getDate() + waitDays)
      reapplicationDate = reapplicationDateObj.toISOString()
    }

    // Log the admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'reject_trial_application',
      resource_type: 'trial_applications',
      resource_id: applicationId,
      details: {
        rejection_reason: body.rejection_reason,
        custom_message: body.custom_message,
        reapplication_allowed: body.reapplication_allowed !== false,
        reapplication_wait_days: body.reapplication_wait_days || 30,
        reapplication_date: reapplicationDate
      },
      success: true
    })

    const duration = Date.now() - startTime
    logger.info('Trial application rejected successfully', {
      requestId,
      applicationId,
      adminUserId: user.id,
      rejectionReason: body.rejection_reason,
      reapplicationAllowed: body.reapplication_allowed !== false,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        trial_application: {
          id: application.id,
          status: 'rejected' as const,
          rejected_at: application.reviewed_at!,
          rejected_by: user.id,
          rejection_reason: body.rejection_reason
        },
        user_notification: {
          sent: true, // TODO: Implement actual email notification
          reapplication_date: reapplicationDate
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
          action: 'reject_trial_application',
          resource_type: 'trial_applications',
          resource_id: applicationId,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action error', { requestId, applicationId, logError })
    }

    logger.error('Unexpected error in trial rejection', { 
      requestId, 
      applicationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while rejecting the trial application'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}
