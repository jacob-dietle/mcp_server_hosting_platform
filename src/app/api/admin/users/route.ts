// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import logger from '@/lib/logger'
import type { 
  ListAdminUsersRequest, 
  ListAdminUsersResponse,
  AdminUserSummary 
} from '@/contracts/api-contracts'

export async function GET(request: NextRequest): Promise<NextResponse<ListAdminUsersResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Admin users list request started', { requestId })
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin users request', { requestId, error: authError?.message })
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

    // Require admin access and log the action
    const roleInfo = await adminAuthService.requireAdminAccess(user.id)
    
    // Check specific permission for user management
    const hasUserManagementPermission = await adminAuthService.hasPermission('view_user_management', user.id)
    if (!hasUserManagementPermission) {
      logger.warn('Insufficient permissions for admin users list', { 
        requestId, 
        userId: user.id,
        requiredPermission: 'view_user_management'
      })
      
      await adminAuthService.logAdminAction({
        user_id: user.id,
        action: 'admin_users_list_access_denied',
        resource_type: 'admin_users',
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const role = searchParams.get('role') as 'user' | 'admin' | 'super_admin' | null
    const signupDateFrom = searchParams.get('signup_date_from')
    const signupDateTo = searchParams.get('signup_date_to')
    const activityLevel = searchParams.get('activity_level') as 'active' | 'inactive' | 'new' | null
    const search = searchParams.get('search')
    const funnelStage = searchParams.get('funnel_stage') as 'signup' | 'trial_applied' | 'trial_active' | 'deployed' | 'converted' | null

    logger.info('Admin users list query parameters', {
      requestId,
      limit,
      offset,
      role,
      signupDateFrom,
      signupDateTo,
      activityLevel,
      search,
      funnelStage
    })

    // Get all users from user_profiles table (no cross-schema dependency)
    const { data: userProfiles, error: usersError } = await supabase
      .schema('auth_logic')
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (usersError) {
      logger.error('Failed to fetch users from profiles', { requestId, error: usersError.message })
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    // Get user roles
    let rolesQuery = supabase
      .schema('auth_logic')
      .from('user_roles')
      .select('user_id, role, is_active')
    
    if (role) {
      rolesQuery = rolesQuery.eq('role', role)
    }
    
    const { data: userRoles, error: rolesError } = await rolesQuery
    if (rolesError) {
      logger.error('Failed to fetch user roles', { requestId, error: rolesError.message })
      throw new Error(`Failed to fetch user roles: ${rolesError.message}`)
    }

    // Get MCP server counts per user
    const { data: mcpServerCounts, error: mcpError } = await supabase
      .schema('auth_logic')
      .from('mcp_servers')
      .select('user_id')
    
    if (mcpError) {
      logger.error('Failed to fetch MCP server counts', { requestId, error: mcpError.message })
      throw new Error(`Failed to fetch MCP server counts: ${mcpError.message}`)
    }

    // Get deployment counts per user
    const { data: deploymentCounts, error: deploymentError } = await supabase
      .schema('auth_logic')
      .from('deployments')
      .select('user_id')
    
    if (deploymentError) {
      logger.error('Failed to fetch deployment counts', { requestId, error: deploymentError.message })
      throw new Error(`Failed to fetch deployment counts: ${deploymentError.message}`)
    }

    // Try to get trial data (may not exist yet)
    let trialApplications: any[] = []
    let deploymentTrials: any[] = []
    
    try {
      const { data: trials } = await supabase
        .schema('auth_logic')
        .from('trial_applications')
        .select('user_id, status, created_at, trial_start_date, trial_end_date, conversion_date')
      
      if (trials) trialApplications = trials
    } catch (error) {
      logger.info('Trial applications table not found, continuing without trial data', { requestId })
    }

    try {
      const { data: deployTrials } = await supabase
        .schema('auth_logic')
        .from('deployment_trials')
        .select('user_id, status, created_at')
      
      if (deployTrials) deploymentTrials = deployTrials
    } catch (error) {
      logger.info('Deployment trials table not found, continuing without deployment trial data', { requestId })
    }

    // Create lookup maps for efficient processing
    const roleMap = new Map(userRoles?.map(r => [r.user_id, r]) || [])
    const mcpCountMap = new Map<string, number>()
    const deploymentCountMap = new Map<string, number>()
    const trialMap = new Map(trialApplications.map(t => [t.user_id, t]))

    // Count MCP servers per user
    mcpServerCounts?.forEach(server => {
      const count = mcpCountMap.get(server.user_id) || 0
      mcpCountMap.set(server.user_id, count + 1)
    })

    // Count deployments per user
    deploymentCounts?.forEach(deployment => {
      const count = deploymentCountMap.get(deployment.user_id) || 0
      deploymentCountMap.set(deployment.user_id, count + 1)
    })

    // Calculate funnel stage for each user
    const calculateFunnelStage = (userId: string): 'signup' | 'trial_applied' | 'trial_active' | 'deployed' | 'converted' => {
      const trial = trialMap.get(userId)
      const hasDeployments = (deploymentCountMap.get(userId) || 0) > 0
      
      if (trial?.conversion_date) return 'converted'
      if (hasDeployments) return 'deployed'
      if (trial?.status === 'active') return 'trial_active'
      if (trial?.status === 'pending' || trial?.status === 'approved') return 'trial_applied'
      return 'signup'
    }

    // Calculate trial status
    const calculateTrialStatus = (userId: string): 'none' | 'applied' | 'active' | 'expired' | 'converted' | null => {
      const trial = trialMap.get(userId)
      if (!trial) return 'none'
      
      if (trial.conversion_date) return 'converted'
      if (trial.status === 'active') {
        const endDate = new Date(trial.trial_end_date)
        const now = new Date()
        return now > endDate ? 'expired' : 'active'
      }
      if (trial.status === 'pending' || trial.status === 'approved') return 'applied'
      return 'none'
    }

    // Process and filter users
    let processedUsers: AdminUserSummary[] = (userProfiles || []).map(userProfile => {
      const userRole = roleMap.get(userProfile.id)
      const mcpCount = mcpCountMap.get(userProfile.id) || 0
      const deploymentCount = deploymentCountMap.get(userProfile.id) || 0
      const funnelStageCalc = calculateFunnelStage(userProfile.id)
      const trialStatusCalc = calculateTrialStatus(userProfile.id)
      
      return {
        id: userProfile.id,
        email: userProfile.email || '',
        role: (userRole?.role as 'user' | 'admin' | 'super_admin') || 'user',
        signup_date: userProfile.created_at,
        last_login: userProfile.last_sign_in_at ?? null,
        mcp_server_count: mcpCount,
        deployment_count: deploymentCount,
        trial_status: trialStatusCalc,
        funnel_stage: funnelStageCalc,
        last_activity: userProfile.last_sign_in_at ?? null,
        is_active: userRole?.is_active ?? true
      }
    })

    // Apply filters
    if (role) {
      processedUsers = processedUsers.filter(user => user.role === role)
    }

    if (signupDateFrom) {
      const fromDate = new Date(signupDateFrom)
      processedUsers = processedUsers.filter(user => new Date(user.signup_date) >= fromDate)
    }

    if (signupDateTo) {
      const toDate = new Date(signupDateTo)
      processedUsers = processedUsers.filter(user => new Date(user.signup_date) <= toDate)
    }

    if (activityLevel) {
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      
      processedUsers = processedUsers.filter(user => {
        const lastActivity = user.last_activity ? new Date(user.last_activity) : new Date(user.signup_date)
        
        switch (activityLevel) {
          case 'active':
            return lastActivity >= sevenDaysAgo
          case 'inactive':
            return lastActivity < thirtyDaysAgo
          case 'new':
            return new Date(user.signup_date) >= sevenDaysAgo
          default:
            return true
        }
      })
    }

    if (search) {
      const searchLower = search.toLowerCase()
      processedUsers = processedUsers.filter(user => 
        user.email.toLowerCase().includes(searchLower)
      )
    }

    if (funnelStage) {
      processedUsers = processedUsers.filter(user => user.funnel_stage === funnelStage)
    }

    // Apply pagination
    const total = processedUsers.length
    const paginatedUsers = processedUsers.slice(offset, offset + limit)

    // Log successful admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'admin_users_list_accessed',
      resource_type: 'admin_users',
      success: true,
      metadata: {
        total_users: total,
        returned_users: paginatedUsers.length,
        filters: { role, signupDateFrom, signupDateTo, activityLevel, search, funnelStage }
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    })

    const duration = Date.now() - startTime
    logger.info('Admin users list request completed', {
      requestId,
      duration,
      totalUsers: total,
      returnedUsers: paginatedUsers.length
    })

    return NextResponse.json({
      success: true,
      data: {
        data: paginatedUsers,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        
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
    logger.error('Admin users list request failed', {
      requestId,
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
          action: 'admin_users_list_failed',
          resource_type: 'admin_users',
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
        message: 'Failed to fetch admin users list'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

