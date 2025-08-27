/**
 * Tests for Restart API Route
 * Tests deployment restart functionality
 */

import { NextRequest } from 'next/server'
import { POST as restartDeployment } from '../deployments/[id]/restart/route'
import { mockSupabaseClient, mockDeploymentService } from './setup'

const createMockRequest = (method: string, body?: any, headers?: Record<string, string>) => {
  const url = 'http://localhost:3000/api/deployments/deployment-123/restart'
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

describe('Restart API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
  })

  describe('POST /api/deployments/[id]/restart', () => {
    it('should restart deployment successfully', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.restartDeployment.mockResolvedValue(true)

      const request = createMockRequest('POST')
      const params = { params: { id: 'deployment-123' } }
      const response = await restartDeployment(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.restarted).toBe(true)
      expect(mockDeploymentService.restartDeployment).toHaveBeenCalledWith('deployment-123')
    })

    it('should return 404 for non-existent deployment', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(null)

      const request = createMockRequest('POST')
      const params = { params: { id: 'non-existent' } }
      const response = await restartDeployment(request, params)
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

      const request = createMockRequest('POST')
      const params = { params: { id: 'deployment-123' } }
      const response = await restartDeployment(request, params)
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

      const request = createMockRequest('POST')
      const params = { params: { id: 'deployment-123' } }
      const response = await restartDeployment(request, params)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should handle service errors gracefully', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.restartDeployment.mockRejectedValue(new Error('Restart failed'))

      const request = createMockRequest('POST')
      const params = { params: { id: 'deployment-123' } }
      const response = await restartDeployment(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})

