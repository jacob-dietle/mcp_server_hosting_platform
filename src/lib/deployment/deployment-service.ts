import 'server-only'

import { 
  IDeploymentService, 
  CreateDeploymentInput, 
  UpdateDeploymentInput,
  DeploymentWithLogs,
  DeploymentError 
} from '../../contracts/service-contracts'

// Extended type for backward compatibility with EmailBison
type CreateDeploymentInputWithLegacy = CreateDeploymentInput & {
  emailbison_config?: {
    api_key: string
    base_url: string
  }
}
import { 
  Deployment, 
  DeploymentInsert,
  DeploymentUpdate,
  DeploymentLog, 
  DeploymentLogInsert,
  HealthCheck,
  HealthCheckInsert,
  DeploymentStatus 
} from '../../../types/database'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ServerTemplateService } from './server-template-service'
import { serverAdapterFactory } from './server-adapters'
import { ConfigValidator } from './config-validator'

// No need for schema helper - use schema-qualified table names instead
import logger from '../logger/index'

export class DeploymentService implements IDeploymentService {
  private supabase: any
  private logger = logger.child({ component: 'DeploymentService' })
  private templateService: ServerTemplateService
  private configValidator: ConfigValidator

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient
    this.templateService = new ServerTemplateService()
    this.configValidator = new ConfigValidator()
  }

  async createDeployment(input: CreateDeploymentInputWithLegacy): Promise<Deployment> {
    return this.logger.time('createDeployment', async () => {
      this.logger.info('Creating deployment', { 
        deployment_name: input.deployment_name,
        user_id: input.user_id,
        has_server_template_id: !!input.server_template_id,
        has_server_config: !!input.server_config,
        has_emailbison_config: !!input.emailbison_config
      })

      try {
        const supabase = this.supabase || await createClient()
        
        // Check if deployment name already exists for this user
        let finalDeploymentName = input.deployment_name
        let suffix = 1
        
        while (true) {
          const { data: existing } = await supabase
            .from('deployments')
            .select('id')
            .eq('user_id', input.user_id)
            .eq('deployment_name', finalDeploymentName)
            .limit(1)
            .single()
          
          if (!existing) {
            // Name is unique, we can use it
            break
          }
          
          // Name exists, append suffix
          suffix++
          finalDeploymentName = `${input.deployment_name}-${suffix}`
          this.logger.info('Deployment name already exists, trying new name', { 
            original: input.deployment_name,
            newName: finalDeploymentName
          })
        }
        
        // Initialize deployment data
        const deploymentData: any = {
          user_id: input.user_id,
          deployment_name: finalDeploymentName,
          environment: input.environment || 'production',
          advanced_config: input.advanced_config || {},
          status: 'pending' as const,
          health_status: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        // Handle multi-server support with backward compatibility
        if (input.server_template_id && input.server_config) {
          // New flow: Using server template and generic config
          this.logger.info('Using new multi-server flow', {
            template_id: input.server_template_id
          })

          // Validate template exists and user has access
          const template = await this.templateService.getTemplate(input.server_template_id)
          if (!template) {
            throw new DeploymentError(
              `Server template not found: ${input.server_template_id}`,
              'TEMPLATE_NOT_FOUND',
              404
            )
          }

          // Check user access
          const canAccess = await this.templateService.canUserAccessTemplate(
            input.user_id,
            input.server_template_id
          )
          if (!canAccess) {
            throw new DeploymentError(
              'Access denied to server template',
              'TEMPLATE_ACCESS_DENIED',
              403
            )
          }

          // Validate config using adapter
          if (serverAdapterFactory.isSupported(template.name)) {
            const adapter = serverAdapterFactory.createAdapter(template.name)
            const validationResult = adapter.validateConfig(
              input.server_config,
              template.required_env_vars,
              template.optional_env_vars
            )

            if (!validationResult.valid) {
              throw new DeploymentError(
                `Configuration validation failed: ${validationResult.errors.join(', ')}`,
                'VALIDATION_FAILED',
                400
              )
            }
          }

          // Set multi-server fields
          deploymentData.server_template_id = input.server_template_id
          deploymentData.server_config = input.server_config

          // For EmailBison template, also populate legacy field for backward compatibility
          if (template.name === 'emailbison-mcp') {
            deploymentData.emailbison_config = {
              api_key: input.server_config.api_key,
              base_url: input.server_config.base_url
            }
            this.logger.info('Populating emailbison_config for backward compatibility')
          }

        } else if (input.emailbison_config) {
          // Legacy flow: EmailBison-specific configuration
          this.logger.info('Using legacy EmailBison flow')

          // Auto-detect as EmailBison template
          const emailBisonTemplateId = 'b4d07684-f381-44a3-9a02-f2c423eede6e'
          
          // Set both old and new fields for smooth transition
          deploymentData.emailbison_config = input.emailbison_config
          deploymentData.server_template_id = emailBisonTemplateId
          deploymentData.server_config = {
            ...input.emailbison_config // Include all EmailBison config fields
          }

          this.logger.info('Auto-detected EmailBison deployment, populated new schema fields')

        } else {
          // No configuration provided
          throw new DeploymentError(
            'Either server_config with server_template_id or emailbison_config must be provided',
            'MISSING_CONFIG',
            400
          )
        }

        // Set transport type if provided
        if (input.transport_type) {
          deploymentData.advanced_config.transport_type = input.transport_type
        }

        // Only include railway_project_id if it's a valid UUID (not empty)
        if (input.railway_project_id && input.railway_project_id.trim() !== '') {
          deploymentData.railway_project_id = input.railway_project_id
        }

        const { data: deployment, error } = await supabase
          .from('deployments')
          .insert(deploymentData)
          .select()
          .single()

        if (error) {
          this.logger.error('Failed to insert deployment', { error: error.message }, error)
          throw new DeploymentError(
            `Failed to create deployment: ${error.message}`,
            'DEPLOYMENT_CREATE_FAILED',
            500,
            error
          )
        }

        // Handle trial deployment if applicable
        if (input.is_trial && input.trial_application_id) {
          await this.linkDeploymentToTrial(deployment.id, input.trial_application_id)
          this.logger.info('Trial deployment linked successfully', {
            deployment_id: deployment.id,
            trial_application_id: input.trial_application_id
          })
        }

        this.logger.info('Deployment created successfully', { 
          deployment_id: deployment.id,
          deployment_name: deployment.deployment_name,
          original_name: input.deployment_name,
          name_was_modified: deployment.deployment_name !== input.deployment_name,
          is_trial: input.is_trial || false,
          server_template_id: deployment.server_template_id,
          has_server_config: !!deployment.server_config,
          has_emailbison_config: !!deployment.emailbison_config
        })

        return deployment
      } catch (error) {
        if (error instanceof DeploymentError) {
          throw error
        }
        
        this.logger.error('Unexpected error creating deployment', {
          deployment_name: input.deployment_name,
          user_id: input.user_id
        }, error as Error)
        
        throw new DeploymentError(
          `Unexpected error creating deployment: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'UNEXPECTED_ERROR',
          500,
          error
        )
      }
    }, { 
      operation: 'createDeployment',
      deployment_name: input.deployment_name,
      user_id: input.user_id
    })
  }

  async getDeployment(id: string): Promise<Deployment | null> {
    try {
      const supabase = await createClient()
      const { data: deployment, error } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null
        }
        throw new DeploymentError(
          `Failed to get deployment: ${error.message}`,
          'GET_FAILED',
          500,
          error
        )
      }

      return deployment
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error getting deployment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async getDeploymentWithLogs(id: string): Promise<DeploymentWithLogs | null> {
    try {
      const deployment = await this.getDeployment(id)
      if (!deployment) return null

      const [logs, healthChecks] = await Promise.all([
        this.getDeploymentLogs(id, 100),
        this.getLatestHealthChecks(id, 10)
      ])

      return {
        ...deployment,
        logs,
        health_checks: healthChecks
      }
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error getting deployment with logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async updateDeployment(id: string, data: UpdateDeploymentInput): Promise<Deployment> {
    try {
      const updateData: DeploymentUpdate = {
        ...data,
        updated_at: new Date().toISOString()
      }

      const clientType = this.supabase ? 'injected' : 'admin'
      this.logger.info('Updating deployment', {
        deploymentId: id,
        updateFields: Object.keys(data),
        clientType
      })

      const supabase = this.supabase || await createAdminClient()
      const { data: deployment, error } = await supabase
        .schema('auth_logic')
        .from('deployments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        this.logger.error('Failed to update deployment', {
          deploymentId: id,
          error: error.message,
          clientType
        })
        throw new DeploymentError(
          `Failed to update deployment: ${error.message}`,
          'UPDATE_FAILED',
          500,
          error
        )
      }

      this.logger.info('Successfully updated deployment', {
        deploymentId: id,
        updatedFields: Object.keys(data),
        clientType
      })

      // Log the update
      await this.addDeploymentLog(id, {
        log_level: 'info',
        message: `Deployment updated`,
        metadata: { action: 'update', changes: Object.keys(data) }
      })

      return deployment
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error updating deployment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async deleteDeployment(id: string): Promise<boolean> {
    try {
      const supabase = await createClient()
      
      // First, delete related logs and health checks
      await Promise.all([
        supabase.from('deployment_logs').delete().eq('deployment_id', id),
        supabase.from('health_checks').delete().eq('deployment_id', id),
        supabase.from('api_usage').delete().eq('deployment_id', id)
      ])

      // Then delete the deployment
      const { error } = await supabase
        .from('deployments')
        .delete()
        .eq('id', id)

      if (error) {
        throw new DeploymentError(
          `Failed to delete deployment: ${error.message}`,
          'DELETE_FAILED',
          500,
          error
        )
      }

      return true
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error deleting deployment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async listDeployments(userId: string): Promise<Deployment[]> {
    try {
      const supabase = this.supabase || await createClient()
      const { data: deployments, error } = await supabase
        .from('deployments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new DeploymentError(
          `Failed to list deployments: ${error.message}`,
          'LIST_FAILED',
          500,
          error
        )
      }

      return deployments || []
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error listing deployments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async getUserActiveDeployments(userId: string): Promise<Deployment[]> {
    try {
      const supabase = await createClient()
      const { data: deployments, error } = await supabase
        .from('deployments')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'validating', 'deploying', 'building', 'running'])
        .order('created_at', { ascending: false })

      if (error) {
        throw new DeploymentError(
          `Failed to get active deployments: ${error.message}`,
          'LIST_FAILED',
          500,
          error
        )
      }

      return deployments || []
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error getting active deployments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<void> {
    try {
      await this.updateDeployment(id, { status })
      
      await this.addDeploymentLog(id, {
        log_level: 'info',
        message: `Deployment status changed to: ${status}`,
        metadata: { action: 'status_change', new_status: status }
      })
    } catch (error) {
      throw new DeploymentError(
        `Failed to update deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STATUS_UPDATE_FAILED',
        500,
        error
      )
    }
  }

  async addDeploymentLog(deploymentId: string, log: Omit<DeploymentLogInsert, 'deployment_id'>): Promise<DeploymentLog> {
    try {
      const logData: DeploymentLogInsert = {
        deployment_id: deploymentId,
        ...log,
        created_at: new Date().toISOString()
      }

      const supabase = await createClient()
      const { data: logEntry, error } = await supabase
        .from('deployment_logs')
        .insert(logData)
        .select()
        .single()

      if (error) {
        throw new DeploymentError(
          `Failed to add deployment log: ${error.message}`,
          'LOG_ADD_FAILED',
          500,
          error
        )
      }

      return logEntry
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error adding deployment log: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async getDeploymentLogs(deploymentId: string, limit: number = 100): Promise<DeploymentLog[]> {
    try {
      const supabase = await createClient()
      const { data: logs, error } = await supabase
        .from('deployment_logs')
        .select('*')
        .eq('deployment_id', deploymentId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new DeploymentError(
          `Failed to get deployment logs: ${error.message}`,
          'LOGS_GET_FAILED',
          500,
          error
        )
      }

      return logs || []
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error getting deployment logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async recordHealthCheck(deploymentId: string, check: Omit<HealthCheckInsert, 'deployment_id'>): Promise<HealthCheck> {
    try {
      const checkData: HealthCheckInsert = {
        deployment_id: deploymentId,
        ...check,
        checked_at: new Date().toISOString()
      }

      // Use service role client for health check operations since they're performed by server-side services
      const supabase = this.supabase || await createAdminClient()
      const { data: healthCheck, error } = await supabase
        .from('health_checks')
        .insert(checkData)
        .select()
        .single()

      if (error) {
        this.logger.error('Failed to insert health check record', {
          deploymentId,
          error: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
          hasInjectedClient: !!this.supabase,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
        })
        throw new DeploymentError(
          `Failed to record health check: ${error.message}`,
          'HEALTH_CHECK_FAILED',
          500,
          error
        )
      }

      // Note: Deployment status updates are handled by the health monitor
      // to ensure proper handling of status transitions (e.g., failed -> running)

      return healthCheck
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error recording health check: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async getLatestHealthCheck(deploymentId: string): Promise<HealthCheck | null> {
    try {
      const supabase = await createClient()
      const { data: healthCheck, error } = await supabase
        .from('health_checks')
        .select('*')
        .eq('deployment_id', deploymentId)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null
        }
        throw new DeploymentError(
          `Failed to get latest health check: ${error.message}`,
          'HEALTH_CHECK_GET_FAILED',
          500,
          error
        )
      }

      return healthCheck
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error getting latest health check: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  async getLatestHealthChecks(deploymentId: string, limit: number = 10): Promise<HealthCheck[]> {
    try {
      const supabase = await createClient()
      const { data: healthChecks, error } = await supabase
        .from('health_checks')
        .select('*')
        .eq('deployment_id', deploymentId)
        .order('checked_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new DeploymentError(
          `Failed to get health checks: ${error.message}`,
          'HEALTH_CHECKS_GET_FAILED',
          500,
          error
        )
      }

      return healthChecks || []
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error
      }
      throw new DeploymentError(
        `Unexpected error getting health checks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNEXPECTED_ERROR',
        500,
        error
      )
    }
  }

  /**
   * Link a deployment to a trial application
   */
  private async linkDeploymentToTrial(deploymentId: string, trialApplicationId: string): Promise<void> {
    return this.logger.time('linkDeploymentToTrial', async () => {
      try {
        const supabase = this.supabase || await createClient()

        // Update the deployment_trials record with the deployment_id
        const { error } = await supabase
          .from('deployment_trials')
          .update({ deployment_id: deploymentId })
          .eq('trial_application_id', trialApplicationId)

        if (error) {
          this.logger.error('Failed to link deployment to trial', { 
            deploymentId, 
            trialApplicationId, 
            error: error.message 
          })
          throw new DeploymentError(
            `Failed to link deployment to trial: ${error.message}`,
            'TRIAL_LINK_FAILED',
            500,
            error
          )
        }

        this.logger.info('Successfully linked deployment to trial', {
          deploymentId,
          trialApplicationId
        })
      } catch (error) {
        if (error instanceof DeploymentError) {
          throw error
        }
        
        this.logger.error('Unexpected error linking deployment to trial', {
          deploymentId,
          trialApplicationId
        }, error as Error)
        
        throw new DeploymentError(
          `Unexpected error linking deployment to trial: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'UNEXPECTED_ERROR',
          500,
          error
        )
      }
    })
  }

  /**
   * Check if a deployment is a trial deployment
   */
  async isTrialDeployment(deploymentId: string): Promise<boolean> {
    return this.logger.time('isTrialDeployment', async () => {
      try {
        const supabase = this.supabase || await createClient()

        const { data: trialDeployment, error } = await supabase
          .from('deployment_trials')
          .select('id')
          .eq('deployment_id', deploymentId)
          .limit(1)
          .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
          this.logger.error('Error checking if deployment is trial', { deploymentId, error })
          throw new Error('Failed to check trial status')
        }

        return !!trialDeployment
      } catch (error) {
        this.logger.error('Error in isTrialDeployment', { deploymentId, error })
        throw error
      }
    })
  }

  /**
   * Get trial information for a deployment
   */
  async getTrialInfo(deploymentId: string): Promise<any> {
    return this.logger.time('getTrialInfo', async () => {
      try {
        const supabase = this.supabase || await createClient()

        const { data: trialInfo, error } = await supabase
          .from('deployment_trials')
          .select(`
            *,
            trial_applications (
              id,
              status,
              applied_at,
              mcp_server_type,
              qualification_answers
            )
          `)
          .eq('deployment_id', deploymentId)
          .single()

        if (error) {
          if (error.code === 'PGRST116') { // Not found
            return null
          }
          this.logger.error('Error fetching trial info', { deploymentId, error })
          throw new Error('Failed to fetch trial information')
        }

        // Calculate days remaining
        const now = new Date()
        const trialEnd = new Date(trialInfo.trial_end)
        const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

        return {
          ...trialInfo,
          days_remaining: daysRemaining,
          is_expired: daysRemaining <= 0,
          conversion_eligible: daysRemaining > 0 && !trialInfo.converted
        }
      } catch (error) {
        this.logger.error('Error in getTrialInfo', { deploymentId, error })
        throw error
      }
    })
  }
}

// Factory function to create deployment service
export const createDeploymentService = (supabaseClient?: any): DeploymentService => {
  return new DeploymentService(supabaseClient)
}
