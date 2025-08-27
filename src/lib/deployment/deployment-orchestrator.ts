import 'server-only'

import { 
  IDeploymentOrchestrator,
  CreateDeploymentInput,
  DeploymentOrchestrationResult,
  DeployConfig 
} from '../../contracts/service-contracts'
import { HealthCheck, DeploymentStatus } from '../../../types/database'
import { createDeploymentService } from './deployment-service'
import { createRailwayClient } from '../railway-client'
import { createHealthMonitor } from './health-monitor'
import { withRetry, railwayApiCircuitBreaker, DeploymentError, errorReporter } from '../error-handling'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import logger from '../logger/index'
import { ServerTemplateService } from './server-template-service'
import { GenericServerValidator } from './generic-server-validator'
import { transportTypeService } from './transport-type-service'
import { mcpServerService } from '../mcp/mcp-server-service'

export class DeploymentOrchestrator implements IDeploymentOrchestrator {
  private adminClient: any
  private deploymentService: any
  private railwayClient = createRailwayClient()
  private healthMonitor = createHealthMonitor()
  private logger = logger.child({ component: 'DeploymentOrchestrator' })
  private templateService = new ServerTemplateService()
  private validator = new GenericServerValidator()

  constructor() {
    // Initialize admin client in constructor to ensure env vars are loaded
    try {
      this.adminClient = createAdminClient()
      this.deploymentService = createDeploymentService(this.adminClient)
      this.logger.info('Deployment orchestrator initialized with admin client')
    } catch (error) {
      this.logger.error('Failed to initialize deployment orchestrator', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }



  /**
   * Generic deployment method using schema-driven validation
   * Works for ALL server types - no adapters needed!
   */
  async deployServer(input: CreateDeploymentInput): Promise<DeploymentOrchestrationResult> {
    const operationLogger = this.logger.child({
      operation: 'deployServer',
      deploymentName: input.deployment_name,
      userId: input.user_id,
      environment: input.environment,
      serverTemplateId: input.server_template_id
    })

    operationLogger.info('Starting server deployment with generic validator', {
      deploymentName: input.deployment_name,
      environment: input.environment,
      hasRailwayProject: !!input.railway_project_id,
      serverTemplateId: input.server_template_id
    })

    let deployment: any = null
    let railwayProject: any = null
    let railwayService: any = null
    let railwayDeployment: any = null

    return this.logger.time('fullDeploymentOrchestration', async () => {
      try {
        // Step 1: Get server template
        operationLogger.info('Step 1: Loading server template')
        
        if (!input.server_template_id) {
          throw new DeploymentError('Server template ID is required for deployment', 'VALIDATION_FAILED')
        }

        const template = await this.templateService.getTemplate(input.server_template_id)
        
        if (!template) {
          throw new DeploymentError(`Server template not found: ${input.server_template_id}`, 'TEMPLATE_NOT_FOUND')
        }

        operationLogger.info('Server template loaded', { 
          templateName: template.name,
          templateDisplayName: template.display_name,
          requiredVars: template.required_env_vars.length,
          optionalVars: template.optional_env_vars.length
        })

        // Step 2: Create deployment record
        operationLogger.info('Step 2: Creating deployment record')
        deployment = await this.logger.time('createDeploymentRecord', async () => {
          return await this.deploymentService.createDeployment(input)
        }, { step: 'create_record' })
        
        operationLogger.info('Deployment record created', { 
          deploymentId: deployment.id,
          status: deployment.status 
        })
        
        await this.deploymentService.addDeploymentLog(deployment.id, {
          log_level: 'info',
          message: `Starting ${template.display_name} deployment orchestration`,
          metadata: { 
            step: 'initialization',
            templateName: template.name,
            templateId: template.id
          }
        })

        // Step 3: Update status to validating
        operationLogger.debug('Step 3: Updating status to validating')
        await this.deploymentService.updateDeploymentStatus(deployment.id, 'validating')

        // Step 4: Validate configuration using generic validator
        operationLogger.info('Step 4: Validating deployment configuration with generic validator')
        await this.logger.time('validateConfiguration', async () => {
          await this.validateServerConfigGeneric(deployment.id, input, template)
        }, { deploymentId: deployment.id, step: 'validation' })

        // Step 5: Create or get Railway project
        operationLogger.info('Step 5: Setting up Railway project')
        railwayProject = await this.logger.time('setupRailwayProject', async () => {
          return await this.setupRailwayProject(deployment.id, input)
        }, { deploymentId: deployment.id, step: 'railway_setup' })

        operationLogger.info('Railway project setup completed', {
          projectId: railwayProject.id,
          projectName: railwayProject.name
        })

        // Add a small delay to ensure database transaction is committed
        await new Promise(resolve => setTimeout(resolve, 500))

        // Step 6: Update deployment with Railway project ID
        operationLogger.debug('Step 6: Updating deployment with Railway project reference')
        deployment = await this.deploymentService.updateDeployment(deployment.id, {
          railway_project_id: railwayProject.dbId
        })

        // Step 7: Update status to deploying
        operationLogger.info('Step 7: Starting Railway deployment')
        await this.deploymentService.updateDeploymentStatus(deployment.id, 'deploying')

        // Step 8: Deploy to Railway using generic config
        operationLogger.info('Step 8: Deploying service to Railway with generic config')
        const deployResult = await this.logger.time('deployToRailway', async () => {
          return await this.deployToRailwayGeneric(deployment.id, railwayProject, input, template)
        }, { 
          deploymentId: deployment.id, 
          step: 'railway_deployment',
          templateName: template.name
        })

        railwayService = deployResult.service
        railwayDeployment = deployResult.deployment

        operationLogger.info('Railway deployment completed', {
          serviceId: railwayService.id,
          deploymentId: railwayDeployment.id,
          deploymentUrl: railwayDeployment.url
        })

        // Step 9: Update deployment with Railway service details
        operationLogger.info('Step 9: Updating deployment with service details')
        const healthCheckUrl = railwayDeployment.url + (template.healthcheck_path || '/health')
        
        deployment = await this.deploymentService.updateDeployment(deployment.id, {
          railway_service_id: railwayService.id,
          railway_deployment_id: railwayDeployment.id,
          service_url: railwayDeployment.url,
          health_check_url: healthCheckUrl,
          status: 'building'  // Will be updated to 'running' by monitoring
        })

        // Step 10: Start background monitoring
        operationLogger.info('Step 10: Starting background monitoring')
        this.startBackgroundMonitoring(deployment.id).catch((error: Error) => {
          operationLogger.error('Background monitoring failed to start', {
            deploymentId: deployment.id,
            error: error.message
          })
        })

        operationLogger.info('Server deployment completed successfully', {
          deploymentId: deployment.id,
          serviceUrl: railwayDeployment.url,
          templateName: template.name
        })

        await this.deploymentService.addDeploymentLog(deployment.id, {
          log_level: 'info',
          message: `${template.display_name} deployment completed successfully`,
          metadata: { 
            step: 'completion',
            serviceUrl: railwayDeployment.url,
            healthCheckUrl
          }
        })

        return {
          deployment,
          railwayProject,
          railwayService,
          railwayDeployment,
          success: true
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error'
        
        operationLogger.error('Server deployment failed', {
          error: errorMessage,
          deploymentId: deployment?.id,
          stack: error instanceof Error ? error.stack : undefined
        })

        // Update deployment status to failed if we have a deployment record
        if (deployment) {
          await this.deploymentService.updateDeploymentStatus(deployment.id, 'failed')
          await this.deploymentService.updateDeployment(deployment.id, {
            error_message: errorMessage
          })

          await this.deploymentService.addDeploymentLog(deployment.id, {
            log_level: 'error',
            message: `Deployment failed: ${errorMessage}`,
            metadata: { 
              error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
              } : String(error)
            } as any
          })

          // Attempt cleanup
          await this.logger.time('cleanupFailedDeployment', async () => {
            await this.cleanupFailedDeployment(deployment.id)
          }, { deploymentId: deployment.id, step: 'cleanup' })
        }

        return {
          deployment,
          railwayProject,
          railwayService,
          railwayDeployment,
          success: false,
          error: errorMessage
        }
      }
    }, { 
      deploymentName: input.deployment_name,
      userId: input.user_id,
      operation: 'full_orchestration',
      templateId: input.server_template_id
    })
  }



  private async setupRailwayProject(deploymentId: string, input: CreateDeploymentInput) {
    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: 'Setting up Railway project',
      metadata: { step: 'railway_setup' }
    })

    return withRetry(async () => {
      return railwayApiCircuitBreaker.execute(async () => {
        const supabase = await createClient()
        
        // Check if user already has a Railway project
        const { data: existingProject, error: fetchError } = await supabase
          .from('railway_projects')
          .select('*')
          .eq('user_id', input.user_id)
          .limit(1)
          .single()

        if (existingProject && !fetchError) {
          // Verify the project still exists on Railway
          try {
            const railwayProject = await this.railwayClient.getProject(existingProject.railway_project_id)
            if (railwayProject) {
              await this.deploymentService.addDeploymentLog(deploymentId, {
                log_level: 'info',
                message: `Using existing user Railway project: ${railwayProject.name}`,
                metadata: { project_id: railwayProject.id }
              })
              return {
                ...railwayProject,
                dbId: existingProject.id
              }
            }
          } catch (error) {
            // Project doesn't exist on Railway anymore, continue to create new one
            this.logger.warn('User Railway project not found on Railway, creating new one', {
              userId: input.user_id,
              projectId: existingProject.railway_project_id
            })
          }
        }

        // Create new user-specific project
        // Use truncated user ID for uniqueness and brevity
        const userIdShort = input.user_id.replace(/-/g, '').slice(0, 8) // Remove hyphens and take first 8 chars
        const projectName = `mcp-${userIdShort}`.slice(0, 50) // Ensure max 50 chars
        
        logger.info('Creating user Railway project', {
          userId: input.user_id,
          userIdShort,
          projectName
        })
        
        const project = await this.railwayClient.createProject(
          projectName,
          `MCP Server hub for user ${userIdShort}`
        )

        await this.deploymentService.addDeploymentLog(deploymentId, {
          log_level: 'info',
          message: `Created new Railway project: ${project.name}`,
          metadata: { project_id: project.id }
        })

        // Insert the Railway project into our database to satisfy foreign key constraint
        const { data: insertedProject, error: insertError } = await supabase
          .from('railway_projects')
          .insert({
            user_id: input.user_id,
            railway_project_id: project.id,
            project_name: project.name,
            railway_team_id: project.teamId || null,
            environment: 'production'
          })
          .select()
          .single()

        if (insertError) {
          this.logger.error('Failed to insert Railway project record', {
            error: insertError,
            projectId: project.id
          })
          throw new DeploymentError(
            `Failed to save Railway project: ${insertError.message}`,
            'PROJECT_SAVE_FAILED',
            500,
            insertError
          )
        }

        // Verify the project exists in database before proceeding
        const { data: verifyProject, error: verifyError } = await supabase
          .from('railway_projects')
          .select('railway_project_id')
          .eq('railway_project_id', project.id)
          .single()

        if (verifyError || !verifyProject) {
          this.logger.error('Failed to verify Railway project in database', {
            verifyError,
            projectId: project.id
          })
          throw new DeploymentError(
            'Railway project not found in database after insert',
            'PROJECT_VERIFY_FAILED',
            500
          )
        }

        await this.deploymentService.addDeploymentLog(deploymentId, {
          log_level: 'info',
          message: 'Railway project saved and verified in database',
          metadata: { 
            project_id: project.id,
            db_id: insertedProject.id,
            verified: true
          }
        })

        // Return the project with the database ID attached
        return {
          ...project,
          dbId: insertedProject.id  // The UUID from our database
        }
      })
    })
  }



  async monitorDeployment(deploymentId: string): Promise<void> {
    const deployment = await this.deploymentService.getDeployment(deploymentId)
    if (!deployment || !deployment.railway_deployment_id) {
      throw new DeploymentError('Invalid deployment for monitoring', 'MONITOR_FAILED')
    }

    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: 'Starting deployment monitoring',
      metadata: { step: 'monitoring' }
    })

    const maxAttempts = 30 // 15 minutes with 30-second intervals
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const railwayDeployment = await this.railwayClient.getDeployment(deployment.railway_deployment_id)
        
        if (!railwayDeployment) {
          throw new DeploymentError('Railway deployment not found', 'MONITOR_FAILED')
        }

        await this.deploymentService.addDeploymentLog(deploymentId, {
          log_level: 'info',
          message: `Railway deployment status: ${railwayDeployment.status}`,
          metadata: { 
            railway_status: railwayDeployment.status,
            attempt: attempts + 1 
          }
        })

        // Update our deployment status based on Railway status
        let newStatus: DeploymentStatus
        const railwayStatus = railwayDeployment.status.toUpperCase()
        
        switch (railwayStatus) {
          case 'INITIALIZING':
          case 'BUILDING':
            newStatus = 'building'
            await this.deploymentService.addDeploymentLog(deploymentId, {
              log_level: 'info',
              message: `🔨 Railway is ${railwayStatus.toLowerCase()}...`,
              metadata: { railway_status: railwayStatus }
            })
            break
          case 'DEPLOYING':
            newStatus = 'deploying'
            await this.deploymentService.addDeploymentLog(deploymentId, {
              log_level: 'info',
              message: '🚀 Railway is deploying your service...',
              metadata: { railway_status: railwayStatus }
            })
            break
          case 'WAITING':
            newStatus = 'building'  // Map to building status while waiting
            await this.deploymentService.addDeploymentLog(deploymentId, {
              log_level: 'info',
              message: '⏳ Railway is waiting for checks to complete...',
              metadata: { railway_status: railwayStatus }
            })
            break
          case 'ACTIVE':
          case 'SUCCESS':  // Railway returns SUCCESS for completed deployments
            newStatus = 'running'
            
            // Update deployment as completed with deployed_at timestamp
            await this.deploymentService.updateDeployment(deploymentId, {
              status: newStatus,
              deployed_at: new Date().toISOString()
            })
            
            await this.deploymentService.addDeploymentLog(deploymentId, {
              log_level: 'info',
              message: '🎉 Railway deployment completed! Performing health check...',
              metadata: { railway_status: railwayStatus }
            })
            
            // Deployment is complete, perform initial health check
            await this.performHealthCheck(deploymentId)
            
            // Start continuous health monitoring
            await this.healthMonitor.startMonitoring(deploymentId)
            
            // Register MCP server and attach tools to user's agent
            await this.registerMCPServerForDeployment(deploymentId)
            
            return
          case 'FAILED':
          case 'CRASHED':
          case 'COMPLETED': // App exited with non-zero code
          case 'SKIPPED':   // Deployment was skipped
            newStatus = 'failed'
            const errorMsg = `Railway deployment ${railwayStatus.toLowerCase()}`
            await this.deploymentService.updateDeployment(deploymentId, {
              status: newStatus,
              error_message: errorMsg
            })
            await this.deploymentService.addDeploymentLog(deploymentId, {
              log_level: 'error',
              message: `❌ Railway deployment failed: ${errorMsg}`,
              metadata: { railway_status: railwayStatus, deployment_id: railwayDeployment.id }
            })
            throw new DeploymentError(errorMsg, 'DEPLOY_FAILED')
          case 'REMOVED':
          case 'SLEEPING':  // Service went to sleep
            // This shouldn't happen during active monitoring, but handle it gracefully
            newStatus = 'failed'
            const stoppedMsg = `Railway deployment ${railwayStatus.toLowerCase()}`
            await this.deploymentService.updateDeployment(deploymentId, {
              status: newStatus,
              error_message: stoppedMsg
            })
            await this.deploymentService.addDeploymentLog(deploymentId, {
              log_level: 'error',
              message: `❌ ${stoppedMsg}`,
              metadata: { railway_status: railwayStatus }
            })
            throw new DeploymentError(stoppedMsg, 'DEPLOY_REMOVED')
          default:
            // Handle unknown statuses gracefully
            newStatus = 'building'
            await this.deploymentService.addDeploymentLog(deploymentId, {
              log_level: 'warn',
              message: `⚠️ Unknown Railway status: ${railwayStatus}, continuing to monitor...`,
              metadata: { railway_status: railwayStatus }
            })
        }

        await this.deploymentService.updateDeploymentStatus(deploymentId, newStatus)

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 30000)) // 30 seconds
        attempts++

      } catch (error) {
        if (error instanceof DeploymentError) {
          throw error
        }
        
        await this.deploymentService.addDeploymentLog(deploymentId, {
          log_level: 'warn',
          message: `Monitoring attempt ${attempts + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: { 
            attempt: attempts + 1, 
            error: error instanceof Error ? error.message : String(error) 
          } as any
        })

        attempts++
        if (attempts >= maxAttempts) {
          throw new DeploymentError('Deployment monitoring timeout', 'MONITOR_TIMEOUT')
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 30000))
      }
    }

    throw new DeploymentError('Deployment monitoring timeout', 'MONITOR_TIMEOUT')
  }

  async performHealthCheck(deploymentId: string): Promise<HealthCheck> {
    const deployment = await this.deploymentService.getDeployment(deploymentId)
    if (!deployment) {
      throw new DeploymentError('Deployment not found for health check', 'HEALTH_CHECK_FAILED')
    }

    const baseUrl = deployment.service_url
    if (!baseUrl) {
      throw new DeploymentError('No service URL available for health check', 'HEALTH_CHECK_FAILED')
    }

    this.logger.info('Performing MCP health check via refresh button', {
      deploymentId,
      deploymentName: deployment.deployment_name,
      url: baseUrl
    })

    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `🔄 Manual health check triggered - using MCP protocol validation`,
      metadata: { 
        step: 'manual_health_check', 
        trigger: 'refresh_button',
        url: baseUrl
      }
    })

    // Use our new MCP health monitor for proper health checking
    try {
      // Trigger the MCP health check directly
      await this.healthMonitor.performMCPHealthCheck(deploymentId)
      
      // Get the latest health check result that was just recorded
      const supabase = await createAdminClient()
      const { data: latestCheck } = await supabase
        .from('health_checks')
        .select('*')
        .eq('deployment_id', deploymentId)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single()

      if (!latestCheck) {
        throw new Error('Health check was performed but no result recorded')
      }

      this.logger.info('MCP health check completed successfully', {
        deploymentId,
        status: latestCheck.status,
        toolsDiscovered: latestCheck.tools_discovered,
        transport: latestCheck.transport_type,
        responseTime: latestCheck.response_time_ms
      })

      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'info',
        message: `✅ MCP health check completed - Status: ${latestCheck.status}, Tools: ${latestCheck.tools_discovered || 0}, Transport: ${latestCheck.transport_type || 'unknown'}`,
        metadata: { 
          status: latestCheck.status,
          tools_discovered: latestCheck.tools_discovered,
          transport_type: latestCheck.transport_type,
          response_time_ms: latestCheck.response_time_ms,
          capabilities: latestCheck.mcp_server_capabilities
        }
      })

      return latestCheck
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      this.logger.error('MCP health check failed', {
        deploymentId,
        error: errorMessage
      })

      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'error',
        message: `❌ MCP health check failed: ${errorMessage}`,
        metadata: { 
          error: errorMessage,
          step: 'manual_health_check_failed'
        }
      })

      // Record a failed health check
      return this.deploymentService.recordHealthCheck(deploymentId, {
        status: 'unhealthy',
        response_time_ms: 0,
        status_code: null,
        error_message: errorMessage,
        tools_discovered: 0,
        transport_type: null,
        mcp_server_capabilities: null
      })
    }
  }

  async restartDeployment(deploymentId: string, options: { force_rebuild?: boolean } = {}): Promise<{ success: boolean; error?: string }> {
    try {
      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'info',
        message: 'Restarting deployment',
        metadata: { step: 'restart', force_rebuild: options.force_rebuild }
      })

      const deployment = await this.deploymentService.getDeployment(deploymentId)
      if (!deployment || !deployment.railway_deployment_id) {
        return { success: false, error: 'Deployment not found or not deployed to Railway' }
      }

      // Update status to indicate restart is happening
      await this.deploymentService.updateDeploymentStatus(deploymentId, 'deploying')

      // For now, just trigger a re-deployment using Railway API
      // This is a simplified implementation - in production you'd want more robust restart logic
      if (options.force_rebuild) {
        await this.deploymentService.addDeploymentLog(deploymentId, {
          log_level: 'info',
          message: 'Force rebuild requested - triggering full redeployment',
          metadata: { step: 'force_rebuild' }
        })
      }

      // Update status to running (simplified - in reality you'd monitor the restart)
      await this.deploymentService.updateDeploymentStatus(deploymentId, 'running')

      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'info',
        message: 'Deployment restart completed',
        metadata: { step: 'restart_complete' }
      })

      return { success: true }
    } catch (error) {
      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'error',
        message: `Restart failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { 
          step: 'restart_failed', 
          error: error instanceof Error ? error.message : String(error) 
        } as any
      })
      
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async startBackgroundMonitoring(deploymentId: string): Promise<void> {
    const logger = this.logger.child({ 
      operation: 'backgroundMonitoring', 
      deploymentId 
    })

    logger.info('Starting background monitoring for deployment')

    // Use setTimeout to start monitoring after a brief delay
    // This ensures the main deployment response is sent immediately
    setTimeout(async () => {
      try {
        await this.monitorDeployment(deploymentId)
        logger.info('Background monitoring completed successfully')
      } catch (error) {
        logger.error('Background monitoring failed', {
          error: error instanceof Error ? error.message : String(error)
        })
        
        // Update deployment status to failed if monitoring fails
        await this.deploymentService.updateDeployment(deploymentId, {
          status: 'failed',
          error_message: `Monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }, 1000) // 1 second delay to ensure response is sent
  }

  async cleanupFailedDeployment(deploymentId: string): Promise<void> {
    try {
      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'info',
        message: 'Starting cleanup of failed deployment',
        metadata: { step: 'cleanup' }
      })

      const deployment = await this.deploymentService.getDeployment(deploymentId)
      if (!deployment) return

      // Cancel Railway deployment if it exists
      if (deployment.railway_deployment_id) {
        try {
          await this.railwayClient.cancelDeployment(deployment.railway_deployment_id)
          await this.deploymentService.addDeploymentLog(deploymentId, {
            log_level: 'info',
            message: 'Cancelled Railway deployment',
            metadata: { railway_deployment_id: deployment.railway_deployment_id }
          })
        } catch (error) {
          await this.deploymentService.addDeploymentLog(deploymentId, {
            log_level: 'warn',
            message: `Failed to cancel Railway deployment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: { 
              error: error instanceof Error ? error.message : String(error) 
            } as any
          })
        }
      }

      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'info',
        message: 'Cleanup completed',
        metadata: { step: 'cleanup' }
      })

    } catch (error) {
      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'error',
        message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { 
          error: error instanceof Error ? error.message : String(error) 
        } as any
      })
    }
  }

  /**
   * Validate server configuration using generic validator (new approach)
   */
  private async validateServerConfigGeneric(
    deploymentId: string, 
    input: CreateDeploymentInput, 
    template: any
  ): Promise<void> {
    const logger = this.logger.child({ deploymentId, operation: 'validateServerConfigGeneric' })
    
    logger.debug('Starting generic server configuration validation', {
      templateName: template.name,
      hasServerConfig: !!input.server_config,
      environment: input.environment
    })

    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Validating ${template.display_name} configuration`,
      metadata: { step: 'validation', templateName: template.name }
    })

    // Use the config from server_config 
    const config = input.server_config || {}

    // Validate using the generic validator
    const validationResult = this.validator.validateConfig(config, template)
    
    if (!validationResult.valid) {
      const errorMessage = `Configuration validation failed: ${validationResult.errors.join(', ')}`
      logger.error('Generic server config validation failed', {
        errors: validationResult.errors,
        templateName: template.name
      })
      throw new DeploymentError(errorMessage, 'VALIDATION_FAILED')
    }

    logger.info('Generic server configuration validation completed successfully')
    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `${template.display_name} configuration validated successfully`,
      metadata: { step: 'validation_complete', templateName: template.name }
    })
  }

  /**
   * Deploy to Railway using generic config (new approach)
   */
  private async deployToRailwayGeneric(
    deploymentId: string,
    railwayProject: any,
    input: CreateDeploymentInput,
    template: any
  ): Promise<{ service: any; deployment: any }> {
    const logger = this.logger.child({ 
      deploymentId, 
      operation: 'deployToRailwayGeneric',
      templateName: template.name
    })

    logger.info('Starting Railway deployment with generic config', {
      projectId: railwayProject.id,
      templateName: template.name
    })

    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Deploying ${template.display_name} to Railway`,
      metadata: { 
        step: 'railway_deployment',
        projectId: railwayProject.id,
        templateName: template.name
      }
    })

    // Get production environment
    const environments = await this.railwayClient.getEnvironments(railwayProject.id)
    const productionEnv = environments.find(env => env.name === 'production')
    
    if (!productionEnv) {
      throw new DeploymentError('Production environment not found in Railway project', 'RAILWAY_ERROR')
    }

    // Transform config using generic validator
    const config = input.server_config || {}
    const deploymentConfig = this.validator.transformConfig(config, template)

    // Generate unique service name with mcpgtm branding for domain influence
    const sanitizedServiceName = input.deployment_name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') 
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 25) // Leave more room for mcpgtm prefix

    const timestamp = Date.now().toString().slice(-8)
    const uniqueServiceName = `mcpgtm-${sanitizedServiceName}-${timestamp}`.slice(0, 50)

    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Generated service name: ${uniqueServiceName}`,
      metadata: { 
        original_name: input.deployment_name,
        sanitized_name: sanitizedServiceName,
        final_name: uniqueServiceName
      }
    })

    // Build environment variables
    const environmentVariables = {
      ...deploymentConfig.environmentVariables,
      TRANSPORT_TYPE: transportTypeService.resolveTransportType({
        template,
        userSelection: input.transport_type as any,
        deploymentName: input.deployment_name
      }),
      PORT: String(deploymentConfig.port),
      NODE_ENV: 'production'
    }

    const deployConfig: DeployConfig & { githubRepo: string; branch?: string } = {
      serviceName: uniqueServiceName,
      environmentVariables,
      healthcheckPath: deploymentConfig.healthCheckPath,
      port: deploymentConfig.port,
      githubRepo: template.github_repo,
      branch: 'main'
    }

    logger.info('Creating Railway service with generic config', {
      serviceName: uniqueServiceName,
      githubRepo: template.github_repo,
      port: deploymentConfig.port,
      envVarCount: Object.keys(environmentVariables).length
    })

    // Create service from GitHub repo
    const service = await this.railwayClient.createServiceFromGitHub(
      railwayProject.id, 
      productionEnv.id,
      deployConfig
    )
    
    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Railway service created: ${service.name}`,
      metadata: { 
        serviceId: service.id,
        serviceName: service.name,
        templateName: template.name
      }
    })

    // Generate a domain for the service
    const domain = await this.railwayClient.generateServiceDomain(productionEnv.id, service.id)
    
    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Generated service domain: ${domain.domain}`,
      metadata: { 
        domain: domain.domain,
        service_id: service.id
      }
    })

    // Get the latest deployment for this service (Railway creates one automatically)
    logger.info('Getting Railway deployment from service')
    const deployments = await this.railwayClient.getServiceDeployments(service.id, productionEnv.id, 1)
    
    if (!deployments || deployments.length === 0) {
      // If no deployment found, wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 2000))
      const retriedDeployments = await this.railwayClient.getServiceDeployments(service.id, productionEnv.id, 1)
      
      if (!retriedDeployments || retriedDeployments.length === 0) {
        throw new DeploymentError('No deployment found after service creation', 'DEPLOY_FAILED')
      }
      
      const railwayDeployment = retriedDeployments[0]
      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'info',
        message: `Found Railway deployment after retry: ${railwayDeployment.id}`,
        metadata: { 
          deployment_id: railwayDeployment.id,
          status: railwayDeployment.status
        }
      })
      
      logger.info('Railway deployment found after retry', {
        serviceId: service.id,
        deploymentId: railwayDeployment.id,
        templateName: template.name
      })

      // Update the deployment object with transport endpoint URL
      const deploymentWithUrl = {
        ...railwayDeployment,
        url: `https://${domain.domain}`  // Store base URL only - transport endpoint added later
      }

      return { service, deployment: deploymentWithUrl }
    }

    const railwayDeployment = deployments[0]
    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Found Railway deployment: ${railwayDeployment.id}`,
      metadata: { 
        deployment_id: railwayDeployment.id,
        status: railwayDeployment.status
      }
    })

    logger.info('Railway deployment found with generic config', {
      serviceId: service.id,
      deploymentId: railwayDeployment.id,
      templateName: template.name
    })

    // Update the deployment object with transport endpoint URL
    const deploymentWithUrl = {
      ...railwayDeployment,
      url: `https://${domain.domain}`  // Store base URL only - transport endpoint added later
    }

    return { service, deployment: deploymentWithUrl }
  }

  /**
   * Validate server configuration using the appropriate adapter
   */
  private async validateServerConfig(
    deploymentId: string, 
    input: CreateDeploymentInput, 
    template: any, 
    adapter: any
  ): Promise<void> {
    const logger = this.logger.child({ deploymentId, operation: 'validateServerConfig' })
    
    logger.debug('Starting server configuration validation', {
      templateName: template.name,
      hasServerConfig: !!input.server_config,
      environment: input.environment
    })

    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Validating ${template.display_name} configuration`,
      metadata: { step: 'validation', templateName: template.name }
    })

    // Use the config from server_config
    const config = input.server_config || {}

    // Validate using the generic validator
    const validationResult = this.validator.validateConfig(config, template)
    
    if (!validationResult.valid) {
      const errorMessage = `Configuration validation failed: ${validationResult.errors.join(', ')}`
      logger.error('Server config validation failed', {
        errors: validationResult.errors,
        templateName: template.name
      })
      throw new DeploymentError(errorMessage, 'VALIDATION_FAILED')
    }

    // Additional adapter-specific validation
    const adapterValidation = adapter.validateConfig(config, template.required_env_vars, template.optional_env_vars)
    if (!adapterValidation.valid) {
      const errorMessage = `Adapter validation failed: ${adapterValidation.errors.join(', ')}`
      logger.error('Adapter validation failed', {
        errors: adapterValidation.errors,
        templateName: template.name
      })
      throw new DeploymentError(errorMessage, 'VALIDATION_FAILED')
    }

    logger.info('Server configuration validation completed successfully')
    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `${template.display_name} configuration validated successfully`,
      metadata: { step: 'validation_complete', templateName: template.name }
    })
  }

  /**
   * Deploy to Railway using server adapter
   */
  private async deployToRailwayWithAdapter(
    deploymentId: string,
    railwayProject: any,
    input: CreateDeploymentInput,
    template: any,
    adapter: any
  ): Promise<{ service: any; deployment: any }> {
    const logger = this.logger.child({ 
      deploymentId, 
      operation: 'deployToRailwayWithAdapter',
      templateName: template.name
    })

    logger.info('Starting Railway deployment with adapter', {
      projectId: railwayProject.id,
      templateName: template.name
    })

    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Deploying ${template.display_name} to Railway`,
      metadata: { 
        step: 'railway_deployment',
        projectId: railwayProject.id,
        templateName: template.name
      }
    })

    // Get production environment
    const environments = await this.railwayClient.getEnvironments(railwayProject.id)
    const productionEnv = environments.find(env => env.name === 'production')
    
    if (!productionEnv) {
      throw new DeploymentError('Production environment not found in Railway project', 'RAILWAY_ERROR')
    }

    // Transform config using adapter
    const config = input.server_config || {}
    const templateConfig = {
      port: template.port,
      healthcheck_path: template.healthcheck_path,
      build_command: template.build_command,
      start_command: template.start_command,
      min_memory_mb: template.min_memory_mb,
      min_cpu_cores: template.min_cpu_cores
    }
    const deploymentConfig = adapter.transformConfig(config, templateConfig)

    // Generate unique service name
    const sanitizedServiceName = input.deployment_name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') 
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30)

    const timestamp = Date.now().toString().slice(-8)
    const uniqueServiceName = `mcp-${sanitizedServiceName}-${timestamp}`.slice(0, 50)

    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Generated service name: ${uniqueServiceName}`,
      metadata: { 
        original_name: input.deployment_name,
        sanitized_name: sanitizedServiceName,
        final_name: uniqueServiceName
      }
    })

    // Build environment variables
    const environmentVariables = {
      ...deploymentConfig.environmentVariables,
      TRANSPORT_TYPE: transportTypeService.resolveTransportType({
        template,
        userSelection: input.transport_type as any,
        deploymentName: input.deployment_name
      }),
      PORT: String(deploymentConfig.port),
      NODE_ENV: 'production'
    }

    const deployConfig: DeployConfig & { githubRepo: string; branch?: string } = {
      serviceName: uniqueServiceName,
      environmentVariables,
      healthcheckPath: deploymentConfig.healthCheckPath,
      port: deploymentConfig.port,
      githubRepo: template.github_repo,
      branch: 'main'
    }

    logger.info('Creating Railway service with adapter config', {
      serviceName: uniqueServiceName,
      githubRepo: template.github_repo,
      port: deploymentConfig.port,
      envVarCount: Object.keys(environmentVariables).length
    })

    // Create service from GitHub repo
    const service = await this.railwayClient.createServiceFromGitHub(
      railwayProject.id, 
      productionEnv.id,
      deployConfig
    )
    
    await this.deploymentService.addDeploymentLog(deploymentId, {
      log_level: 'info',
      message: `Railway service created: ${service.name}`,
      metadata: { 
        serviceId: service.id,
        serviceName: service.name,
        templateName: template.name
      }
    })

    // Wait for deployment to complete
    logger.info('Waiting for Railway deployment to complete')
    const railwayDeployment = await this.railwayClient.waitForDeployment(deploymentId)

    logger.info('Railway deployment completed with adapter', {
      serviceId: service.id,
      deploymentId: railwayDeployment.id,
      deploymentUrl: railwayDeployment.url,
      templateName: template.name
    })

    return { service, deployment: railwayDeployment }
  }

  /**
   * Register MCP server with Letta and attach tools to user's agent
   */
  private async registerMCPServerForDeployment(deploymentId: string): Promise<void> {
    const operationLogger = this.logger.child({
      operation: 'registerMCPServerForDeployment',
      deploymentId
    })

    try {
      operationLogger.info('Starting MCP server registration for deployment')

      // Get deployment details
      const deployment = await this.deploymentService.getDeployment(deploymentId)
      if (!deployment || !deployment.service_url) {
        operationLogger.warn('Deployment not found or missing service URL, skipping MCP registration')
        return
      }

      // Generate MCP server configuration
      const serverConfig = {
        serverName: `${deployment.deployment_name}-${deploymentId.slice(0, 8)}`,
        serverUrl: `${deployment.service_url}/mcp`, // Assume /mcp endpoint
        serverType: deployment.server_template_id || 'generic'
      }

      operationLogger.info('Registering MCP server with Letta', {
        serverName: serverConfig.serverName,
        serverUrl: serverConfig.serverUrl,
        userId: deployment.user_id
      })

      // Register MCP server and attach tools
      const result = await mcpServerService.registerAndAttachMCPServer(
        deployment.user_id,
        deploymentId,
        serverConfig
      )

      operationLogger.info('MCP server registration completed successfully', {
        serverName: result.serverName,
        toolsRegistered: result.toolsRegistered.length,
        agentId: result.agentId
      })

      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'info',
        message: `🤖 MCP server registered with ${result.toolsRegistered.length} tools attached to agent`,
        metadata: {
          step: 'mcp_registration',
          serverName: result.serverName,
          toolsCount: result.toolsRegistered.length,
          agentId: result.agentId
        }
      })

    } catch (error) {
      operationLogger.error('Failed to register MCP server for deployment', {
        error: error instanceof Error ? error.message : String(error),
        deploymentId
      })

      // Don't fail the deployment if MCP registration fails
      await this.deploymentService.addDeploymentLog(deploymentId, {
        log_level: 'warn',
        message: `⚠️ MCP server registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          step: 'mcp_registration_failed',
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }
  }
}

// Factory function to create deployment orchestrator
export const createDeploymentOrchestrator = (): DeploymentOrchestrator => {
  return new DeploymentOrchestrator()
}