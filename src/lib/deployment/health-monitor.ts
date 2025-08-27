import 'server-only'

import { createDeploymentService } from './deployment-service'
import { createAdminClient } from '../supabase/server'
import logger from '../logger/index'
import { DeploymentStatus, HealthStatus } from '../../../types/database'
import { MCPJamClient, MCPJamServerConfig, ConnectionStatus } from '@mcpgtm/mcp-core'

interface HealthMonitorConfig {
  interval: number // milliseconds between health checks
  maxFailures: number // consecutive failures before marking unhealthy
  timeout: number // timeout for each health check request
  enabled: boolean
}

interface MonitoredDeployment {
  id: string
  url: string
  lastCheck: Date
  consecutiveFailures: number
  isMonitoring: boolean
}

export class HealthMonitor {
  private deploymentService: ReturnType<typeof createDeploymentService>
  private adminClient: any
  private logger = logger.child({ component: 'HealthMonitor' })
  private monitoredDeployments = new Map<string, MonitoredDeployment>()
  private intervalTimers = new Map<string, NodeJS.Timeout>()
  
  private config: HealthMonitorConfig = {
    interval: 5 * 60 * 1000, // 5 minutes
    maxFailures: 3, // 3 consecutive failures (15 minutes) - more reasonable for MCP
    timeout: 20000, // 20 seconds - longer timeout for MCP connection
    enabled: true
  }

  constructor(config?: Partial<HealthMonitorConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
    
    // Initialize admin client in constructor to ensure env vars are loaded
    try {
      this.adminClient = createAdminClient()
      this.logger.info('Admin client created successfully')
    } catch (error) {
      this.logger.error('Failed to create admin client', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
    
    // Initialize deployment service with admin client for proper permissions
    this.deploymentService = createDeploymentService(this.adminClient)
    
    this.logger.info('MCP Health monitor initialized', {
      interval: this.config.interval,
      maxFailures: this.config.maxFailures,
      enabled: this.config.enabled,
      usingAdminClient: true
    })
  }

  /**
   * Start monitoring a deployment's health
   */
  async startMonitoring(deploymentId: string): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug('Health monitoring disabled, skipping', { deploymentId })
      return
    }

    const deployment = await this.deploymentService.getDeployment(deploymentId)
    if (!deployment) {
      this.logger.warn('Cannot monitor deployment - not found', { deploymentId })
      return
    }

    if (deployment.status !== 'running') {
      this.logger.debug('Cannot monitor deployment - not running', { 
        deploymentId, 
        status: deployment.status 
      })
      return
    }

    const serviceUrl = deployment.service_url
    if (!serviceUrl) {
      this.logger.warn('Cannot monitor deployment - no service URL', { deploymentId })
      return
    }

    // Stop existing monitoring if any
    this.stopMonitoring(deploymentId)

    const monitoredDeployment: MonitoredDeployment = {
      id: deploymentId,
      url: serviceUrl,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      isMonitoring: true
    }

    this.monitoredDeployments.set(deploymentId, monitoredDeployment)

    // Start the monitoring interval
    const timer = setInterval(async () => {
      await this.performMCPHealthCheck(deploymentId)
    }, this.config.interval)

    this.intervalTimers.set(deploymentId, timer)

    this.logger.info('Started MCP health monitoring', {
      deploymentId,
      url: serviceUrl,
      interval: this.config.interval
    })

    // Perform initial health check
    await this.performMCPHealthCheck(deploymentId)
  }

  /**
   * Stop monitoring a deployment
   */
  stopMonitoring(deploymentId: string): void {
    const timer = this.intervalTimers.get(deploymentId)
    if (timer) {
      clearInterval(timer)
      this.intervalTimers.delete(deploymentId)
    }

    const monitored = this.monitoredDeployments.get(deploymentId)
    if (monitored) {
      monitored.isMonitoring = false
      this.monitoredDeployments.delete(deploymentId)
      
      this.logger.info('Stopped MCP health monitoring', { deploymentId })
    }
  }

  /**
   * Check if a deployment is being monitored
   */
  isMonitoring(deploymentId: string): boolean {
    return this.monitoredDeployments.has(deploymentId)
  }

  /**
   * Get monitoring status for all deployments
   */
  getMonitoringStatus(): Array<{ deploymentId: string; lastCheck: Date; consecutiveFailures: number }> {
    return Array.from(this.monitoredDeployments.values()).map(m => ({
      deploymentId: m.id,
      lastCheck: m.lastCheck,
      consecutiveFailures: m.consecutiveFailures
    }))
  }

  /**
   * Perform MCP protocol health check for a specific deployment
   */
  async performMCPHealthCheck(deploymentId: string): Promise<void> {
    // Get monitored deployment info (might be null for manual health checks)
    const monitored = this.monitoredDeployments.get(deploymentId)
    
    // For manual health checks (refresh button), we proceed even if not actively monitored
    const deployment = await this.deploymentService.getDeployment(deploymentId)
    if (!deployment?.service_url) {
      this.logger.warn('Cannot perform health check - no service URL', { deploymentId })
      return
    }

    this.logger.info('Performing MCP health check', {
      deploymentId,
      deploymentName: deployment.deployment_name,
      isMonitored: !!monitored,
      url: deployment.service_url
    })

    const startTime = Date.now()
    let status: HealthStatus = 'unknown'
    let statusCode: number | null = null
    let errorMessage: string | null = null
    let toolsDiscovered = 0
    let successfulTransport: string | null = null
    let serverCapabilities: any = null

    // Try both SSE and streamable HTTP transports
    const transports: Array<'sse' | 'streamable-http'> = ['sse', 'streamable-http']
    
    // Try different endpoint patterns - some servers use /mcp, some use /sse, some use root
    const endpointPatterns = ['', '/mcp', '/sse']
    
    for (const transportType of transports) {
      for (const pattern of endpointPatterns) {
        try {
          // Create URL with endpoint pattern
          const testUrl = new URL(deployment.service_url)
          if (pattern) {
            testUrl.pathname = testUrl.pathname.endsWith('/') 
              ? testUrl.pathname.slice(0, -1) + pattern 
              : testUrl.pathname + pattern
          }
          
          this.logger.info('Attempting MCP health check', {
            deploymentId,
            url: testUrl.toString(),
            transport: transportType,
            endpoint: pattern || 'root',
            timeout: this.config.timeout
          })

          // Create MCP server configuration
          const serverConfig: MCPJamServerConfig = {
            transportType,
            url: testUrl,
            timeout: this.config.timeout,
            enableServerLogs: false
          }

        // Create MCP client
        const mcpClient = new MCPJamClient(
          serverConfig,
          {
            mcpServerRequestTimeout: this.config.timeout,
            mcpRequestTimeoutResetOnProgress: true,
            mcpRequestMaxTotalTimeout: this.config.timeout * 2
          }
        )

        // Set up timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('MCP connection timeout')), this.config.timeout)
        })

        // Try to connect with timeout
        await Promise.race([
          mcpClient.connectToServer(),
          timeoutPromise
        ])

        this.logger.info('MCP connection established', {
          deploymentId,
          transport: transportType,
          responseTime: Date.now() - startTime
        })

        // Try to get tools to verify MCP functionality
        try {
          const tools = await Promise.race([
            mcpClient.tools(),
            timeoutPromise
          ])
          toolsDiscovered = tools?.length || 0
          
          this.logger.info('MCP tools retrieved', {
            deploymentId,
            toolCount: toolsDiscovered,
            transport: transportType
          })
        } catch (toolError) {
          this.logger.warn('Could not retrieve tools, but connection works', {
            deploymentId,
            transport: transportType,
            error: toolError instanceof Error ? toolError.message : String(toolError)
          })
          // Connection works even if tools fail - that's still healthy
        }

        // Clean up connection
        try {
          await mcpClient.disconnect()
        } catch (disconnectError) {
          // Ignore disconnect errors
        }

                  // If we got here, the MCP server is healthy
          status = 'healthy'
          statusCode = 200 // Simulate successful status code
          successfulTransport = transportType
          serverCapabilities = mcpClient.serverCapabilities
          if (monitored) {
            monitored.consecutiveFailures = 0
          }
          
          this.logger.info('MCP health check PASSED - Server is healthy', {
            deploymentId,
            transport: transportType,
            endpoint: pattern || 'root',
            responseTime: Date.now() - startTime,
            toolsDiscovered,
            capabilities: serverCapabilities
          })
          break // Success, exit endpoint pattern loop

        } catch (error) {
          this.logger.warn('MCP health check failed for endpoint', {
            deploymentId,
            endpoint: pattern || 'root',
          transport: transportType,
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error
        })
        
          // Continue to next endpoint pattern
          errorMessage = `MCP ${transportType} at ${pattern || 'root'} failed: ${error instanceof Error ? error.message : String(error)}`
        }
      }
      
      // If we found a working endpoint, break out of transport loop too
      if (status === 'healthy') {
        break
      }
    }

    // If no transport/endpoint combination worked, mark as unhealthy
    if (status === 'unknown') {
      status = 'unhealthy'
      statusCode = 503 // Service Unavailable
      errorMessage = errorMessage || 'All MCP transports failed to connect'
      const consecutiveFailures = monitored ? (monitored.consecutiveFailures + 1) : 1
      if (monitored) {
        monitored.consecutiveFailures = consecutiveFailures
      }
      
      this.logger.warn('MCP health check FAILED - All transports failed', {
        deploymentId,
        error: errorMessage,
        consecutiveFailures,
        responseTime: Date.now() - startTime
      })
    }

    // Update last check time (only if actively monitored)
    if (monitored) {
      monitored.lastCheck = new Date()
    }

    // Record health check in database
    try {
      this.logger.info('Recording health check result', {
        deploymentId,
        status,
        responseTime: Date.now() - startTime,
        toolsDiscovered,
        transport: successfulTransport
      })

      await this.deploymentService.recordHealthCheck(deploymentId, {
        status,
        response_time_ms: Date.now() - startTime,
        status_code: statusCode,
        error_message: errorMessage,
        tools_discovered: toolsDiscovered,
        transport_type: successfulTransport,
        mcp_server_capabilities: serverCapabilities
      })

      this.logger.info('Health check recorded successfully', {
        deploymentId,
        newHealthStatus: status
      })

      // If health check passed and deployment was previously failed, restore it to running
      if (status === 'healthy') {
        const deployment = await this.deploymentService.getDeployment(deploymentId)
        if (deployment?.status === 'failed') {
          this.logger.info('Deployment marked as failed but health check passed, restoring to running status', {
            deploymentId,
            currentStatus: deployment.status,
            newHealthStatus: status
          })
          
          // Update deployment status to running and clear error
          await this.deploymentService.updateDeployment(deploymentId, {
            status: 'running',
            health_status: status,
            error_message: undefined,
            last_health_check: new Date().toISOString()
          })
          
          this.logger.info('Successfully restored deployment to running status', {
            deploymentId
          })
        } else {
          // Just update health status if not recovering from failed
          await this.deploymentService.updateDeployment(deploymentId, {
            health_status: status,
            last_health_check: new Date().toISOString()
          })
        }
      } else {
        // For non-healthy status, just update health status
        await this.deploymentService.updateDeployment(deploymentId, {
          health_status: status,
          last_health_check: new Date().toISOString()
        })
      }

    } catch (error) {
      this.logger.error('Failed to record MCP health check', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      })
      // Re-throw to maintain existing behavior
      throw error
    }

    // Handle consecutive failures (only for actively monitored deployments)
    if (monitored && monitored.consecutiveFailures >= this.config.maxFailures) {
      await this.handleUnhealthyDeployment(deploymentId, monitored)
    }
  }

  /**
   * Handle a deployment that has failed multiple health checks
   */
  private async handleUnhealthyDeployment(deploymentId: string, monitored: MonitoredDeployment): Promise<void> {
    this.logger.error('MCP deployment marked as unhealthy', {
      deploymentId,
      consecutiveFailures: monitored.consecutiveFailures,
      maxFailures: this.config.maxFailures
    })

    try {
      // Update deployment status to failed
      await this.deploymentService.updateDeployment(deploymentId, {
        status: 'failed',
        error_message: `MCP health checks failed ${monitored.consecutiveFailures} times consecutively`,
        health_status: 'unhealthy'
      })

      // Log the failure
      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'error',
        message: `❌ MCP deployment marked as unhealthy after ${monitored.consecutiveFailures} consecutive health check failures`,
        metadata: {
          consecutiveFailures: monitored.consecutiveFailures,
          maxFailures: this.config.maxFailures,
          lastCheckUrl: monitored.url,
          healthCheckType: 'mcp_protocol'
        } as any
      })

      // Stop monitoring this deployment
      this.stopMonitoring(deploymentId)

    } catch (error) {
      this.logger.error('Failed to handle unhealthy MCP deployment', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Start monitoring all running deployments (for system startup)
   */
  async startMonitoringAllRunningDeployments(): Promise<void> {
    try {
      this.logger.info('MCP health monitor ready to monitor deployments')
    } catch (error) {
      this.logger.error('Failed to start monitoring all deployments', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Shutdown all monitoring
   */
  shutdown(): void {
    this.logger.info('Shutting down MCP health monitor')
    
    // Clear all timers
    for (const timer of Array.from(this.intervalTimers.values())) {
      clearInterval(timer)
    }
    
    this.intervalTimers.clear()
    this.monitoredDeployments.clear()
  }
}

// Singleton health monitor instance
let healthMonitorInstance: HealthMonitor | null = null

export const createHealthMonitor = (config?: Partial<HealthMonitorConfig>): HealthMonitor => {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new HealthMonitor(config)
  }
  return healthMonitorInstance
}

export const getHealthMonitor = (): HealthMonitor | null => {
  return healthMonitorInstance
} 
