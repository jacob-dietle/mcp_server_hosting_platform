// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import { createFormConfigurationService } from '@/lib/trial'
import logger from '@/lib/logger'
import type { 
  UpdateFormConfigurationRequest
} from '@/lib/trial'
import type { FormConfiguration } from '@/lib/trial'

// GET /api/admin/form-configurations/[id] - Get specific form configuration
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const { id: configId } = params
  
  try {
    logger.info('Admin form configuration detail request started', { requestId, configId })
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin form configuration request', { requestId, configId, error: authError?.message })
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
      logger.warn('Insufficient permissions for form configuration detail', { 
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

    // Get form configuration
    const formConfigService = createFormConfigurationService()
    const configuration = await formConfigService.getFormConfiguration(configId)

    if (!configuration) {
      logger.warn('Form configuration not found', { requestId, configId, userId: user.id })
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Form configuration not found'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 404 })
    }

    const duration = Date.now() - startTime
    logger.info('Form configuration detail retrieved successfully', {
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
    logger.error('Unexpected error in form configuration detail', { 
      requestId,
      configId,
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

// PUT /api/admin/form-configurations/[id] - Update form configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const { id: configId } = params
  
  try {
    logger.info('Admin form configuration update request started', { requestId, configId })
    
    // Parse request body
    const body: UpdateFormConfigurationRequest = await request.json()
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin form configuration update request', { requestId, configId, error: authError?.message })
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
      logger.warn('Insufficient permissions for form configuration update', { 
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

    // Update form configuration
    const formConfigService = createFormConfigurationService()
    const configuration = await formConfigService.updateFormConfiguration(configId, body, user.id)

    // Log the admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'update_form_configuration',
      resource_type: 'form_configurations',
      resource_id: configId,
      details: {
        updates: body
      },
      success: true
    })

    const duration = Date.now() - startTime
    logger.info('Form configuration updated successfully', {
      requestId,
      userId: user.id,
      configId,
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
          action: 'update_form_configuration',
          resource_type: 'form_configurations',
          resource_id: configId,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action error', { requestId, configId, logError })
    }

    logger.error('Unexpected error in form configuration update', { 
      requestId,
      configId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while updating form configuration'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

// DELETE /api/admin/form-configurations/[id] - Delete form configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const { id: configId } = params
  
  try {
    logger.info('Admin form configuration deletion request started', { requestId, configId })
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin form configuration deletion request', { requestId, configId, error: authError?.message })
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
      logger.warn('Insufficient permissions for form configuration deletion', { 
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

    // Delete form configuration
    const formConfigService = createFormConfigurationService()
    await formConfigService.deleteFormConfiguration(configId, user.id)

    // Log the admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'delete_form_configuration',
      resource_type: 'form_configurations',
      resource_id: configId,
      success: true
    })

    const duration = Date.now() - startTime
    logger.info('Form configuration deleted successfully', {
      requestId,
      userId: user.id,
      configId,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'Form configuration deleted successfully'
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
          action: 'delete_form_configuration',
          resource_type: 'form_configurations',
          resource_id: configId,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action error', { requestId, configId, logError })
    }

    logger.error('Unexpected error in form configuration deletion', { 
      requestId,
      configId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while deleting form configuration'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
} 