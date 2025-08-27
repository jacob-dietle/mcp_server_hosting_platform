// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import { createFormConfigurationService } from '@/lib/trial'
import logger from '@/lib/logger'

// POST /api/admin/form-configurations/[id]/activate - Activate form configuration
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const { id: configId } = params
  
  try {
    logger.info('Admin form configuration activation request started', { requestId, configId })
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin form configuration activation request', { requestId, configId, error: authError?.message })
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
    await adminAuthService.requireAdminAccess(user.id)
    
    // Check specific permission for trial management
    const hasTrialManagementPermission = await adminAuthService.hasPermission('manage_trials', user.id)
    if (!hasTrialManagementPermission) {
      logger.warn('Insufficient permissions for form configuration activation', { 
        requestId, 
        configId,
        userId: user.id,
        requiredPermission: 'manage_trials'
      })
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to manage form configurations'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 403 })
    }

    // Activate form configuration
    const formConfigService = createFormConfigurationService()
    const configuration = await formConfigService.activateFormConfiguration(configId, user.id)

    // Log the admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'activate_form_configuration',
      resource_type: 'form_configurations',
      resource_id: configId,
      details: {
        name: configuration.name,
        version: configuration.version
      },
      success: true
    })

    const duration = Date.now() - startTime
    logger.info('Form configuration activated successfully', {
      requestId,
      userId: user.id,
      configId,
      name: configuration.name,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        configuration
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
          action: 'activate_form_configuration',
          resource_type: 'form_configurations',
          resource_id: configId,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action error', { requestId, configId, logError })
    }

    logger.error('Unexpected error in form configuration activation', { 
      requestId,
      configId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while activating form configuration'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
} 