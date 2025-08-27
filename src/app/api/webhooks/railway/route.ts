import { NextRequest, NextResponse } from 'next/server'
import { createDeploymentService } from '@/lib/deployment'
import { 
  RailwayWebhookRequest,
  RailwayWebhookResponse
} from '@/contracts/api-contracts'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('x-railway-signature')
    const body = await request.text()
    
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_SIGNATURE', 
            message: 'Invalid webhook signature' 
          } 
        }, 
        { status: 401 }
      )
    }

    const webhookData: RailwayWebhookRequest = JSON.parse(body)
    
    // Process webhook based on event type
    const deploymentService = createDeploymentService()
    
    switch (webhookData.type) {
      case 'deployment.started':
        await handleDeploymentStarted(deploymentService, webhookData)
        break
        
      case 'deployment.completed':
        await handleDeploymentCompleted(deploymentService, webhookData)
        break
        
      case 'deployment.failed':
        await handleDeploymentFailed(deploymentService, webhookData)
        break
        
      default:
        console.log(`Unhandled webhook event type: ${webhookData.type}`)
    }

    const response: RailwayWebhookResponse = {
      success: true,
      data: {
        processed: true,
        event_type: webhookData.type
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0'
      }
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to process Railway webhook:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'WEBHOOK_PROCESSING_ERROR', 
          message: 'Failed to process webhook' 
        } 
      }, 
      { status: 500 }
    )
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  
  const webhookSecret = process.env.RAILWAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.warn('RAILWAY_WEBHOOK_SECRET not configured, skipping signature verification')
    return true // Allow in development
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex')
    
  return signature === `sha256=${expectedSignature}`
}

async function handleDeploymentStarted(
  deploymentService: any,
  webhookData: RailwayWebhookRequest
) {
  const { deployment_id, railway_deployment_id } = webhookData.data
  
  if (deployment_id) {
    await deploymentService.updateDeployment(deployment_id, {
      status: 'deploying',
      railway_deployment_id
    })
    
    await deploymentService.addDeploymentLog(deployment_id, {
      log_level: 'info',
      message: 'Railway deployment started',
      metadata: { 
        railway_deployment_id,
        webhook_event: 'deployment.started'
      }
    })
  }
}

async function handleDeploymentCompleted(
  deploymentService: any,
  webhookData: RailwayWebhookRequest
) {
  const { deployment_id, railway_deployment_id, service_url } = webhookData.data
  
  if (deployment_id) {
    await deploymentService.updateDeployment(deployment_id, {
      status: 'running',
      service_url,
      deployed_at: new Date().toISOString()
    })
    
    await deploymentService.addDeploymentLog(deployment_id, {
      log_level: 'info',
      message: 'Railway deployment completed successfully',
      metadata: { 
        railway_deployment_id,
        service_url,
        webhook_event: 'deployment.completed'
      }
    })
  }
}

async function handleDeploymentFailed(
  deploymentService: any,
  webhookData: RailwayWebhookRequest
) {
  const { deployment_id, railway_deployment_id, error_message } = webhookData.data
  
  if (deployment_id) {
    await deploymentService.updateDeployment(deployment_id, {
      status: 'failed',
      error_message
    })
    
    await deploymentService.addDeploymentLog(deployment_id, {
      log_level: 'error',
      message: `Railway deployment failed: ${error_message}`,
      metadata: { 
        railway_deployment_id,
        error_message,
        webhook_event: 'deployment.failed'
      }
    })
  }
}

