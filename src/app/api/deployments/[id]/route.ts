import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDeploymentService } from '@/lib/deployment'
import { UpdateDeploymentInput } from '@/contracts/service-contracts'
import logger from '@/lib/logger'

const deploymentService = createDeploymentService()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  logger.info(`[${requestId}] Get deployment request started`, { 
    deploymentId: params.id,
    endpoint: `/api/deployments/${params.id}`,
    method: 'GET'
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      logger.warn(`[${requestId}] Unauthorized access attempt`)
      return NextResponse.json({ 
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' } 
      }, { status: 401 })
    }

    const deployment = await deploymentService.getDeployment(params.id)
    
    if (!deployment) {
      return NextResponse.json({ 
        success: false,
        error: { code: 'NOT_FOUND', message: 'Deployment not found' } 
      }, { status: 404 })
    }

    // Verify user owns this deployment
    if (deployment.user_id !== user.id) {
      return NextResponse.json({ 
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' } 
      }, { status: 403 })
    }

    logger.info(`[${requestId}] Deployment retrieved successfully`, {
      deploymentId: params.id,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: deployment
    })
  } catch (error) {
    logger.error(`[${requestId}] Get deployment failed`, {
      deploymentId: params.id,
      duration: Date.now() - startTime,
      error
    })
    
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get deployment' } }, 
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  logger.info(`[${requestId}] Update deployment request started`, { 
    deploymentId: params.id,
    endpoint: `/api/deployments/${params.id}`,
    method: 'PATCH'
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' } 
      }, { status: 401 })
    }

    // Verify ownership before update
    const existing = await deploymentService.getDeployment(params.id)
    if (!existing) {
      return NextResponse.json({ 
        success: false,
        error: { code: 'NOT_FOUND', message: 'Deployment not found' } 
      }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ 
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' } 
      }, { status: 403 })
    }

    const body: UpdateDeploymentInput = await request.json()
    const updated = await deploymentService.updateDeployment(params.id, body)

    logger.info(`[${requestId}] Deployment updated successfully`, {
      deploymentId: params.id,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: updated
    })
  } catch (error) {
    logger.error(`[${requestId}] Update deployment failed`, {
      deploymentId: params.id,
      duration: Date.now() - startTime,
      error
    })
    
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update deployment' } }, 
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  logger.info(`[${requestId}] Delete deployment request started`, { 
    deploymentId: params.id,
    endpoint: `/api/deployments/${params.id}`,
    method: 'DELETE'
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' } 
      }, { status: 401 })
    }

    // Verify ownership before deletion
    const existing = await deploymentService.getDeployment(params.id)
    if (!existing) {
      return NextResponse.json({ 
        success: false,
        error: { code: 'NOT_FOUND', message: 'Deployment not found' } 
      }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ 
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' } 
      }, { status: 403 })
    }

    await deploymentService.deleteDeployment(params.id)

    logger.info(`[${requestId}] Deployment deleted successfully`, {
      deploymentId: params.id,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: { id: params.id }
    })
  } catch (error) {
    logger.error(`[${requestId}] Delete deployment failed`, {
      deploymentId: params.id,
      duration: Date.now() - startTime,
      error
    })
    
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete deployment' } }, 
      { status: 500 }
    )
  }
}
