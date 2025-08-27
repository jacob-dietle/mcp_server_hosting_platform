import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDeploymentService } from '@/lib/deployment'
import { createDeploymentOrchestrator } from '@/lib/deployment'
import { 
  CreateDeploymentRequest, 
  CreateDeploymentResponse,
  ListDeploymentsRequest,
  ListDeploymentsResponse 
} from '@/contracts/api-contracts'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  console.info(`[${requestId}] List deployments request started`, { 
    endpoint: '/api/deployments',
    method: 'GET',
    timestamp: new Date().toISOString()
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.warn(`[${requestId}] Unauthorized access attempt`, { 
        endpoint: '/api/deployments',
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

    // Check for impersonation headers
    const impersonationSession = request.headers.get('X-Impersonation-Session')
    const impersonatedUserId = request.headers.get('X-Impersonated-User-Id')
    
    let effectiveUserId = user.id
    let isImpersonating = false
    
    if (impersonationSession && impersonatedUserId) {
      // TODO: Validate impersonation session using adminImpersonationService
      // For now, we'll trust the headers if they exist (admin validation should be done)
      effectiveUserId = impersonatedUserId
      isImpersonating = true
      console.info(`[${requestId}] Impersonation detected`, { 
        adminUserId: user.id,
        impersonatedUserId,
        sessionToken: impersonationSession
      })
    }

    console.debug(`[${requestId}] User authenticated`, { 
      userId: user.id, 
      effectiveUserId,
      isImpersonating 
    })
    
    // Get query params
    const { searchParams } = new URL(request.url)
    const filters = {
      status: searchParams.get('status'),
      health_status: searchParams.get('health_status'),
      search: searchParams.get('search'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50')
    }
    
    console.debug(`[${requestId}] Request filters parsed`, filters)
    
    const fetchStart = Date.now()
    // Pass the authenticated supabase client to the service
    const deploymentService = createDeploymentService(supabase)
    const deployments = await deploymentService.listDeployments(effectiveUserId)
    const fetchDuration = Date.now() - fetchStart
    
    console.info(`[${requestId}] Deployments fetched`, { 
      count: deployments.length,
      fetchDuration,
      userId: user.id,
      effectiveUserId,
      isImpersonating
    })
    
    // Apply filters
    let filtered = deployments
    
    if (filters.status) {
      filtered = filtered.filter((d: any) => d.status === filters.status)
      console.debug(`[${requestId}] Applied status filter`, { status: filters.status, count: filtered.length })
    }
    
    if (filters.health_status) {
      filtered = filtered.filter((d: any) => d.health_status === filters.health_status)
      console.debug(`[${requestId}] Applied health status filter`, { health_status: filters.health_status, count: filtered.length })
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter((d: any) => 
        d.deployment_name.toLowerCase().includes(searchLower) ||
        d.railway_service_id?.toLowerCase().includes(searchLower)
      )
      console.debug(`[${requestId}] Applied search filter`, { search: filters.search, count: filtered.length })
    }
    
    // Apply pagination
    const startIndex = (filters.page - 1) * filters.limit
    const endIndex = startIndex + filters.limit
    const paginatedData = filtered.slice(startIndex, endIndex)
    
    const response: ListDeploymentsResponse = {
      success: true,
      data: {
        data: paginatedData,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / filters.limit)
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }
    
    console.info(`[${requestId}] List deployments completed successfully`, {
      totalDeployments: deployments.length,
      filteredCount: filtered.length,
      returnedCount: paginatedData.length,
      totalDuration: Date.now() - startTime,
      userId: user.id,
      effectiveUserId,
      isImpersonating
    })
    
    return NextResponse.json(response)
  } catch (error) {
    console.error(`[${requestId}] List deployments failed`, {
      endpoint: '/api/deployments',
      method: 'GET',
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
          message: 'Failed to list deployments' 
        } 
      }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  console.info(`[${requestId}] Create deployment request started`, { 
    endpoint: '/api/deployments',
    method: 'POST',
    timestamp: new Date().toISOString()
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.warn(`[${requestId}] Unauthorized deployment creation attempt`, { 
        endpoint: '/api/deployments',
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

    // Check for impersonation headers
    const impersonationSession = request.headers.get('X-Impersonation-Session')
    const impersonatedUserId = request.headers.get('X-Impersonated-User-Id')
    
    let effectiveUserId = user.id
    let isImpersonating = false
    
    if (impersonationSession && impersonatedUserId) {
      // TODO: Validate impersonation session using adminImpersonationService
      // For now, we'll trust the headers if they exist (admin validation should be done)
      effectiveUserId = impersonatedUserId
      isImpersonating = true
      console.info(`[${requestId}] Impersonation detected for deployment creation`, { 
        adminUserId: user.id,
        impersonatedUserId,
        sessionToken: impersonationSession
      })
    }

    console.debug(`[${requestId}] User authenticated for deployment creation`, { 
      userId: user.id,
      effectiveUserId,
      isImpersonating 
    })

    const body: CreateDeploymentRequest = await request.json()
    
    console.debug(`[${requestId}] Deployment request payload parsed`, {
      deploymentName: body.deployment_name,
      environment: body.environment,
      hasServerTemplateId: !!body.server_template_id,
      hasServerConfig: !!body.server_config,
      userId: user.id
    })
    
    // Validate required fields - support both old and new format
    if (!body.deployment_name) {
      console.warn(`[${requestId}] Invalid deployment request - missing deployment name`, {
        userId: user.id,
        duration: Date.now() - startTime
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Missing required field: deployment_name is required' 
          } 
        }, 
        { status: 400 }
      )
    }

    // Validate required fields - only support multi-server format
    if (!body.server_template_id || !body.server_config) {
      console.warn(`[${requestId}] Invalid deployment request - missing configuration`, {
        hasServerTemplateId: !!body.server_template_id,
        hasServerConfig: !!body.server_config,
        userId: user.id,
        duration: Date.now() - startTime
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Missing required configuration: server_template_id and server_config are required' 
          } 
        }, 
        { status: 400 }
      )
    }

    console.info(`[${requestId}] Deployment validation passed, starting orchestration`, {
      deploymentName: body.deployment_name,
      environment: body.environment || 'production',
      serverTemplateId: body.server_template_id,
      userId: user.id,
      effectiveUserId,
      isImpersonating
    })

    // Use the orchestrator for full deployment flow
    const orchestrator = createDeploymentOrchestrator()
    
    const orchestrationStart = Date.now()
    
    // All deployments use the same generic flow
    const result = await orchestrator.deployServer({
      user_id: effectiveUserId,
      deployment_name: body.deployment_name,
      server_template_id: body.server_template_id,
      server_config: body.server_config,
      railway_project_id: body.railway_project_id,
      transport_type: body.transport_type,
      environment: body.environment || 'production',
      advanced_config: body.advanced_config
    })
    
    const orchestrationDuration = Date.now() - orchestrationStart
    
    if (!result.success) {
      console.error(`[${requestId}] Deployment orchestration failed`, {
        deploymentName: body.deployment_name,
        userId: user.id,
        orchestrationDuration,
        totalDuration: Date.now() - startTime,
        error: result.error,
        serverTemplateId: body.server_template_id
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'DEPLOYMENT_FAILED', 
            message: result.error || 'Deployment failed' 
          } 
        }, 
        { status: 500 }
      )
    }
    
    const response: CreateDeploymentResponse = {
      success: true,
      data: {
        deployment: result.deployment!,
        railway_project_id: result.railwayProject?.id,
        estimated_deploy_time: 300 // 5 minutes
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }
    
    console.info(`[${requestId}] Deployment created successfully`, {
      deploymentId: result.deployment!.id,
      deploymentName: result.deployment!.deployment_name,
      railwayProjectId: result.railwayProject?.id,
      orchestrationDuration,
      totalDuration: Date.now() - startTime,
      userId: user.id,
      effectiveUserId,
      isImpersonating
    })
    
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error(`[${requestId}] Create deployment request failed`, {
      endpoint: '/api/deployments',
      method: 'POST',
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
          message: 'Failed to create deployment' 
        } 
      }, 
      { status: 500 }
    )
  }
}

