/**
 * Tests for Logs API Routes
 * Tests log retrieval, streaming, and log entry creation
 */

import { NextRequest } from 'next/server'
import { GET as getLogs, POST as addLog } from '../deployments/[id]/logs/route'
import { mockSupabaseClient, mockDeploymentService } from './setup'

const createMockRequest = (method: string, body?: any, headers?: Record<string, string>) => {
  const url = 'http://localhost:3000/api/deployments/deployment-123/logs'
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

const mockLog = {
  id: 'log-123',
  deployment_id: 'deployment-123',
  log_level: 'info',
  message: 'Test log message',
  timestamp: '2024-01-01T00:00:00Z',
  metadata: { source: 'application' },
}

describe('Logs API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
  })

  describe('GET /api/deployments/[id]/logs', () => {
    it('should return logs for deployment owner', async () => {
      const mockLogs = [mockLog]

      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.getDeploymentLogs.mockResolvedValue(mockLogs)

      const request = createMockRequest('GET')
      const params = { params: { id: 'deployment-123' } }
      const response = await getLogs(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.data).toEqual(mockLogs)
      expect(mockDeploymentService.getDeploymentLogs).toHaveBeenCalledWith(
        'deployment-123',
        50 // default limit
      )
    })

    it('should handle limit parameter', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.getDeploymentLogs.mockResolvedValue([])

      const url = 'http://localhost:3000/api/deployments/deployment-123/logs?limit=100'
      const request = new NextRequest(url, { method: 'GET' })
      const params = { params: { id: 'deployment-123' } }
      const response = await getLogs(request, params)

      expect(mockDeploymentService.getDeploymentLogs).toHaveBeenCalledWith(
        'deployment-123',
        100
      )
    })

    it('should handle streaming request with SSE', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)

      const request = createMockRequest('GET', null, { 
        'accept': 'text/event-stream',
        'cache-control': 'no-cache'
      })
      const params = { params: { id: 'deployment-123' } }
      const response = await getLogs(request, params)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      expect(response.headers.get('cache-control')).toBe('no-cache')
      expect(response.headers.get('connection')).toBe('keep-alive')
    })

    it('should return 404 for non-existent deployment', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(null)

      const request = createMockRequest('GET')
      const params = { params: { id: 'non-existent' } }
      const response = await getLogs(request, params)
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
      const response = await getLogs(request, params)
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
      const response = await getLogs(request, params)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('POST /api/deployments/[id]/logs', () => {
    const validLogData = {
      log_level: 'info' as const,
      message: 'Test log message',
      metadata: { source: 'application' },
    }

    it('should add log entry successfully', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.addDeploymentLog.mockResolvedValue(mockLog)

      const request = createMockRequest('POST', validLogData)
      const params = { params: { id: 'deployment-123' } }
      const response = await addLog(request, params)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.log).toEqual(mockLog)
      expect(mockDeploymentService.addDeploymentLog).toHaveBeenCalledWith(
        'deployment-123',
        validLogData
      )
    })

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        message: 'Test message',
        // Missing log_level
      }

      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)

      const request = createMockRequest('POST', invalidData)
      const params = { params: { id: 'deployment-123' } }
      const response = await addLog(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('log_level')
    })

    it('should return 400 for missing message', async () => {
      const invalidData = {
        log_level: 'info' as const,
        // Missing message
      }

      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)

      const request = createMockRequest('POST', invalidData)
      const params = { params: { id: 'deployment-123' } }
      const response = await addLog(request, params)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('message')
    })

    it('should accept valid log levels', async () => {
      const logLevels = ['debug', 'info', 'warn', 'error'] as const

      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.addDeploymentLog.mockResolvedValue(mockLog)

      for (const level of logLevels) {
        const logData = {
          log_level: level,
          message: `Test ${level} message`,
        }

        const request = createMockRequest('POST', logData)
        const params = { params: { id: 'deployment-123' } }
        const response = await addLog(request, params)

        expect(response.status).toBe(201)
      }
    })

    it('should return 404 for non-existent deployment', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(null)

      const request = createMockRequest('POST', validLogData)
      const params = { params: { id: 'non-existent' } }
      const response = await addLog(request, params)
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

      const request = createMockRequest('POST', validLogData)
      const params = { params: { id: 'deployment-123' } }
      const response = await addLog(request, params)
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

      const request = createMockRequest('POST', validLogData)
      const params = { params: { id: 'deployment-123' } }
      const response = await addLog(request, params)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.getDeploymentLogs.mockRejectedValue(new Error('Database error'))

      const request = createMockRequest('GET')
      const params = { params: { id: 'deployment-123' } }
      const response = await getLogs(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle malformed JSON in request body', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)

      const request = new NextRequest('http://localhost:3000/api/deployments/deployment-123/logs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json',
      })

      const params = { params: { id: 'deployment-123' } }
      const response = await addLog(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})

