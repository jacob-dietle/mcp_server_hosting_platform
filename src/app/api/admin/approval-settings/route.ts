import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import { ApprovalSettingsService } from '@/lib/trial'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    logger.info('Getting approval settings', { requestId })

    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated approval settings access attempt', { requestId })
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin access and permissions
    await adminAuthService.requireAdminAccess(user.id)
    
    const hasPermission = await adminAuthService.hasPermission('manage_trials', user.id)
    if (!hasPermission) {
      logger.warn('Unauthorized approval settings access attempt', { 
        requestId,
        userId: user.id
      })
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const approvalService = new ApprovalSettingsService()
    const settings = await approvalService.getApprovalSettings()

    logger.info('Approval settings retrieved successfully', { 
      requestId,
      userId: user.id
    })

    return NextResponse.json({ settings })

  } catch (error) {
    logger.error('Failed to get approval settings', { 
      requestId,
      error: error instanceof Error ? error.message : String(error)
    })
    
    return NextResponse.json(
      { error: 'Failed to get approval settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    logger.info('Updating approval settings', { requestId })

    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated approval settings update attempt', { requestId })
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin access and permissions
    await adminAuthService.requireAdminAccess(user.id)
    
    const hasPermission = await adminAuthService.hasPermission('manage_trials', user.id)
    if (!hasPermission) {
      logger.warn('Unauthorized approval settings update attempt', { 
        requestId,
        userId: user.id
      })
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings data' },
        { status: 400 }
      )
    }

    const approvalService = new ApprovalSettingsService()
    const updatedSettings = await approvalService.updateApprovalSettings(
      settings,
      user.id
    )

    // Log admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'update_approval_settings',
      resource_type: 'approval_settings',
      resource_id: 'system',
      details: { settings },
      ip_address: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    })

    logger.info('Approval settings updated successfully', { 
      requestId,
      userId: user.id
    })

    return NextResponse.json({ settings: updatedSettings })

  } catch (error) {
    logger.error('Failed to update approval settings', { 
      requestId,
      error: error instanceof Error ? error.message : String(error)
    })
    
    return NextResponse.json(
      { error: 'Failed to update approval settings' },
      { status: 500 }
    )
  }
} 
