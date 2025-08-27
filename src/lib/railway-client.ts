import 'server-only'

import { 
  IRailwayClient, 
  RailwayProject, 
  RailwayService, 
  RailwayDeployment, 
  RailwayEnvironment, 
  DeployConfig,
  RailwayApiError 
} from '../contracts/service-contracts'

interface RailwayGraphQLResponse<T = any> {
  data?: T
  errors?: Array<{
    message: string
    extensions?: any
  }>
}

export class RailwayClient implements IRailwayClient {
  private apiKey: string
  private baseUrl = 'https://backboard.railway.app/graphql/v2'

  constructor(apiKey: string) {
    if (!apiKey) {
      console.error('Railway API key is required')
      throw new Error('Railway API key is required')
    }
    this.apiKey = apiKey
    console.debug('Railway client initialized', { 
      hasApiKey: !!apiKey,
      baseUrl: this.baseUrl 
    })
  }

  private async makeRequest<T>(query: string, variables?: any): Promise<T> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()
    
    console.debug('Railway API request initiated', {
      requestId,
      queryLength: query.length,
      hasVariables: !!variables,
      endpoint: this.baseUrl
    })

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      })

      const duration = Date.now() - startTime
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Railway API HTTP error', {
          requestId,
          status: response.status,
          statusText: response.statusText,
          duration,
          responseText: errorText
        })
        
        throw new RailwayApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorText
        )
      }

      const result: RailwayGraphQLResponse<T> = await response.json()

      if (result.errors && result.errors.length > 0) {
        console.error('Railway API GraphQL errors', {
          requestId,
          errors: result.errors,
          duration
        })
        
        throw new RailwayApiError(
          result.errors[0].message,
          400,
          result.errors
        )
      }

      if (!result.data) {
        console.error('Railway API returned no data', {
          requestId,
          duration
        })
        
        throw new RailwayApiError('No data returned from Railway API', 500)
      }

      console.info('Railway API request completed successfully', {
        requestId,
        duration,
        responseSize: JSON.stringify(result.data).length
      })

      return result.data
    } catch (error) {
      const duration = Date.now() - startTime
      
      if (error instanceof RailwayApiError) {
        console.error('Railway API error', {
          requestId,
          message: error.message,
          statusCode: error.statusCode,
          duration
        })
        throw error
      }
      
      console.error('Railway API request failed', {
        requestId,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      })
      
      throw new RailwayApiError(
        `Railway API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        error
      )
    }
  }

  async getProjects(): Promise<RailwayProject[]> {
    console.info('Fetching Railway projects')
    
    const query = `
      query GetProjects {
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              updatedAt
              teamId
              isPublic
            }
          }
        }
      }
    `

    const startTime = Date.now()
    const response = await this.makeRequest<{ 
      projects: {
        edges: Array<{
          node: RailwayProject
        }>
      }
    }>(query)
    
    console.info('Railway projects fetched successfully', {
      count: response.projects.edges.length,
      duration: Date.now() - startTime
    })
    
    // Extract nodes from edges
    return response.projects.edges.map(edge => edge.node)
  }

  async getProject(projectId: string): Promise<RailwayProject | null> {
    console.info('Fetching Railway project', { projectId })
    
    const query = `
      query GetProject($projectId: String!) {
        project(id: $projectId) {
          id
          name
          description
          createdAt
          updatedAt
          teamId
          isPublic
        }
      }
    `

    const startTime = Date.now()
    
    try {
      const response = await this.makeRequest<{ project: RailwayProject }>(query, { projectId })
      
      console.info('Railway project fetched successfully', {
        projectId,
        projectName: response.project.name,
        duration: Date.now() - startTime
      })
      
      return response.project
    } catch (error) {
      if (error instanceof RailwayApiError && error.statusCode === 404) {
        console.warn('Railway project not found', { 
          projectId,
          duration: Date.now() - startTime 
        })
        return null
      }
      
      console.error('Failed to fetch Railway project', { 
        projectId,
        duration: Date.now() - startTime 
      })
      throw error
    }
  }

  async createProject(name: string, description?: string): Promise<RailwayProject> {
    console.info('Creating Railway project', { 
      name, 
      hasDescription: !!description 
    })
    
    const query = `
      mutation CreateProject($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          id
          name
          description
          createdAt
          updatedAt
          teamId
          isPublic
        }
      }
    `

    const startTime = Date.now()
    const response = await this.makeRequest<{ projectCreate: RailwayProject }>(query, {
      input: { name, description }
    })
    
    console.info('Railway project created successfully', {
      projectId: response.projectCreate.id,
      projectName: response.projectCreate.name,
      duration: Date.now() - startTime
    })
    
    return response.projectCreate
  }

  async getServices(projectId: string): Promise<RailwayService[]> {
    console.info('Fetching Railway services', { projectId })
    
    const query = `
      query GetServices($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                templateServiceId
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    `

    const startTime = Date.now()
    const response = await this.makeRequest<{ 
      project: { 
        services: {
          edges: Array<{
            node: RailwayService
          }>
        } 
      } 
    }>(query, { projectId })
    
    console.info('Railway services fetched successfully', {
      projectId,
      count: response.project.services.edges.length,
      duration: Date.now() - startTime
    })
    
    // Extract nodes and add projectId
    return response.project.services.edges.map(edge => ({
      ...edge.node,
      projectId
    }))
  }

  async getService(serviceId: string): Promise<RailwayService | null> {
    console.info('Fetching Railway service', { serviceId })
    
    const query = `
      query GetService($serviceId: String!) {
        service(id: $serviceId) {
          id
          name
          projectId
          templateServiceId
          createdAt
          updatedAt
        }
      }
    `

    const startTime = Date.now()
    
    try {
      const response = await this.makeRequest<{ service: RailwayService }>(query, { serviceId })
      
      console.info('Railway service fetched successfully', {
        serviceId,
        serviceName: response.service.name,
        projectId: response.service.projectId,
        duration: Date.now() - startTime
      })
      
      return response.service
    } catch (error) {
      if (error instanceof RailwayApiError && error.statusCode === 404) {
        console.warn('Railway service not found', { 
          serviceId,
          duration: Date.now() - startTime 
        })
        return null
      }
      
      console.error('Failed to fetch Railway service', { 
        serviceId,
        duration: Date.now() - startTime 
      })
      throw error
    }
  }

  async createService(projectId: string, config: DeployConfig): Promise<RailwayService> {
    const query = `
      mutation CreateService($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
          projectId
          templateServiceId
          createdAt
          updatedAt
        }
      }
    `

    const response = await this.makeRequest<{ serviceCreate: RailwayService }>(query, {
      input: {
        projectId,
        name: config.serviceName,
        source: {
          image: 'node:18-alpine', // Default for Emailbison MCP servers
        }
      }
    })
    return response.serviceCreate
  }

  async deployProject(projectId: string, config: DeployConfig): Promise<RailwayDeployment> {
    // First create or get the service
    const services = await this.getServices(projectId)
    let service = services.find(s => s.name === config.serviceName)
    
    if (!service) {
      service = await this.createService(projectId, config)
    }

    // Create deployment
    const query = `
      mutation CreateDeployment($input: DeploymentCreateInput!) {
        deploymentCreate(input: $input) {
          id
          serviceId
          environmentId
          status
          url
          createdAt
          updatedAt
        }
      }
    `

    const response = await this.makeRequest<{ deploymentCreate: RailwayDeployment }>(query, {
      input: {
        serviceId: service.id,
        environmentVariables: config.environmentVariables,
      }
    })
    return response.deploymentCreate
  }

  async getDeployment(deploymentId: string): Promise<RailwayDeployment | null> {
    console.info('Fetching Railway deployment', { deploymentId })

    const query = `
      query GetDeployment($id: String!) {
        deployment(id: $id) {
          id
          status
          createdAt
          updatedAt
          url: staticUrl
        }
      }
    `

    const startTime = Date.now()
    const response = await this.makeRequest<{ deployment: RailwayDeployment | null }>(
      query,
      { id: deploymentId }
    )

    console.info('Railway deployment fetched', {
      deploymentId,
      status: response.deployment?.status,
      duration: Date.now() - startTime
    })

    return response.deployment
  }

  async getDeploymentLogs(deploymentId: string): Promise<string> {
    const deployment = await this.getDeployment(deploymentId)
    if (!deployment) {
      throw new RailwayApiError('Deployment not found', 404)
    }
    
    return [deployment.buildLogs, deployment.deployLogs]
      .filter(Boolean)
      .join('\n---\n')
  }

  async cancelDeployment(deploymentId: string): Promise<boolean> {
    const query = `
      mutation CancelDeployment($deploymentId: String!) {
        deploymentCancel(id: $deploymentId)
      }
    `

    // --- Call Railway API; network or API errors are propagated by makeRequest ---
    const response = await this.makeRequest<{ deploymentCancel: boolean }>(query, {
      deploymentId,
    })

    return response.deploymentCancel
  }

  async getEnvironments(projectId: string): Promise<RailwayEnvironment[]> {
    const query = `
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

    const response = await this.makeRequest<{ 
      project: { 
        environments: {
          edges: Array<{
            node: RailwayEnvironment
          }>
        }
      } 
    }>(query, { projectId })
    
    // Extract the nodes from the edges
    return response.project.environments.edges.map(edge => ({
      ...edge.node,
      projectId // Add projectId since it's not in the node
    }))
  }

  async createEnvironment(projectId: string, name: string): Promise<RailwayEnvironment> {
    const query = `
      mutation CreateEnvironment($input: EnvironmentCreateInput!) {
        environmentCreate(input: $input) {
          id
          name
          projectId
          isEphemeral
        }
      }
    `

    const response = await this.makeRequest<{ environmentCreate: RailwayEnvironment }>(query, {
      input: { projectId, name }
    })
    return response.environmentCreate
  }

  async createServiceFromGitHub(
    projectId: string, 
    environmentId: string,
    config: DeployConfig & { githubRepo: string; branch?: string }
  ): Promise<RailwayService> {
    console.info('Creating service from GitHub repo', {
      projectId,
      environmentId,
      serviceName: config.serviceName,
      githubRepo: config.githubRepo,
      branch: config.branch || "main"
    })

    // First, create the service with GitHub source
    const createServiceQuery = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
          projectId
        }
      }
    `

    const startTime = Date.now()
    const response = await this.makeRequest<{ serviceCreate: RailwayService }>(createServiceQuery, {
      input: {
        projectId: projectId,  // projectId must come first
        name: config.serviceName,
        source: {
          repo: config.githubRepo  // Only repo in source, no type field
        },
        branch: config.branch || "main"  // branch at input level, not in source
      }
    })
    
    const service = response.serviceCreate
    console.info('Service created from GitHub repo successfully', {
      serviceId: service.id,
      serviceName: service.name,
      duration: Date.now() - startTime
    })
    
    // Now set environment variables using the variableCollectionUpsert mutation
    if (config.environmentVariables && Object.keys(config.environmentVariables).length > 0) {
      console.info('Setting environment variables for service', {
        serviceId: service.id,
        variableCount: Object.keys(config.environmentVariables).length
      })

      const setVariablesQuery = `
        mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
          variableCollectionUpsert(input: $input)
        }
      `

      await this.makeRequest<{ variableCollectionUpsert: boolean }>(setVariablesQuery, {
        input: {
          projectId: projectId,
          environmentId: environmentId,
          serviceId: service.id,
          variables: config.environmentVariables
        }
      })

      console.info('Environment variables set successfully', {
        serviceId: service.id
      })
    }
    
    return service
  }

  async generateServiceDomain(environmentId: string, serviceId: string): Promise<{ id: string; domain: string }> {
    const query = `
      mutation ServiceDomainCreate($environmentId: String!, $serviceId: String!) {
        serviceDomainCreate(
          input: { environmentId: $environmentId, serviceId: $serviceId }
        ) {
          id
          domain
        }
      }
    `

    const response = await this.makeRequest<{ serviceDomainCreate: { id: string; domain: string } }>(query, {
      environmentId,
      serviceId
    })
    
    return response.serviceDomainCreate
  }

  async triggerDeployment(
    serviceId: string,
    environmentId: string,
    githubRepo: string,
    branch: string = "main"
  ): Promise<RailwayDeployment> {
    console.info('Triggering deployment for service', {
      serviceId,
      environmentId,
      githubRepo,
      branch
    })

    // Railway uses serviceInstanceDeploy to trigger deployments
    const query = `
      mutation serviceInstanceDeploy($environmentId: String!, $serviceId: String!) {
        serviceInstanceDeploy(environmentId: $environmentId, serviceId: $serviceId) {
          id
          status
          createdAt
        }
      }
    `

    const startTime = Date.now()
    const response = await this.makeRequest<{ 
      serviceInstanceDeploy: RailwayDeployment 
    }>(query, {
      environmentId,
      serviceId
    })

    const duration = Date.now() - startTime
    console.info('Railway deployment triggered', {
      deploymentId: response.serviceInstanceDeploy.id,
      status: response.serviceInstanceDeploy.status,
      duration
    })

    return response.serviceInstanceDeploy
  }

  async waitForDeployment(
    deploymentId: string,
    timeoutMs: number = 300000, // 5 minutes default
    pollIntervalMs: number = 5000 // 5 seconds
  ): Promise<RailwayDeployment> {
    console.info('Waiting for deployment to complete', {
      deploymentId,
      timeoutMs,
      pollIntervalMs
    })

    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
      const deployment = await this.getDeployment(deploymentId)
      
      if (!deployment) {
        throw new RailwayApiError('Deployment not found', 404)
      }

      console.debug('Deployment status check', {
        deploymentId,
        status: deployment.status,
        elapsed: Date.now() - startTime
      })

      // Check if deployment is complete (success or failure)
      if (['SUCCESS', 'FAILED', 'CRASHED', 'REMOVED'].includes(deployment.status)) {
        console.info('Deployment completed', {
          deploymentId,
          finalStatus: deployment.status,
          duration: Date.now() - startTime
        })
        return deployment
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }

    throw new RailwayApiError(
      `Deployment timeout after ${timeoutMs}ms`,
      408,
      { deploymentId, timeoutMs }
    )
  }

  async getServiceDeployments(
    serviceId: string, 
    environmentId: string, 
    limit: number = 1
  ): Promise<RailwayDeployment[]> {
    console.info('Fetching service deployments', { 
      serviceId, 
      environmentId, 
      limit 
    })

    const query = `
      query GetServiceDeployments($input: DeploymentListInput!, $first: Int!) {
        deployments(input: $input, first: $first) {
          edges {
            node {
              id
              status
              createdAt
              updatedAt
              staticUrl
            }
          }
        }
      }
    `

    const startTime = Date.now()
    const response = await this.makeRequest<{ 
      deployments: { 
        edges: Array<{ 
          node: {
            id: string
            status: string
            createdAt: string
            updatedAt: string
            staticUrl?: string
          }
        }> 
      } 
    }>(query, {
      input: {
        serviceId,
        environmentId
      },
      first: limit
    })

    const deployments = response.deployments.edges.map(edge => ({
      id: edge.node.id,
      serviceId,
      environmentId,
      status: edge.node.status,
      url: edge.node.staticUrl,
      createdAt: edge.node.createdAt,
      updatedAt: edge.node.updatedAt
    }))

    console.info('Service deployments fetched', {
      serviceId,
      count: deployments.length,
      duration: Date.now() - startTime
    })

    return deployments
  }
}

// Factory function to create Railway client with API key from environment
export const createRailwayClient = (): RailwayClient => {
  const apiKey = process.env.RAILWAY_API_KEY
  if (!apiKey) {
    throw new Error('RAILWAY_API_KEY environment variable is required')
  }
  return new RailwayClient(apiKey)
}
