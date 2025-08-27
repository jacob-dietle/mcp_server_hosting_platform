// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import { trialApplicationService } from '@/lib/trial'
import logger from '@/lib/logger'
import type { 
  ListExpiringTrialsRequest, 
  ListExpiringTrialsResponse 
} from '@/contracts/api-contracts'

export async function GET(request: NextRequest): Promise<NextResponse<ListExpiringTrialsResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Admin expiring trials request started', { requestId })
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin expiring trials request', { requestId, error: authError?.message })
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
      logger.warn('Insufficient permissions for expiring trials list', { 
        requestId, 
        userId: user.id,
        requiredPermission: 'manage_trials'
      })
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to view expiring trials'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const daysUntilExpiry = parseInt(searchParams.get('days_until_expiry') || '3')
    const includeConversionEligible = searchParams.get('include_conversion_eligible') === 'true'

    // Validate days_until_expiry parameter
    if (daysUntilExpiry < 0 || daysUntilExpiry > 30) {
      logger.warn('Invalid days_until_expiry parameter', { requestId, daysUntilExpiry })
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'days_until_expiry must be between 0 and 30'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 400 })
    }

    // Get expiring trials
    const expiringTrials = await trialApplicationService.getExpiringTrials(daysUntilExpiry)

    // Filter by conversion eligibility if requested
    const filteredTrials = includeConversionEligible 
      ? expiringTrials.filter(trial => trial.days_remaining > 0)
      : expiringTrials

    // Calculate summary statistics
    const summary = {
      total_expiring: filteredTrials.length,
      high_conversion_potential: filteredTrials.filter(trial => trial.conversion_likelihood === 'high').length,
      recommended_outreach: filteredTrials.filter(trial => 
        trial.conversion_likelihood === 'high' || 
        (trial.conversion_likelihood === 'medium' && trial.days_remaining <= 2)
      ).length
    }

    // Log the admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'list_expiring_trials',
      resource_type: 'deployment_trials',
      details: {
        days_until_expiry: daysUntilExpiry,
        include_conversion_eligible: includeConversionEligible,
        results_count: filteredTrials.length,
        summary
      },
      success: true
    })

    const duration = Date.now() - startTime
    logger.info('Admin expiring trials list completed successfully', {
      requestId,
      userId: user.id,
      daysUntilExpiry,
      resultsCount: filteredTrials.length,
      highConversionPotential: summary.high_conversion_potential,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        expiring_trials: filteredTrials,
        summary
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
          action: 'list_expiring_trials',
          resource_type: 'deployment_trials',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action error', { requestId, logError })
    }

    logger.error('Unexpected error in expiring trials list', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while fetching expiring trials'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}
