import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDeploymentService } from '@/lib/deployment'
import { createDeploymentOrchestrator } from '@/lib/deployment'
import { 
  RestartDeploymentRequest,
  RestartDeploymentResponse
} from '@/contracts/api-contracts'

const deploymentService = createDeploymentService()

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
    const body: RestartDeploymentRequest = await request.json()

    // Verify deployment exists and belongs to user (RLS handles user filtering)
    const deployment = await deploymentService.getDeployment(deploymentId)
    
    if (!deployment) {
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

    // Use orchestrator to restart deployment
    const orchestrator = createDeploymentOrchestrator()
    const result = await orchestrator.restartDeployment(deploymentId, {
      force_rebuild: body.force_rebuild || false
    })

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'RESTART_FAILED', 
            message: result.error || 'Failed to restart deployment' 
          } 
        }, 
        { status: 500 }
      )
    }

    // Get updated deployment
    const updatedDeployment = await deploymentService.getDeployment(deploymentId)

    const response: RestartDeploymentResponse = {
      success: true,
      data: {
        deployment: updatedDeployment!,
        restart_initiated: true
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0'
      }
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to restart deployment:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to restart deployment' 
        } 
      }, 
      { status: 500 }
    )
  }
}

