/**
 * Tests for Health Check API Routes
 * Tests health monitoring and recording functionality
 */

import { NextRequest } from 'next/server'
import { GET as getHealthChecks, POST as recordHealthCheck } from '../deployments/[id]/health/route'
import { mockSupabaseClient, mockDeploymentService } from './setup'

const createMockRequest = (method: string, body?: any, headers?: Record<string, string>) => {
  const url = 'http://localhost:3000/api/deployments/deployment-123/health'
  const request = new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return request
}

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
}

const mockDeployment = {
  id: 'deployment-123',
  user_id: 'user-123',
  deployment_name: 'test-deployment',
  status: 'running',
}

const mockHealthCheck = {
  id: 'health-123',
  deployment_id: 'deployment-123',
  status: 'healthy',
  response_time: 150,
  checked_at: '2024-01-01T00:00:00Z',
  metadata: { endpoint: '/health' },
}

describe('Health Check API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
  })

  describe('GET /api/deployments/[id]/health', () => {
    it('should return latest health checks for deployment owner', async () => {
      const mockHealthChecks = [mockHealthCheck]

      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.getLatestHealthChecks.mockResolvedValue(mockHealthChecks)

      const request = createMockRequest('GET')
      const params = { params: { id: 'deployment-123' } }
      const response = await getHealthChecks(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.data).toEqual(mockHealthChecks)
      expect(mockDeploymentService.getLatestHealthChecks).toHaveBeenCalledWith(
        'deployment-123',
        10
      )
    })

    it('should handle limit parameter', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.getLatestHealthChecks.mockResolvedValue([])

      const url = 'http://localhost:3000/api/deployments/deployment-123/health?limit=5'
      const request = new NextRequest(url, { method: 'GET' })
      const params = { params: { id: 'deployment-123' } }
      const response = await getHealthChecks(request, params)

      expect(mockDeploymentService.getLatestHealthChecks).toHaveBeenCalledWith(
        'deployment-123',
        5
      )
    })

    it('should return 404 for non-existent deployment', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(null)

      const request = createMockRequest('GET')
      const params = { params: { id: 'non-existent' } }
      const response = await getHealthChecks(request, params)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 for deployment owned by different user', async () => {
      const otherUserDeployment = {
        ...mockDeployment,
        user_id: 'other-user',
      }

      mockDeploymentService.getDeployment.mockResolvedValue(otherUserDeployment)

      const request = createMockRequest('GET')
      const params = { params: { id: 'deployment-123' } }
      const response = await getHealthChecks(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      })

      const request = createMockRequest('GET')
      const params = { params: { id: 'deployment-123' } }
      const response = await getHealthChecks(request, params)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('POST /api/deployments/[id]/health', () => {
    const validHealthCheckData = {
      status: 'healthy' as const,
      response_time: 150,
      metadata: { endpoint: '/health' },
    }

    it('should record health check successfully', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.recordHealthCheck.mockResolvedValue(mockHealthCheck)

      const request = createMockRequest('POST', validHealthCheckData)
      const params = { params: { id: 'deployment-123' } }
      const response = await recordHealthCheck(request, params)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.health_check).toEqual(mockHealthCheck)
      expect(mockDeploymentService.recordHealthCheck).toHaveBeenCalledWith(
        'deployment-123',
        validHealthCheckData
      )
    })

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        response_time: 150,
        // Missing status
      }

      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)

      const request = createMockRequest('POST', invalidData)
      const params = { params: { id: 'deployment-123' } }
      const response = await recordHealthCheck(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid status value', async () => {
      const invalidData = {
        status: 'invalid-status',
        response_time: 150,
      }

      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)

      const request = createMockRequest('POST', invalidData)
      const params = { params: { id: 'deployment-123' } }
      const response = await recordHealthCheck(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for negative response time', async () => {
      const invalidData = {
        status: 'healthy' as const,
        response_time: -50,
      }

      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)

      const request = createMockRequest('POST', invalidData)
      const params = { params: { id: 'deployment-123' } }
      const response = await recordHealthCheck(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 404 for non-existent deployment', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(null)

      const request = createMockRequest('POST', validHealthCheckData)
      const params = { params: { id: 'non-existent' } }
      const response = await recordHealthCheck(request, params)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 for deployment owned by different user', async () => {
      const otherUserDeployment = {
        ...mockDeployment,
        user_id: 'other-user',
      }

      mockDeploymentService.getDeployment.mockResolvedValue(otherUserDeployment)

      const request = createMockRequest('POST', validHealthCheckData)
      const params = { params: { id: 'deployment-123' } }
      const response = await recordHealthCheck(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      })

      const request = createMockRequest('POST', validHealthCheckData)
      const params = { params: { id: 'deployment-123' } }
      const response = await recordHealthCheck(request, params)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.getLatestHealthChecks.mockRejectedValue(new Error('Database error'))

      const request = createMockRequest('GET')
      const params = { params: { id: 'deployment-123' } }
      const response = await getHealthChecks(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle malformed JSON in request body', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)

      const request = new NextRequest('http://localhost:3000/api/deployments/deployment-123/health', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json',
      })

      const params = { params: { id: 'deployment-123' } }
      const response = await recordHealthCheck(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})

