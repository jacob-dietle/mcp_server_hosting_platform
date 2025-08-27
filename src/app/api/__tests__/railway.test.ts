/**
 * Tests for Railway API Routes
 * Tests Railway project and service management
 */

import { NextRequest } from 'next/server'
import { GET as getRailwayProjects, POST as createRailwayProject } from '../railway/projects/route'
import { GET as getRailwayServices } from '../railway/projects/[id]/services/route'
import { mockSupabaseClient, mockRailwayClient } from './setup'

const createMockRequest = (method: string, body?: any, headers?: Record<string, string>) => {
  const url = 'http://localhost:3000/api/railway/projects'
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

const mockRailwayProject = {
  id: 'railway-project-123',
  name: 'test-project',
  description: 'Test Railway project',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockRailwayService = {
  id: 'railway-service-123',
  name: 'test-service',
  createdAt: '2024-01-01T00:00:00Z',
  status: 'running',
}

describe('Railway API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
  })

  describe('GET /api/railway/projects', () => {
    it('should return Railway projects for authenticated user', async () => {
      const mockProjects = {
        data: [mockRailwayProject],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      }

      mockRailwayClient.getProjects.mockResolvedValue(mockProjects)

      const request = createMockRequest('GET')
      const response = await getRailwayProjects(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockProjects)
      expect(mockRailwayClient.getProjects).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      })
    })

    it('should handle query parameters correctly', async () => {
      const mockProjects = {
        data: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
      }

      mockRailwayClient.getProjects.mockResolvedValue(mockProjects)

      const url = 'http://localhost:3000/api/railway/projects?page=2&limit=5&search=test'
      const request = new NextRequest(url, { method: 'GET' })
      const response = await getRailwayProjects(request)

      expect(mockRailwayClient.getProjects).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        search: 'test',
      })
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      })

      const request = createMockRequest('GET')
      const response = await getRailwayProjects(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should handle Railway API errors', async () => {
      mockRailwayClient.getProjects.mockRejectedValue(new Error('Railway API error'))

      const request = createMockRequest('GET')
      const response = await getRailwayProjects(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('RAILWAY_API_ERROR')
    })
  })

  describe('POST /api/railway/projects', () => {
    const validProjectData = {
      name: 'test-project',
      description: 'Test Railway project',
    }

    it('should create Railway project successfully', async () => {
      mockRailwayClient.createProject.mockResolvedValue(mockRailwayProject)

      const request = createMockRequest('POST', validProjectData)
      const response = await createRailwayProject(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.project).toEqual(mockRailwayProject)
      expect(mockRailwayClient.createProject).toHaveBeenCalledWith(
        validProjectData.name,
        validProjectData.description
      )
    })

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        description: 'Test project',
        // Missing name
      }

      const request = createMockRequest('POST', invalidData)
      const response = await createRailwayProject(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('name')
    })

    it('should return 400 for empty project name', async () => {
      const invalidData = {
        name: '',
        description: 'Test project',
      }

      const request = createMockRequest('POST', invalidData)
      const response = await createRailwayProject(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for project name that is too long', async () => {
      const invalidData = {
        name: 'a'.repeat(101), // Assuming 100 character limit
        description: 'Test project',
      }

      const request = createMockRequest('POST', invalidData)
      const response = await createRailwayProject(request)
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

      const request = createMockRequest('POST', validProjectData)
      const response = await createRailwayProject(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should handle Railway API errors', async () => {
      mockRailwayClient.createProject.mockRejectedValue(new Error('Railway API error'))

      const request = createMockRequest('POST', validProjectData)
      const response = await createRailwayProject(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('RAILWAY_API_ERROR')
    })
  })

  describe('GET /api/railway/projects/[id]/services', () => {
    it('should return Railway services for project', async () => {
      const mockServices = [mockRailwayService]

      mockRailwayClient.getServices.mockResolvedValue(mockServices)

      const request = createMockRequest('GET')
      const params = { params: { id: 'railway-project-123' } }
      const response = await getRailwayServices(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.services).toEqual(mockServices)
      expect(mockRailwayClient.getServices).toHaveBeenCalledWith('railway-project-123')
    })

    it('should return empty array for project with no services', async () => {
      mockRailwayClient.getServices.mockResolvedValue([])

      const request = createMockRequest('GET')
      const params = { params: { id: 'railway-project-123' } }
      const response = await getRailwayServices(request, params)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.services).toEqual([])
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      })

      const request = createMockRequest('GET')
      const params = { params: { id: 'railway-project-123' } }
      const response = await getRailwayServices(request, params)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should handle Railway API errors', async () => {
      mockRailwayClient.getServices.mockRejectedValue(new Error('Railway API error'))

      const request = createMockRequest('GET')
      const params = { params: { id: 'railway-project-123' } }
      const response = await getRailwayServices(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('RAILWAY_API_ERROR')
    })

    it('should handle non-existent project', async () => {
      mockRailwayClient.getServices.mockRejectedValue(new Error('Project not found'))

      const request = createMockRequest('GET')
      const params = { params: { id: 'non-existent-project' } }
      const response = await getRailwayServices(request, params)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('RAILWAY_API_ERROR')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/railway/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json',
      })

      const response = await createRailwayProject(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle missing Railway API key', async () => {
      // This would be tested by mocking the createRailwayClient to throw
      const originalEnv = process.env.RAILWAY_API_KEY
      delete process.env.RAILWAY_API_KEY

      const request = createMockRequest('GET')
      const response = await getRailwayProjects(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)

      // Restore environment
      process.env.RAILWAY_API_KEY = originalEnv
    })
  })
})

