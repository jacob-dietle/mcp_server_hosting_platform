// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  logger.info('Admin dashboard access attempt', { 
    endpoint: '/api/admin/dashboard',
    method: 'GET',
    requestId,
    timestamp: new Date().toISOString()
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      logger.warn('Unauthenticated admin dashboard access attempt', { 
        endpoint: '/api/admin/dashboard',
        requestId,
        duration: Date.now() - startTime
      })
      
      return NextResponse.json({ 
        success: false,
        error: { 
          code: 'UNAUTHORIZED', 
          message: 'Authentication required' 
        } 
      }, { status: 401 })
    }

    logger.debug('User authenticated, checking admin access', { 
      userId: user.id, 
      email: user.email,
      requestId 
    })

    // Check admin access using our new service
    try {
      const roleInfo = await adminAuthService.requireAdminAccess(user.id)
      
      logger.info('Admin access granted', {
        userId: user.id,
        email: user.email,
        role: roleInfo.role,
        requestId,
        endpoint: '/api/admin/dashboard'
      })

      // Log successful admin access
      await adminAuthService.logAdminAction({
        user_id: user.id,
        action: 'admin_dashboard_access',
        resource_type: 'admin_dashboard',
        details: {
          endpoint: '/api/admin/dashboard',
          method: 'GET',
          requestId
        },
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        success: true
      })

    } catch (authError) {
      logger.warn('Admin access denied', {
        userId: user.id,
        email: user.email,
        requestId,
        endpoint: '/api/admin/dashboard',
        duration: Date.now() - startTime,
        error: authError instanceof Error ? authError.message : String(authError)
      })

      // Log failed admin access attempt
      await adminAuthService.logAdminAction({
        user_id: user.id,
        action: 'admin_dashboard_access_denied',
        resource_type: 'admin_dashboard',
        details: {
          endpoint: '/api/admin/dashboard',
          method: 'GET',
          requestId,
          reason: 'insufficient_privileges'
        },
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: authError instanceof Error ? authError.message : String(authError)
      })
      
      return NextResponse.json({ 
        success: false,
        error: { 
          code: 'FORBIDDEN', 
          message: 'Admin access required' 
        } 
      }, { status: 403 })
    }

    // Get user permissions for the dashboard
    const permissions = await adminAuthService.getUserPermissions(user.id)
    
    // Get recent admin activities (last 50)
    const recentActivities = await adminAuthService.getAdminAuditLogs(50, 0, user.id)
    
    // Get deployment stats (if user has permission)
    let deploymentStats = null
    if (permissions.some(p => p.permission_name === 'view_all_deployments')) {
      const { data: deployments } = await supabase
        .from('deployments')
        .select('status, health_status, created_at')
        .order('created_at', { ascending: false })
      
      if (deployments) {
        deploymentStats = {
          total: deployments.length,
          active: deployments.filter(d => d.status === 'running').length,
          healthy: deployments.filter(d => d.health_status === 'healthy').length,
          recent: deployments.slice(0, 10)
        }
      }
    }

    // Get user management stats (if user has permission)
    let userStats = null
    if (permissions.some(p => p.permission_name === 'view_user_management')) {
      const adminClient = createAdminClient()
      const { data: users } = await adminClient.auth.admin.listUsers()
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role, is_active')
        .eq('is_active', true)
      
      if (users && roles) {
        // Get MCP server counts
        const { data: mcpServers } = await supabase
          .schema('auth_logic')
          .from('mcp_servers')
          .select('user_id')

        // Get trial data (if available)
        let trialApplications: any[] = []
        let activeTrials = 0
        let pendingTrialApplications = 0
        let trialConversions = 0
        
        try {
          const { data: trials } = await supabase
            .schema('auth_logic')
            .from('trial_applications')
            .select('user_id, status, created_at, trial_start_date, trial_end_date, conversion_date')
          
          if (trials) {
            trialApplications = trials
            pendingTrialApplications = trials.filter(t => t.status === 'pending').length
            activeTrials = trials.filter(t => {
              if (t.status !== 'active') return false
              const endDate = new Date(t.trial_end_date)
              const now = new Date()
              return now <= endDate
            }).length
            trialConversions = trials.filter(t => t.conversion_date).length
          }
        } catch (error) {
          logger.info('Trial applications table not found, using default values', { requestId })
        }

        // Calculate funnel breakdown
        const userIds = users.users.map(u => u.id)
        const mcpServerUserIds = new Set(mcpServers?.map(s => s.user_id) || [])
        const deploymentUserIds = new Set(deploymentStats?.recent?.map((d: any) => d.user_id) || [])
        const trialUserIds = new Set(trialApplications.map(t => t.user_id))
        const convertedUserIds = new Set(trialApplications.filter(t => t.conversion_date).map(t => t.user_id))

        const funnelBreakdown = {
          signup: users.users.length,
          trial_applied: trialUserIds.size,
          trial_active: activeTrials,
          deployed: deploymentUserIds.size,
          converted: convertedUserIds.size
        }

        // Calculate trial conversion rate
        const trialConversionRate = trialApplications.length > 0 
          ? (trialConversions / trialApplications.length) * 100 
          : 0

        userStats = {
          totalUsers: users.users.length,
          adminUsers: roles.filter(r => r.role === 'admin').length,
          superAdminUsers: roles.filter(r => r.role === 'super_admin').length,
          recentSignups: users.users
            .filter(u => new Date(u.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            .length,
          // New user management metrics
          pendingTrialApplications,
          activeTrials,
          trialConversionRate: Math.round(trialConversionRate * 100) / 100,
          funnelBreakdown
        }
      }
    }

    const dashboardData = {
      user: {
        id: user.id,
        email: user.email,
        role: (await adminAuthService.getUserRole(user.id))?.role || 'user'
      },
      permissions: permissions.map(p => ({
        name: p.permission_name,
        description: p.description,
        category: p.category
      })),
      stats: {
        deployments: deploymentStats,
        users: userStats
      },
      recentActivities: recentActivities.slice(0, 20).map(activity => ({
        id: activity.id,
        action: activity.action,
        resource_type: activity.resource_type,
        success: activity.success,
        created_at: activity.created_at,
        user_id: activity.user_id
      })),
      systemInfo: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }
    
    logger.info('Admin dashboard data retrieved successfully', {
      userId: user.id,
      email: user.email,
      permissionCount: permissions.length,
      hasDeploymentStats: !!deploymentStats,
      hasUserStats: !!userStats,
      activityCount: recentActivities.length,
      requestId,
      duration: Date.now() - startTime
    })
    
    return NextResponse.json({
      success: true,
      data: dashboardData,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })
    
  } catch (error) {
    logger.error('Admin dashboard request failed', {
      endpoint: '/api/admin/dashboard',
      method: 'GET',
      requestId,
      duration: Date.now() - startTime,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error)
    })
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to load admin dashboard' 
        } 
      }, 
      { status: 500 }
    )
  }
}
