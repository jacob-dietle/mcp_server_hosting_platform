import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDeploymentService } from '@/lib/deployment'
import { 
  GetHealthChecksRequest,
  GetHealthChecksResponse,
  PerformHealthCheckRequest,
  PerformHealthCheckResponse
} from '@/contracts/api-contracts'

const deploymentService = createDeploymentService()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: { 
          code: 'UNAUTHORIZED', 
          message: 'Authentication required' 
        } 
      }, { status: 401 })
    }

    const deploymentId = params.id
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Verify deployment exists and belongs to user
    const deployment = await deploymentService.getDeployment(deploymentId)
    
    if (!deployment || deployment.user_id !== user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: 'Deployment not found' 
          } 
        }, 
        { status: 404 }
      )
    }

    // Get latest health checks (simplified for now)
    const healthChecks = await deploymentService.getLatestHealthChecks(deploymentId, limit)

    const response: GetHealthChecksResponse = {
      success: true,
      data: {
        data: healthChecks,
        pagination: {
          page: 1,
          limit: healthChecks.length,
          total: healthChecks.length,
          totalPages: 1
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0'
      }
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to get health checks:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to get health checks' 
        } 
      }, 
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: { 
          code: 'UNAUTHORIZED', 
          message: 'Authentication required' 
        } 
      }, { status: 401 })
    }

    const deploymentId = params.id
    
    // Handle empty request body gracefully (health checks don't need parameters)
    let body: PerformHealthCheckRequest = {}
    try {
      const requestText = await request.text()
      if (requestText.trim()) {
        body = JSON.parse(requestText)
      }
    } catch (error) {
      // Empty body is fine for health checks
      body = {}
    }

    // Verify deployment exists and belongs to user
    const deployment = await deploymentService.getDeployment(deploymentId)
    
    if (!deployment || deployment.user_id !== user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: 'Deployment not found' 
          } 
        }, 
        { status: 404 }
      )
    }

    // Use orchestrator to perform health check
    const { createDeploymentOrchestrator } = await import('@/lib/deployment')
    const orchestrator = createDeploymentOrchestrator()
    const healthCheck = await orchestrator.performHealthCheck(deploymentId)

    const response: PerformHealthCheckResponse = {
      success: true,
      data: {
        health_check: healthCheck,
        performed_at: new Date().toISOString()
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0'
      }
    }
    
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Failed to perform health check:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to perform health check' 
        } 
      }, 
      { status: 500 }
    )
  }
}
