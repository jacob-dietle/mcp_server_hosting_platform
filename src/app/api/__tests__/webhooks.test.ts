/**
 * Tests for Webhook API Routes
 * Tests Railway webhook processing and signature verification
 */

import { NextRequest } from 'next/server'
import { POST as processRailwayWebhook } from '../webhooks/railway/route'
import { mockDeploymentService } from './setup'
import crypto from 'crypto'

const createMockWebhookRequest = (body: any, signature?: string) => {
  const bodyString = JSON.stringify(body)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  
  if (signature) {
    headers['x-railway-signature'] = signature
  }

  const request = new NextRequest('http://localhost:3000/api/webhooks/railway', {
    method: 'POST',
    headers,
    body: bodyString,
  })
  
  return request
}

const createValidSignature = (body: string, secret: string = 'test-webhook-secret') => {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
}

const mockWebhookData = {
  type: 'deployment.completed',
  data: {
    deployment_id: 'deployment-123',
    railway_deployment_id: 'railway-deploy-123',
    service_url: 'https://test-service.railway.app',
  },
}

describe('Webhook API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Set webhook secret for tests
    process.env.RAILWAY_WEBHOOK_SECRET = 'test-webhook-secret'
  })

  afterEach(() => {
    delete process.env.RAILWAY_WEBHOOK_SECRET
  })

  describe('POST /api/webhooks/railway', () => {
    it('should process deployment.started webhook successfully', async () => {
      const webhookData = {
        type: 'deployment.started',
        data: {
          deployment_id: 'deployment-123',
          railway_deployment_id: 'railway-deploy-123',
        },
      }

      const bodyString = JSON.stringify(webhookData)
      const signature = createValidSignature(bodyString)
      const request = createMockWebhookRequest(webhookData, signature)

      mockDeploymentService.updateDeployment.mockResolvedValue({})
      mockDeploymentService.addDeploymentLog.mockResolvedValue({})

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.processed).toBe(true)
      expect(data.data.event_type).toBe('deployment.started')

      expect(mockDeploymentService.updateDeployment).toHaveBeenCalledWith(
        'deployment-123',
        {
          status: 'deploying',
          railway_deployment_id: 'railway-deploy-123',
        }
      )

      expect(mockDeploymentService.addDeploymentLog).toHaveBeenCalledWith(
        'deployment-123',
        {
          log_level: 'info',
          message: 'Railway deployment started',
          metadata: {
            railway_deployment_id: 'railway-deploy-123',
            webhook_event: 'deployment.started',
          },
        }
      )
    })

    it('should process deployment.completed webhook successfully', async () => {
      const webhookData = {
        type: 'deployment.completed',
        data: {
          deployment_id: 'deployment-123',
          railway_deployment_id: 'railway-deploy-123',
          service_url: 'https://test-service.railway.app',
        },
      }

      const bodyString = JSON.stringify(webhookData)
      const signature = createValidSignature(bodyString)
      const request = createMockWebhookRequest(webhookData, signature)

      mockDeploymentService.updateDeployment.mockResolvedValue({})
      mockDeploymentService.addDeploymentLog.mockResolvedValue({})

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      expect(mockDeploymentService.updateDeployment).toHaveBeenCalledWith(
        'deployment-123',
        expect.objectContaining({
          status: 'running',
          service_url: 'https://test-service.railway.app',
          deployed_at: expect.any(String),
        })
      )

      expect(mockDeploymentService.addDeploymentLog).toHaveBeenCalledWith(
        'deployment-123',
        {
          log_level: 'info',
          message: 'Railway deployment completed successfully',
          metadata: {
            railway_deployment_id: 'railway-deploy-123',
            service_url: 'https://test-service.railway.app',
            webhook_event: 'deployment.completed',
          },
        }
      )
    })

    it('should process deployment.failed webhook successfully', async () => {
      const webhookData = {
        type: 'deployment.failed',
        data: {
          deployment_id: 'deployment-123',
          railway_deployment_id: 'railway-deploy-123',
          error_message: 'Build failed: missing dependencies',
        },
      }

      const bodyString = JSON.stringify(webhookData)
      const signature = createValidSignature(bodyString)
      const request = createMockWebhookRequest(webhookData, signature)

      mockDeploymentService.updateDeployment.mockResolvedValue({})
      mockDeploymentService.addDeploymentLog.mockResolvedValue({})

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      expect(mockDeploymentService.updateDeployment).toHaveBeenCalledWith(
        'deployment-123',
        {
          status: 'failed',
          error_message: 'Build failed: missing dependencies',
        }
      )

      expect(mockDeploymentService.addDeploymentLog).toHaveBeenCalledWith(
        'deployment-123',
        {
          log_level: 'error',
          message: 'Railway deployment failed: Build failed: missing dependencies',
          metadata: {
            railway_deployment_id: 'railway-deploy-123',
            error_message: 'Build failed: missing dependencies',
            webhook_event: 'deployment.failed',
          },
        }
      )
    })

    it('should handle unrecognized webhook event types', async () => {
      const webhookData = {
        type: 'unknown.event',
        data: {
          deployment_id: 'deployment-123',
          railway_deployment_id: 'railway-deploy-123',
        },
      }

      const bodyString = JSON.stringify(webhookData)
      const signature = createValidSignature(bodyString)
      const request = createMockWebhookRequest(webhookData, signature)

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.processed).toBe(true)
      expect(data.data.event_type).toBe('unknown.event')

      // Should not call any deployment service methods for unknown events
      expect(mockDeploymentService.updateDeployment).not.toHaveBeenCalled()
      expect(mockDeploymentService.addDeploymentLog).not.toHaveBeenCalled()
    })

    it('should return 401 for invalid signature', async () => {
      const webhookData = mockWebhookData
      const invalidSignature = 'sha256=invalid-signature'
      const request = createMockWebhookRequest(webhookData, invalidSignature)

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_SIGNATURE')
    })

    it('should return 401 for missing signature', async () => {
      const webhookData = mockWebhookData
      const request = createMockWebhookRequest(webhookData) // No signature

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_SIGNATURE')
    })

    it('should allow requests when webhook secret is not configured', async () => {
      delete process.env.RAILWAY_WEBHOOK_SECRET

      const webhookData = mockWebhookData
      const request = createMockWebhookRequest(webhookData) // No signature

      mockDeploymentService.updateDeployment.mockResolvedValue({})
      mockDeploymentService.addDeploymentLog.mockResolvedValue({})

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle webhooks without deployment_id', async () => {
      const webhookData = {
        type: 'deployment.completed',
        data: {
          railway_deployment_id: 'railway-deploy-123',
          service_url: 'https://test-service.railway.app',
          // No deployment_id
        },
      }

      const bodyString = JSON.stringify(webhookData)
      const signature = createValidSignature(bodyString)
      const request = createMockWebhookRequest(webhookData, signature)

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Should not call deployment service methods without deployment_id
      expect(mockDeploymentService.updateDeployment).not.toHaveBeenCalled()
      expect(mockDeploymentService.addDeploymentLog).not.toHaveBeenCalled()
    })

    it('should handle service errors gracefully', async () => {
      const webhookData = mockWebhookData
      const bodyString = JSON.stringify(webhookData)
      const signature = createValidSignature(bodyString)
      const request = createMockWebhookRequest(webhookData, signature)

      mockDeploymentService.updateDeployment.mockRejectedValue(new Error('Database error'))

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('WEBHOOK_PROCESSING_ERROR')
    })

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/railway', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-railway-signature': 'sha256=invalid',
        },
        body: 'invalid json',
      })

      const response = await processRailwayWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('WEBHOOK_PROCESSING_ERROR')
    })
  })

  describe('Signature Verification', () => {
    it('should verify signature correctly with different secrets', async () => {
      const secret1 = 'secret-1'
      const secret2 = 'secret-2'
      const body = JSON.stringify(mockWebhookData)

      const signature1 = createValidSignature(body, secret1)
      const signature2 = createValidSignature(body, secret2)

      // Test with correct secret
      process.env.RAILWAY_WEBHOOK_SECRET = secret1
      const request1 = createMockWebhookRequest(mockWebhookData, signature1)
      mockDeploymentService.updateDeployment.mockResolvedValue({})
      mockDeploymentService.addDeploymentLog.mockResolvedValue({})

      const response1 = await processRailwayWebhook(request1)
      expect(response1.status).toBe(200)

      // Test with wrong secret
      process.env.RAILWAY_WEBHOOK_SECRET = secret2
      const request2 = createMockWebhookRequest(mockWebhookData, signature1)

      const response2 = await processRailwayWebhook(request2)
      expect(response2.status).toBe(401)
    })

    it('should handle signature format variations', async () => {
      const body = JSON.stringify(mockWebhookData)
      const hash = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex')

      // Test with proper sha256= prefix
      const validSignature = `sha256=${hash}`
      const request1 = createMockWebhookRequest(mockWebhookData, validSignature)
      mockDeploymentService.updateDeployment.mockResolvedValue({})
      mockDeploymentService.addDeploymentLog.mockResolvedValue({})

      const response1 = await processRailwayWebhook(request1)
      expect(response1.status).toBe(200)

      // Test without sha256= prefix (should fail)
      const invalidSignature = hash
      const request2 = createMockWebhookRequest(mockWebhookData, invalidSignature)

      const response2 = await processRailwayWebhook(request2)
      expect(response2.status).toBe(401)
    })
  })
})

