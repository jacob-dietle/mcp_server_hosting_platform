// Force dynamic rendering for admin routes that use cookies/auth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { adminAuthService } from '@/lib/admin/server'
import logger from '@/lib/logger'
import type { 
  ListAdminMCPServersRequest, 
  ListAdminMCPServersResponse,
  AdminMCPServerSummary 
} from '@/contracts/api-contracts'

export async function GET(request: NextRequest): Promise<NextResponse<ListAdminMCPServersResponse>> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Admin MCP servers list request started', { requestId })
    
    // Initialize Supabase client
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.warn('Unauthenticated admin MCP servers request', { requestId, error: authError?.message })
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
    
    // Check specific permission for user management (MCP servers are part of user management)
    const hasUserManagementPermission = await adminAuthService.hasPermission('view_user_management', user.id)
    if (!hasUserManagementPermission) {
      logger.warn('Insufficient permissions for admin MCP servers list', { 
        requestId, 
        userId: user.id,
        requiredPermission: 'view_user_management'
      })
      
      await adminAuthService.logAdminAction({
        user_id: user.id,
        action: 'admin_mcp_servers_access_denied',
        resource_type: 'admin_mcp_servers',
        success: false,
        error_message: 'Insufficient permissions',
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      })
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions for MCP server management'
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
    const filterUserId = searchParams.get('user_id')
    const search = searchParams.get('search')
    const status = searchParams.get('status') as 'active' | 'inactive' | null
    const transportType = searchParams.get('transport_type') as 'sse' | 'streamable-http' | null
    const createdFrom = searchParams.get('created_from')
    const createdTo = searchParams.get('created_to')

    logger.info('Admin MCP servers list query parameters', {
      requestId,
      limit,
      offset,
      filterUserId,
      search,
      status,
      transportType,
      createdFrom,
      createdTo
    })

    // Build the base query for MCP servers
    let mcpQuery = supabase
      .schema('auth_logic')
      .from('mcp_servers')
      .select('id, name, user_id, config, created_at, updated_at')

    // Apply filters
    if (filterUserId) {
      mcpQuery = mcpQuery.eq('user_id', filterUserId)
    }

    if (search) {
      mcpQuery = mcpQuery.ilike('name', `%${search}%`)
    }

    if (transportType) {
      mcpQuery = mcpQuery.eq('config->transportType', transportType)
    }

    if (createdFrom) {
      mcpQuery = mcpQuery.gte('created_at', createdFrom)
    }

    if (createdTo) {
      mcpQuery = mcpQuery.lte('created_at', createdTo)
    }

    // Execute the query with pagination
    const { data: mcpServers, error: mcpError, count } = await mcpQuery
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (mcpError) {
      logger.error('Failed to fetch MCP servers', { requestId, error: mcpError.message })
      throw new Error(`Failed to fetch MCP servers: ${mcpError.message}`)
    }

    if (!mcpServers || mcpServers.length === 0) {
      // Return empty result
      await adminAuthService.logAdminAction({
        user_id: user.id,
        action: 'admin_mcp_servers_accessed',
        resource_type: 'admin_mcp_servers',
        success: true,
        metadata: {
          total_servers: 0,
          returned_servers: 0,
          filters: { filterUserId, search, status, transportType, createdFrom, createdTo }
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      })

      return NextResponse.json({
        success: true,
        data: {
        data: [],
        pagination: {
            page: Math.floor(offset / limit) + 1,
            limit,
            total: 0,
            totalPages: 0
          
      }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      })
    }

    // Get user emails for the servers
    const userIds = [...new Set(mcpServers.map(server => server.user_id))]
    const adminClient = createAdminClient()
    const { data: authUsers, error: usersError } = await adminClient.auth.admin.listUsers()
    if (usersError) {
      logger.error('Failed to fetch user emails', { requestId, error: usersError.message })
      throw new Error(`Failed to fetch user emails: ${usersError.message}`)
    }

    const userEmailMap = new Map(
      authUsers.users.map(user => [user.id, user.email || 'unknown'])
    )

    // Get deployment counts per server (if deployments reference MCP servers)
    const { data: deployments, error: deploymentError } = await supabase
      .schema('auth_logic')
      .from('deployments')
      .select('user_id')
      .in('user_id', userIds)

    if (deploymentError) {
      logger.error('Failed to fetch deployment counts', { requestId, error: deploymentError.message })
      throw new Error(`Failed to fetch deployment counts: ${deploymentError.message}`)
    }

    // Create deployment count map per user (since we don't have direct server-deployment relationship)
    const deploymentCountMap = new Map<string, number>()
    deployments?.forEach(deployment => {
      const count = deploymentCountMap.get(deployment.user_id) || 0
      deploymentCountMap.set(deployment.user_id, count + 1)
    })

    // Get API usage stats (if available)
    let apiUsageMap = new Map<string, { total_requests: number; avg_response_time: number | null; last_used: string | null }>()
    try {
      const { data: apiUsage, error: apiError } = await supabase
        .schema('auth_logic')
        .from('api_usage')
        .select('user_id, response_time_ms, created_at')
        .in('user_id', userIds)

      if (!apiError && apiUsage) {
        // Aggregate API usage by user
        const usageByUser = new Map<string, { requests: number; totalResponseTime: number; lastUsed: string | null }>()
        
        apiUsage.forEach(usage => {
          const existing = usageByUser.get(usage.user_id) || { requests: 0, totalResponseTime: 0, lastUsed: null }
          existing.requests += 1
          existing.totalResponseTime += usage.response_time_ms || 0
          if (!existing.lastUsed || usage.created_at > existing.lastUsed) {
            existing.lastUsed = usage.created_at
          }
          usageByUser.set(usage.user_id, existing)
        })

        // Convert to final format
        usageByUser.forEach((stats, userId) => {
          apiUsageMap.set(userId, {
            total_requests: stats.requests,
            avg_response_time: stats.requests > 0 ? stats.totalResponseTime / stats.requests : null,
            last_used: stats.lastUsed
          })
        })
      }
    } catch (error) {
      logger.info('API usage data not available, continuing without usage stats', { requestId })
    }

    // Process servers into response format
    const processedServers: AdminMCPServerSummary[] = mcpServers.map(server => {
      const userEmail = userEmailMap.get(server.user_id) || 'unknown'
      const deploymentCount = deploymentCountMap.get(server.user_id) || 0
      const usageStats = apiUsageMap.get(server.user_id) || {
        total_requests: 0,
        avg_response_time: null,
        last_used: null
      }

      // Determine health status (simplified logic - could be enhanced)
      let healthStatus: 'unknown' | 'healthy' | 'unhealthy' | 'degraded' | null = 'unknown'
      if (usageStats.last_used) {
        const lastUsed = new Date(usageStats.last_used)
        const now = new Date()
        const daysSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysSinceLastUse <= 1) {
          healthStatus = 'healthy'
        } else if (daysSinceLastUse <= 7) {
          healthStatus = 'degraded'
        } else {
          healthStatus = 'unhealthy'
        }
      }

      return {
        id: server.id,
        name: server.name,
        user_id: server.user_id,
        user_email: userEmail,
        config: {
          url: server.config.url,
          transportType: server.config.transportType
        },
        created_at: server.created_at,
        updated_at: server.updated_at,
        deployment_count: deploymentCount,
        last_deployment_date: null, // Could be enhanced with actual deployment dates
        health_status: healthStatus,
        usage_stats: usageStats
      }
    })

    // Apply status filter if specified (after processing since we calculate status)
    let filteredServers = processedServers
    if (status) {
      filteredServers = processedServers.filter(server => {
        if (status === 'active') {
          return server.health_status === 'healthy' || server.health_status === 'degraded'
        } else if (status === 'inactive') {
          return server.health_status === 'unhealthy' || server.health_status === 'unknown'
        }
        return true
      })
    }

    // Get total count for pagination (this is approximate since we filtered after query)
    const total = count || filteredServers.length

    // Log successful admin action
    await adminAuthService.logAdminAction({
      user_id: user.id,
      action: 'admin_mcp_servers_accessed',
      resource_type: 'admin_mcp_servers',
      success: true,
      metadata: {
        total_servers: total,
        returned_servers: filteredServers.length,
        filters: { filterUserId, search, status, transportType, createdFrom, createdTo }
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    })

    const duration = Date.now() - startTime
    logger.info('Admin MCP servers list request completed', {
      requestId,
      duration,
      totalServers: total,
      returnedServers: filteredServers.length
    })

    return NextResponse.json({
      success: true,
      data: {
        data: filteredServers,
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
    logger.error('Admin MCP servers list request failed', {
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
          action: 'admin_mcp_servers_failed',
          resource_type: 'admin_mcp_servers',
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
        message: 'Failed to fetch admin MCP servers list'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

