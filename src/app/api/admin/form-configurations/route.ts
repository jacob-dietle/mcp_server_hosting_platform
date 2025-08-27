// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import { createFormConfigurationService } from '@/lib/trial'
import logger from '@/lib/logger'
import type { 
  CreateFormConfigurationRequest
} from '@/lib/trial'
import type { FormConfiguration } from '@/lib/trial'

interface ListFormConfigurationsResponse {
  success: boolean
  data?: {
    configurations: FormConfiguration[]
    total: number
  }
  error?: {
    code: string
    message: string
  }
  meta: {
    timestamp: string
    requestId: string
    version: string
  }
}

interface CreateFormConfigurationResponse {
  success: boolean
  data?: {
    configuration: FormConfiguration
  }
  error?: {
    code: string
    message: string
  }
  meta: {
    timestamp: string
    requestId: string
    version: string
  }
}

// GET /api/admin/form-configurations - List all form configurations
export async function GET(request: NextRequest): Promise<NextResponse<ListFormConfigurationsResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Admin form configurations list request started', { requestId })
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin form configurations request', { requestId, error: authError?.message })
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
      logger.warn('Insufficient permissions for form configurations list', { 
        requestId, 
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('include_inactive') === 'true'

    // Get form configurations
    const formConfigService = createFormConfigurationService()
    const configurations = await formConfigService.listFormConfigurations(includeInactive)

    // Log the admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'list_form_configurations',
      resource_type: 'form_configurations',
      details: {
        includeInactive,
        results_count: configurations.length
      },
      success: true
    })

    const duration = Date.now() - startTime
    logger.info('Admin form configurations list completed successfully', {
      requestId,
      userId: user.id,
      configurationsCount: configurations.length,
      includeInactive,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        configurations,
        total: configurations.length
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
          action: 'list_form_configurations',
          resource_type: 'form_configurations',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action error', { requestId, logError })
    }

    logger.error('Unexpected error in form configurations list', { 
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while listing form configurations'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

// POST /api/admin/form-configurations - Create new form configuration
export async function POST(request: NextRequest): Promise<NextResponse<CreateFormConfigurationResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Admin form configuration creation request started', { requestId })
    
    // Parse request body
    const body: CreateFormConfigurationRequest = await request.json()
    
    // Validate required fields
    if (!body.name || !body.questions || body.questions.length === 0) {
      logger.warn('Invalid form configuration creation request', { requestId, body })
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name and questions are required'
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
      logger.warn('Unauthenticated admin form configuration creation request', { requestId, error: authError?.message })
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
      logger.warn('Insufficient permissions for form configuration creation', { 
        requestId, 
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

    // Create form configuration
    const formConfigService = createFormConfigurationService()
    const configuration = await formConfigService.createFormConfiguration(body, user.id)

    // Log the admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'create_form_configuration',
      resource_type: 'form_configurations',
      resource_id: configuration.id,
      details: {
        name: configuration.name,
        question_count: configuration.questions.length
      },
      success: true
    })

    const duration = Date.now() - startTime
    logger.info('Form configuration created successfully', {
      requestId,
      userId: user.id,
      configurationId: configuration.id,
      name: configuration.name,
      questionCount: configuration.questions.length,
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
          action: 'create_form_configuration',
          resource_type: 'form_configurations',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action error', { requestId, logError })
    }

    logger.error('Unexpected error in form configuration creation', { 
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    }, error as Error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while creating form configuration'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
} 
