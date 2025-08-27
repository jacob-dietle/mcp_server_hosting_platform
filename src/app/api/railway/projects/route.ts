import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRailwayClient } from '@/lib/railway-client'
import { 
  GetRailwayProjectsRequest,
  GetRailwayProjectsResponse,
  CreateRailwayProjectRequest,
  CreateRailwayProjectResponse
} from '@/contracts/api-contracts'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get Railway projects
    const railwayClient = createRailwayClient()
    const projects = await railwayClient.getProjects()

    // Apply search filter if provided
    let filteredProjects = projects
    if (search) {
      const searchLower = search.toLowerCase()
      filteredProjects = projects.filter(project => 
        project.name.toLowerCase().includes(searchLower) ||
        (project.description && project.description.toLowerCase().includes(searchLower))
      )
    }

    // Apply pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedProjects = filteredProjects.slice(startIndex, endIndex)

    const response: GetRailwayProjectsResponse = {
      success: true,
      data: {
        projects: paginatedProjects.map(project => ({
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          isPublic: project.isPublic || false
        }))
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0'
      }
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to get Railway projects:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to get Railway projects' 
        } 
      }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body: CreateRailwayProjectRequest = await request.json()
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Missing required field: name' 
          } 
        }, 
        { status: 400 }
      )
    }

    // Create Railway project
    const railwayClient = createRailwayClient()
    const project = await railwayClient.createProject(body.name, body.description)

    const response: CreateRailwayProjectResponse = {
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0'
      }
    }
    
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Failed to create Railway project:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to create Railway project' 
        } 
      }, 
      { status: 500 }
    )
  }
}
