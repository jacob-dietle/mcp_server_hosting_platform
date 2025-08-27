import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trialApplicationService } from '@/lib/trial'
import { createDeploymentService } from '@/lib/deployment'
import logger from '@/lib/logger'
import type { 
  TrialStatusRequest, 
  TrialStatusResponse 
} from '@/contracts/api-contracts'

export async function GET(
  request: NextRequest,
  { params }: { params: { deploymentId: string } }
): Promise<NextResponse<TrialStatusResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const { deploymentId } = params
  
  try {
    logger.info('Trial status request started', { requestId, deploymentId })
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const includeUsageStats = searchParams.get('include_usage_stats') === 'true'
    
    // Initialize Supabase client and get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('Unauthenticated trial status request', { requestId, deploymentId, error: authError?.message })
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

    // Validate deployment exists and belongs to user
    const deploymentService = createDeploymentService()
    const deployment = await deploymentService.getDeployment(deploymentId)
    
    if (!deployment) {
      logger.warn('Deployment not found for trial status', { requestId, deploymentId, userId: user.id })
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Deployment not found'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 404 })
    }

    if (deployment.user_id !== user.id) {
      logger.warn('Unauthorized trial status access attempt', { requestId, deploymentId, userId: user.id, deploymentUserId: deployment.user_id })
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this deployment'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 403 })
    }

    // Get trial status
    const trialStatus = await trialApplicationService.getTrialStatusByDeployment(deploymentId, user.id)
    
    if (!trialStatus) {
      logger.info('No trial found for deployment', { requestId, deploymentId, userId: user.id })
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No trial found for this deployment'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 404 })
    }

    // Build response data
    const responseData: any = {
      trial: {
        id: trialStatus.id,
        status: trialStatus.status,
        trial_start: trialStatus.trial_start,
        trial_end: trialStatus.trial_end,
        days_remaining: trialStatus.days_remaining,
        deployment_id: deploymentId,
        conversion_eligible: trialStatus.conversion_eligible
      }
    }

    // Add usage stats if requested
    if (includeUsageStats) {
      // TODO: Implement actual usage tracking
      responseData.usage_stats = {
        requests_made: 0,
        requests_limit: 1000, // Default trial limit
        last_activity: null
      }
    }

    // Add conversion options if trial is active and eligible
    if (trialStatus.conversion_eligible) {
      responseData.conversion_options = {
        available_plans: [
          {
            id: 'starter',
            name: 'Starter Plan',
            // price: 29, // Removed pricing display
            features: [
              'Unlimited deployments',
              'Priority support',
              'Advanced monitoring',
              'Custom domains'
            ]
          },
          {
            id: 'professional',
            name: 'Professional Plan',
            // price: 99, // Removed pricing display
            features: [
              'Everything in Starter',
              'Team collaboration',
              'Advanced analytics',
              'SLA guarantee',
              'Dedicated support'
            ]
          }
        ]
      }

      // Add discount if trial is expiring soon
      if (trialStatus.days_remaining <= 3 && trialStatus.days_remaining > 0) {
        responseData.conversion_options.discount_available = {
          percentage: 20,
          expires_at: trialStatus.trial_end
        }
      }
    }

    const duration = Date.now() - startTime
    logger.info('Trial status retrieved successfully', {
      requestId,
      deploymentId,
      userId: user.id,
      trialStatus: trialStatus.status,
      daysRemaining: trialStatus.days_remaining,
      duration
    })

    return NextResponse.json({
      success: true,
      data: responseData,
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
      deploymentId,
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
