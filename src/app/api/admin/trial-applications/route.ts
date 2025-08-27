import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import { TrialApplicationService } from '@/lib/trial'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    logger.info('Getting trial applications (admin)', { requestId })

    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated trial applications access attempt', { requestId })
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin access and permissions
    await adminAuthService.requireAdminAccess(user.id)
    
    const hasPermission = await adminAuthService.hasPermission('manage_trials', user.id)
    if (!hasPermission) {
      logger.warn('Unauthorized trial applications access attempt', { 
        requestId,
        userId: user.id
      })
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query - get applications first, then join with user data
    let query = supabase
      .from('trial_applications')
      .select('*')
      .order('applied_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply status filter if provided
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: applications, error } = await query

    if (error) {
      logger.error('Failed to get trial applications', { error })
      throw new Error(`Failed to get trial applications: ${error.message}`)
    }

    // Get user emails for the applications
    let applicationsWithEmails = applications || []
    if (applications && applications.length > 0) {
      const userIds = applications.map(app => app.user_id).filter(Boolean)
      
      if (userIds.length > 0) {
        const { data: userProfiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, email')
          .in('id', userIds)

        if (!profileError && userProfiles) {
          // Map emails to applications
          applicationsWithEmails = applications.map(app => ({
            ...app,
            user_profiles: userProfiles.find(profile => profile.id === app.user_id) || { email: 'Unknown' }
          }))
        }
      }
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('trial_applications')
      .select('*', { count: 'exact', head: true })

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      countQuery = countQuery.eq('status', status)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      logger.warn('Failed to get trial applications count', { error: countError })
    }

    logger.info('Trial applications retrieved successfully', { 
      requestId,
      userId: user.id,
      count: applications?.length || 0,
      total: count || 0
    })

    return NextResponse.json({ 
      applications: applicationsWithEmails,
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    logger.error('Failed to get trial applications', { 
      requestId,
      error: error instanceof Error ? error.message : String(error)
    })
    
    return NextResponse.json(
      { error: 'Failed to get trial applications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    logger.info('Admin trial application action', { requestId })

    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated trial application action attempt', { requestId })
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin access and permissions
    await adminAuthService.requireAdminAccess(user.id)
    
    const hasPermission = await adminAuthService.hasPermission('manage_trials', user.id)
    if (!hasPermission) {
      logger.warn('Unauthorized trial application action attempt', { 
        requestId,
        userId: user.id
      })
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, applicationId, adminScore, adminNotes, rejectionReason } = body

    if (!action || !applicationId) {
      return NextResponse.json(
        { error: 'Action and applicationId are required' },
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve or reject' },
        { status: 400 }
      )
    }

    // Update the application
    const updateData: any = {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id
    }

    if (adminScore !== undefined) {
      updateData.admin_score = adminScore
    }

    if (adminNotes) {
      updateData.admin_notes = adminNotes
    }

    if (action === 'reject' && rejectionReason) {
      updateData.rejection_reason = rejectionReason
    }

    const { data: updatedApplication, error: updateError } = await supabase
      .from('trial_applications')
      .update(updateData)
      .eq('id', applicationId)
      .select()
      .single()

    if (updateError) {
      logger.error('Failed to update trial application', { error: updateError })
      throw new Error(`Failed to update trial application: ${updateError.message}`)
    }

    // Log admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: `trial_application_${action}`,
      resource_type: 'trial_applications',
      resource_id: applicationId,
      details: { 
        action,
        adminScore,
        adminNotes,
        rejectionReason 
      },
      ip_address: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    })

    logger.info('Trial application updated successfully', { 
      requestId,
      userId: user.id,
      applicationId,
      action
    })

    return NextResponse.json({ 
      application: updatedApplication,
      message: `Application ${action}d successfully`
    })

  } catch (error) {
    logger.error('Failed to update trial application', { 
      requestId,
      error: error instanceof Error ? error.message : String(error)
    })
    
    return NextResponse.json(
      { error: 'Failed to update trial application' },
      { status: 500 }
    )
  }
} 
