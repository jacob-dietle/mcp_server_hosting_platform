// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import logger from '@/lib/logger'
import type { 
  GetAdminUserDetailRequest, 
  GetAdminUserDetailResponse,
  AdminUserDetail 
} from '@/contracts/api-contracts'

interface RouteParams {
  params: {
    userId: string
  }
}

export async function GET(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse<GetAdminUserDetailResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const { userId } = params
  
  try {
    logger.info('Admin user detail request started', { requestId, targetUserId: userId })
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin user detail request', { requestId, error: authError?.message })
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
    
    // Check specific permission for user management
    const hasUserManagementPermission = await adminAuthService.hasPermission('view_user_management', user.id)
    if (!hasUserManagementPermission) {
      logger.warn('Insufficient permissions for admin user detail', { 
        requestId, 
        userId: user.id,
        targetUserId: userId,
        requiredPermission: 'view_user_management'
      })
      
      await adminAuthService.logAdminAction({
        user_id: user.id,
        action: 'admin_user_detail_access_denied',
        resource_type: 'admin_user',
        resource_id: userId,
        success: false,
        error_message: 'Insufficient permissions',
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      })
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions for user management'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const includeMcpServers = searchParams.get('include_mcp_servers') === 'true'
    const includeDeployments = searchParams.get('include_deployments') === 'true'
    const includeTrialHistory = searchParams.get('include_trial_history') === 'true'
    const includeActivityTimeline = searchParams.get('include_activity_timeline') === 'true'

    logger.info('Admin user detail query parameters', {
      requestId,
      targetUserId: userId,
      includeMcpServers,
      includeDeployments,
      includeTrialHistory,
      includeActivityTimeline
    })

    // Get target user from user_profiles table
    const { data: userProfile, error: userError } = await supabase
      .schema('auth_logic')
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (userError || !userProfile) {
      logger.warn('Target user not found', { requestId, targetUserId: userId, error: userError?.message })
      
      await adminAuthService.logAdminAction({
        user_id: user.id,
        action: 'admin_user_detail_not_found',
        resource_type: 'admin_user',
        resource_id: userId,
        success: false,
        error_message: 'User not found',
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      })
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      }, { status: 404 })
    }

    const targetUser = userProfile

    // Get user role
    const { data: userRole, error: roleError } = await supabase
      .schema('auth_logic')
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', userId)
      .single()
    
    if (roleError && roleError.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.error('Failed to fetch user role', { requestId, targetUserId: userId, error: roleError.message })
      throw new Error(`Failed to fetch user role: ${roleError.message}`)
    }

    // Build the user detail object
    const userDetail: AdminUserDetail = {
      id: targetUser.id,
      email: targetUser.email || '',
      role: (userRole?.role as 'user' | 'admin' | 'super_admin') || 'user',
      signup_date: targetUser.created_at,
      last_login: targetUser.last_sign_in_at ?? null,
      profile: {
        created_at: targetUser.created_at,
        updated_at: targetUser.updated_at ?? null,
        email_confirmed_at: targetUser.email_confirmed_at ?? null,
        last_sign_in_at: targetUser.last_sign_in_at ?? null,
        raw_user_meta_data: targetUser.raw_user_meta_data || {}
      },
      funnel_stage: 'signup', // Will be calculated below
      trial_status: 'none' // Will be calculated below
    }

    // Get MCP servers if requested
    if (includeMcpServers) {
      const { data: mcpServers, error: mcpError } = await supabase
        .schema('auth_logic')
        .from('mcp_servers')
        .select('id, name, config, created_at, updated_at')
        .eq('user_id', userId)
      
      if (mcpError) {
        logger.error('Failed to fetch MCP servers', { requestId, targetUserId: userId, error: mcpError.message })
        throw new Error(`Failed to fetch MCP servers: ${mcpError.message}`)
      }

      userDetail.mcp_servers = mcpServers?.map(server => ({
        id: server.id,
        name: server.name,
        config: {
          url: server.config.url,
          transportType: server.config.transportType
        },
        created_at: server.created_at,
        updated_at: server.updated_at
      })) || []
    }

    // Get deployments if requested
    if (includeDeployments) {
      const { data: deployments, error: deploymentError } = await supabase
        .schema('auth_logic')
        .from('deployments')
        .select('id, deployment_name, status, health_status, service_url, created_at, deployed_at')
        .eq('user_id', userId)
      
      if (deploymentError) {
        logger.error('Failed to fetch deployments', { requestId, targetUserId: userId, error: deploymentError.message })
        throw new Error(`Failed to fetch deployments: ${deploymentError.message}`)
      }

      userDetail.deployments = deployments?.map(deployment => ({
        id: deployment.id,
        deployment_name: deployment.deployment_name,
        status: deployment.status || 'unknown',
        health_status: deployment.health_status,
        service_url: deployment.service_url,
        created_at: deployment.created_at,
        deployed_at: deployment.deployed_at
      })) || []
    }

    // Get trial history if requested
    if (includeTrialHistory) {
      try {
        const { data: trialHistory, error: trialError } = await supabase
          .schema('auth_logic')
          .from('trial_applications')
          .select('id, created_at, status, trial_start_date, trial_end_date, conversion_date')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        
        if (trialError) {
          logger.warn('Failed to fetch trial history (table may not exist)', { 
            requestId, 
            targetUserId: userId, 
            error: trialError.message 
          })
          userDetail.trial_history = []
        } else {
          userDetail.trial_history = trialHistory?.map(trial => ({
            id: trial.id,
            application_date: trial.created_at,
            status: trial.status as 'pending' | 'approved' | 'active' | 'expired' | 'converted',
            trial_start_date: trial.trial_start_date,
            trial_end_date: trial.trial_end_date,
            conversion_date: trial.conversion_date
          })) || []
        }
      } catch (error) {
        logger.info('Trial applications table not found, setting empty trial history', { requestId, targetUserId: userId })
        userDetail.trial_history = []
      }
    }

    // Get activity timeline if requested
    if (includeActivityTimeline) {
      const timeline: AdminUserDetail['activity_timeline'] = []
      
      // Add signup event
      timeline.push({
        timestamp: targetUser.created_at,
        event_type: 'signup',
        description: 'User account created',
        metadata: { email: targetUser.email }
      })

      // Add login events (we only have last login, but could be extended)
      if (targetUser.last_sign_in_at) {
        timeline.push({
          timestamp: targetUser.last_sign_in_at,
          event_type: 'login',
          description: 'Last login',
          metadata: {}
        })
      }

      // Add MCP server creation events if we have that data
      if (userDetail.mcp_servers) {
        userDetail.mcp_servers.forEach(server => {
          timeline.push({
            timestamp: server.created_at,
            event_type: 'server_created',
            description: `Created MCP server: ${server.name}`,
            metadata: { server_id: server.id, server_name: server.name }
          })
        })
      }

      // Add deployment events if we have that data
      if (userDetail.deployments) {
        userDetail.deployments.forEach(deployment => {
          timeline.push({
            timestamp: deployment.created_at,
            event_type: 'deployment_created',
            description: `Created deployment: ${deployment.deployment_name}`,
            metadata: { deployment_id: deployment.id, deployment_name: deployment.deployment_name }
          })
        })
      }

      // Add trial events if we have that data
      if (userDetail.trial_history) {
        userDetail.trial_history.forEach(trial => {
          timeline.push({
            timestamp: trial.application_date,
            event_type: 'trial_applied',
            description: 'Applied for trial',
            metadata: { trial_id: trial.id, status: trial.status }
          })
          
          if (trial.trial_start_date) {
            timeline.push({
              timestamp: trial.trial_start_date,
              event_type: 'trial_started',
              description: 'Trial started',
              metadata: { trial_id: trial.id }
            })
          }
          
          if (trial.conversion_date) {
            timeline.push({
              timestamp: trial.conversion_date,
              event_type: 'trial_converted',
              description: 'Trial converted to paid',
              metadata: { trial_id: trial.id }
            })
          }
        })
      }

      // Sort timeline by timestamp (newest first)
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      userDetail.activity_timeline = timeline
    }

    // Calculate funnel stage and trial status
    const hasDeployments = userDetail.deployments ? userDetail.deployments.length > 0 : false
    const latestTrial = userDetail.trial_history?.[0] // Most recent trial
    
    if (latestTrial?.conversion_date) {
      userDetail.funnel_stage = 'converted'
      userDetail.trial_status = 'converted'
    } else if (hasDeployments) {
      userDetail.funnel_stage = 'deployed'
      userDetail.trial_status = latestTrial ? 
        (latestTrial.status === 'active' ? 'active' : latestTrial.status as any) : 'none'
    } else if (latestTrial?.status === 'active') {
      userDetail.funnel_stage = 'trial_active'
      userDetail.trial_status = 'active'
    } else if (latestTrial?.status === 'pending' || latestTrial?.status === 'approved') {
      userDetail.funnel_stage = 'trial_applied'
      userDetail.trial_status = 'applied'
    } else {
      userDetail.funnel_stage = 'signup'
      userDetail.trial_status = 'none'
    }

    // Log successful admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'admin_user_detail_accessed',
      resource_type: 'admin_user',
      resource_id: userId,
      success: true,
      metadata: {
        target_user_email: targetUser.email,
        includes: { includeMcpServers, includeDeployments, includeTrialHistory, includeActivityTimeline }
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    })

    const duration = Date.now() - startTime
    logger.info('Admin user detail request completed', {
      requestId,
      targetUserId: userId,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        user: userDetail
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Admin user detail request failed', {
      requestId,
      targetUserId: userId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    // Log failed admin action if we have user context
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await adminAuthService.logAdminAction({
          user_id: user.id,
          action: 'admin_user_detail_failed',
          resource_type: 'admin_user',
          resource_id: userId,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown'
        })
      }
    } catch (logError) {
      logger.error('Failed to log admin action for failed request', { requestId, logError })
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch admin user detail'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

