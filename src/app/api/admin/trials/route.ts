// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import { trialApplicationService } from '@/lib/trial'
import logger from '@/lib/logger'
import type { 
  ListAdminTrialsRequest, 
  ListAdminTrialsResponse 
} from '@/contracts/api-contracts'

export async function GET(request: NextRequest): Promise<NextResponse<ListAdminTrialsResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Admin trials list request started', { requestId })
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin trials request', { requestId, error: authError?.message })
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
      logger.warn('Insufficient permissions for admin trials list', { 
        requestId, 
        userId: user.id,
        requiredPermission: 'manage_trials'
      })
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to manage trials'
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
    const filters = {
      status: searchParams.get('status') as any,
      applied_date_from: searchParams.get('applied_date_from'),
      applied_date_to: searchParams.get('applied_date_to'),
      auto_qualification_score_min: searchParams.get('auto_qualification_score_min') ? 
        parseInt(searchParams.get('auto_qualification_score_min')!) : undefined,
      auto_qualification_score_max: searchParams.get('auto_qualification_score_max') ? 
        parseInt(searchParams.get('auto_qualification_score_max')!) : undefined,
      mcp_server_type: searchParams.get('mcp_server_type'),
      sort_by: searchParams.get('sort_by') || 'applied_at',
      sort_order: searchParams.get('sort_order') || 'desc'
    }

    const pagination = {
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    }

    // Validate pagination parameters
    if (pagination.limit > 100) {
      pagination.limit = 100 // Max limit
    }
    if (pagination.limit < 1) {
      pagination.limit = 20 // Default limit
    }

    // Get trial applications
    const { applications, total } = await trialApplicationService.listTrialApplicationsForAdmin(
      filters,
      pagination
    )

    // Log the admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'list_trial_applications',
      resource_type: 'trial_applications',
      details: {
        filters,
        pagination,
        results_count: applications.length,
        total_count: total
      },
      success: true
    })

    const duration = Date.now() - startTime
    logger.info('Admin trials list completed successfully', {
      requestId,
      userId: user.id,
      resultsCount: applications.length,
      totalCount: total,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        data: applications,
        pagination: {
          page: Math.floor(pagination.offset / pagination.limit) + 1,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit)
        
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
          action: 'list_trial_applications',
          resource_type: 'trial_applications',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action error', { requestId, logError })
    }

    logger.error('Unexpected error in admin trials list', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while fetching trial applications'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}
