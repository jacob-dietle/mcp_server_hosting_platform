/**
 * Tests for Deployment API Routes
 * Tests all CRUD operations and security for deployment management
 */

import { NextRequest } from 'next/server'
import { GET as getDeployments, POST as createDeployment } from '../deployments/route'
import { GET as getDeployment, PATCH as updateDeployment, DELETE as deleteDeployment } from '../deployments/[id]/route'
import { mockSupabaseClient, mockDeploymentService } from './setup'

// Mock Next.js request/response
const createMockRequest = (method: string, body?: any, headers?: Record<string, string>) => {
  const url = 'http://localhost:3000/api/deployments'
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
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('Deployment API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default to authenticated user
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
  })

  describe('GET /api/deployments', () => {
    it('should return deployments for authenticated user', async () => {
      const mockDeployments = {
        data: [mockDeployment],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      }

      mockDeploymentService.getDeployments.mockResolvedValue(mockDeployments)

      const request = createMockRequest('GET')
      const response = await getDeployments(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockDeployments)
      expect(mockDeploymentService.getDeployments).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          page: 1,
          limit: 10,
        })
      )
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      })

      const request = createMockRequest('GET')
      const response = await getDeployments(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should handle query parameters correctly', async () => {
      const mockDeployments = {
        data: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
      }

      mockDeploymentService.getDeployments.mockResolvedValue(mockDeployments)

      const url = 'http://localhost:3000/api/deployments?page=2&limit=5&status=running&search=test'
      const request = new NextRequest(url, { method: 'GET' })
      const response = await getDeployments(request)

      expect(mockDeploymentService.getDeployments).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          page: 2,
          limit: 5,
          status: 'running',
          search: 'test',
        })
      )
    })
  })

  describe('POST /api/deployments', () => {
    const validDeploymentData = {
      deployment_name: 'test-deployment',
      emailbison_config: {
        api_key: 'test-key',
        base_url: 'https://api.emailbison.com',
      },
      environment: 'development' as const,
    }

    it('should create deployment successfully', async () => {
      const createdDeployment = {
        ...mockDeployment,
        ...validDeploymentData,
      }

      mockDeploymentService.createDeployment.mockResolvedValue(createdDeployment)

      const request = createMockRequest('POST', validDeploymentData)
      const response = await createDeployment(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.deployment).toEqual(createdDeployment)
      expect(mockDeploymentService.createDeployment).toHaveBeenCalledWith(
        expect.objectContaining({
          ...validDeploymentData,
          user_id: mockUser.id,
        })
      )
    })

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        deployment_name: 'test',
        // Missing emailbison_config
      }

      const request = createMockRequest('POST', invalidData)
      const response = await createDeployment(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      })

      const request = createMockRequest('POST', validDeploymentData)
      const response = await createDeployment(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('GET /api/deployments/[id]', () => {
    it('should return deployment for owner', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)

      const request = createMockRequest('GET')
      const params = { params: { id: 'deployment-123' } }
      const response = await getDeployment(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deployment).toEqual(mockDeployment)
      expect(mockDeploymentService.getDeployment).toHaveBeenCalledWith('deployment-123')
    })

    it('should return 404 for non-existent deployment', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(null)

      const request = createMockRequest('GET')
      const params = { params: { id: 'non-existent' } }
      const response = await getDeployment(request, params)
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
      const response = await getDeployment(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })

  describe('PATCH /api/deployments/[id]', () => {
    const updateData = {
      deployment_name: 'updated-deployment',
      status: 'stopped' as const,
    }

    it('should update deployment successfully', async () => {
      const updatedDeployment = {
        ...mockDeployment,
        ...updateData,
      }

      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.updateDeployment.mockResolvedValue(updatedDeployment)

      const request = createMockRequest('PATCH', updateData)
      const params = { params: { id: 'deployment-123' } }
      const response = await updateDeployment(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deployment).toEqual(updatedDeployment)
      expect(mockDeploymentService.updateDeployment).toHaveBeenCalledWith(
        'deployment-123',
        updateData
      )
    })

    it('should return 404 for non-existent deployment', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(null)

      const request = createMockRequest('PATCH', updateData)
      const params = { params: { id: 'non-existent' } }
      const response = await updateDeployment(request, params)
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

      const request = createMockRequest('PATCH', updateData)
      const params = { params: { id: 'deployment-123' } }
      const response = await updateDeployment(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })

  describe('DELETE /api/deployments/[id]', () => {
    it('should delete deployment successfully', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(mockDeployment)
      mockDeploymentService.deleteDeployment.mockResolvedValue(true)

      const request = createMockRequest('DELETE')
      const params = { params: { id: 'deployment-123' } }
      const response = await deleteDeployment(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockDeploymentService.deleteDeployment).toHaveBeenCalledWith('deployment-123')
    })

    it('should return 404 for non-existent deployment', async () => {
      mockDeploymentService.getDeployment.mockResolvedValue(null)

      const request = createMockRequest('DELETE')
      const params = { params: { id: 'non-existent' } }
      const response = await deleteDeployment(request, params)
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

      const request = createMockRequest('DELETE')
      const params = { params: { id: 'deployment-123' } }
      const response = await deleteDeployment(request, params)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockDeploymentService.getDeployments.mockRejectedValue(new Error('Database error'))

      const request = createMockRequest('GET')
      const response = await getDeployments(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/deployments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json',
      })

      const response = await createDeployment(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})

