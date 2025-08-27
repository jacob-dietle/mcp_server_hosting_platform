import { NextRequest, NextResponse } from 'next/server'
import { createHealthMonitor } from '@/lib/deployment'
import { createDeploymentService } from '@/lib/deployment'
import logger from '@/lib/logger'

const healthMonitor = createHealthMonitor()
const deploymentService = createDeploymentService()

// POST /api/deployments/[id]/health/monitor - Start health monitoring
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Log endpoint access
  logger.info('POST /api/deployments/[id]/health/monitor', { deploymentId: params.id })

  try {
    const deploymentId = params.id

    if (!deploymentId) {
      return NextResponse.json(
        { success: false, error: 'Deployment ID is required' },
        { status: 400 }
      )
    }

    // Check if deployment exists and is running
    const deployment = await deploymentService.getDeployment(deploymentId)
    if (!deployment) {
      return NextResponse.json(
        { success: false, error: 'Deployment not found' },
        { status: 404 }
      )
    }

    if (deployment.status !== 'running') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot monitor deployment with status: ${deployment.status}` 
        },
        { status: 400 }
      )
    }

    // Start monitoring
    await healthMonitor.startMonitoring(deploymentId)

    logger.info('Health monitoring started', {
      deploymentId,
      serviceUrl: deployment.service_url
    })

    return NextResponse.json({
      success: true,
      data: {
        deploymentId,
        monitoring: true,
        message: 'Health monitoring started'
      }
    })

  } catch (error) {
    logger.error('Failed to start health monitoring', {
      deploymentId: params.id,
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to start health monitoring' 
      },
      { status: 500 }
    )
  }
}

// DELETE /api/deployments/[id]/health/monitor - Stop health monitoring
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deploymentId = params.id

    if (!deploymentId) {
      return NextResponse.json(
        { success: false, error: 'Deployment ID is required' },
        { status: 400 }
      )
    }

    // Stop monitoring
    healthMonitor.stopMonitoring(deploymentId)

    logger.info('Health monitoring stopped', { 
      endpoint: 'DELETE /api/deployments/[id]/health/monitor',
      deploymentId 
    })

    return NextResponse.json({
      success: true,
      data: {
        deploymentId,
        monitoring: false,
        message: 'Health monitoring stopped'
      }
    })

  } catch (error) {
    logger.error('Failed to stop health monitoring', {
      endpoint: 'DELETE /api/deployments/[id]/health/monitor',
      deploymentId: params.id,
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to stop health monitoring' 
      },
      { status: 500 }
    )
  }
}

// GET /api/deployments/[id]/health/monitor - Get monitoring status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deploymentId = params.id

    if (!deploymentId) {
      return NextResponse.json(
        { success: false, error: 'Deployment ID is required' },
        { status: 400 }
      )
    }

    const isMonitoring = healthMonitor.isMonitoring(deploymentId)
    const allStatus = healthMonitor.getMonitoringStatus()
    const deploymentStatus = allStatus.find(s => s.deploymentId === deploymentId)

    return NextResponse.json({
      success: true,
      data: {
        deploymentId,
        isMonitoring,
        lastCheck: deploymentStatus?.lastCheck || null,
        consecutiveFailures: deploymentStatus?.consecutiveFailures || 0
      }
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get monitoring status' 
      },
      { status: 500 }
    )
  }
} 