import { NextRequest, NextResponse } from 'next/server'
import { RailwayApiError } from '@/contracts/service-contracts'
import { createRailwayClient } from '@/lib/railway-client'

export async function GET(request: NextRequest) {
  // SECURITY: Disable test routes in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test routes are disabled in production' },
      { status: 404 }
    )
  }

  const results = {
    timestamp: new Date().toISOString(),
    tests: {} as any,
    error: undefined as string | undefined
  }

  try {
    const railwayClient = createRailwayClient()
    
    // Test 1: Get Projects
    try {
      const projects = await railwayClient.getProjects()
      results.tests.getProjects = {
        success: true,
        count: projects.length,
        sample: projects.slice(0, 2).map(p => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt
        }))
      }
      
      // Test 2: Get Environments for first project
      if (projects.length > 0) {
        const projectId = projects[0].id
        try {
          const environments = await railwayClient.getEnvironments(projectId)
          results.tests.getEnvironments = {
            success: true,
            projectId,
            count: environments.length,
            environments: environments.map(e => ({
              id: e.id,
              name: e.name,
              isEphemeral: e.isEphemeral
            }))
          }
        } catch (error) {
          results.tests.getEnvironments = {
            success: false,
            projectId,
            error: error instanceof Error ? error.message : String(error),
            errorDetails: error
          }
        }
      }
    } catch (error) {
      results.tests.getProjects = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorDetails: error
      }
    }

    // Test 3: Create a test project
    const testProjectName = `test-project-${Date.now()}`
    try {
      const newProject = await railwayClient.createProject(
        testProjectName,
        'Test project for debugging'
      )
      results.tests.createProject = {
        success: true,
        project: {
          id: newProject.id,
          name: newProject.name,
          teamId: newProject.teamId
        }
      }
      
      // Test 4: Get environments for the new project
      try {
        const environments = await railwayClient.getEnvironments(newProject.id)
        results.tests.newProjectEnvironments = {
          success: true,
          projectId: newProject.id,
          count: environments.length,
          environments: environments.map(e => ({
            id: e.id,
            name: e.name,
            isEphemeral: e.isEphemeral
          }))
        }
      } catch (error) {
        results.tests.newProjectEnvironments = {
          success: false,
          projectId: newProject.id,
          error: error instanceof Error ? error.message : String(error),
          errorDetails: error
        }
      }
    } catch (error) {
      results.tests.createProject = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorDetails: error
      }
    }

    // Test 5: Test the GraphQL query directly
    try {
      const testQuery = `
        query GetEnvironments($projectId: String!) {
          project(id: $projectId) {
            environments {
              edges {
                node {
                  id
                  name
                  isEphemeral
                }
              }
            }
          }
        }
      `
      
      const response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RAILWAY_API_KEY}`,
        },
        body: JSON.stringify({
          query: testQuery,
          variables: { projectId: results.tests.createProject?.project?.id || 'test' }
        })
      })
      
      const data = await response.json()
      results.tests.directGraphQL = {
        success: response.ok,
        status: response.status,
        data,
        query: testQuery
      }
    } catch (error) {
      results.tests.directGraphQL = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }

    console.log('\n6. Testing service creation from GitHub repo...')
    results.tests.createServiceFromGitHub = await (async () => {
      try {
        if (!results.tests.newProjectEnvironments.environments?.[0]) {
          throw new Error('No environment available for GitHub service creation')
        }

        const service = await railwayClient.createServiceFromGitHub(
          results.tests.newProjectEnvironments.projectId!,
          results.tests.newProjectEnvironments.environments[0].id,
          {
            serviceName: 'test-github-service',
            githubRepo: 'railway-examples/expressjs',  // Public Railway example repo
            branch: 'main',
            environmentVariables: {
              PORT: '3000',
              NODE_ENV: 'production'
            }
          }
        )

        return {
          success: true,
          service: {
            id: service.id,
            name: service.name,
            projectId: service.projectId
          }
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: error instanceof RailwayApiError ? {
            statusCode: error.statusCode,
            response: error.response,
            name: error.name
          } : undefined
        }
      }
    })()

    console.log('\n7. Testing service domain generation...')
    results.tests.generateServiceDomain = await (async () => {
      try {
        if (!results.tests.createServiceFromGitHub.success || !results.tests.createServiceFromGitHub.service) {
          throw new Error('No service available for domain generation')
        }
        
        if (!results.tests.newProjectEnvironments.environments?.[0]) {
          throw new Error('No environment available for domain generation')
        }

        const domain = await railwayClient.generateServiceDomain(
          results.tests.newProjectEnvironments.environments[0].id,
          results.tests.createServiceFromGitHub.service.id
        )

        return {
          success: true,
          domain: {
            id: domain.id,
            url: domain.domain
          }
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: error instanceof RailwayApiError ? {
            statusCode: error.statusCode,
            response: error.response,
            name: error.name
          } : undefined
        }
      }
    })()

  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error)
  }

  return NextResponse.json(results, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  })
} 
