import 'server-only'

import { EnvVarSchema, ServerTemplate } from './server-template-service'
import logger from '../logger/index'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

export interface DeploymentConfig {
  environmentVariables: Record<string, string>
  port: number
  healthCheckPath: string
  buildCommand?: string
  startCommand?: string
  memoryMb: number
  cpuCores: number
}

/**
 * Generic server validator that works for ALL server types
 * Uses database schema as the source of truth for validation
 */
export class GenericServerValidator {
  private logger = logger.child({ component: 'GenericServerValidator' })

  /**
   * Validates configuration against server template schema
   * Works for ANY server type - no adapters needed!
   */
  validateConfig(config: Record<string, any>, template: ServerTemplate): ValidationResult {
    this.logger.info('Validating configuration with generic validator', { 
      templateName: template.name,
      configKeys: Object.keys(config),
      requiredVarCount: template.required_env_vars.length,
      optionalVarCount: template.optional_env_vars.length
    })

    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Validate required environment variables
      for (const envVar of template.required_env_vars) {
        const value = config[envVar.name]  // Direct field name match - no mapping!
        
        if (envVar.validation?.required && (value === undefined || value === '' || value === null)) {
          errors.push(`${envVar.display_name} is required`)
          continue
        }
        
        if (value !== undefined && value !== '' && value !== null) {
          const fieldErrors = this.validateField(value, envVar)
          errors.push(...fieldErrors)
        }
      }
      
      // Validate optional environment variables (if provided)
      for (const envVar of template.optional_env_vars) {
        const value = config[envVar.name]
        
        if (value !== undefined && value !== '' && value !== null) {
          const fieldErrors = this.validateField(value, envVar)
          errors.push(...fieldErrors)
        }
      }

      this.logger.info('Generic validation completed', {
        templateName: template.name,
        valid: errors.length === 0,
        errorCount: errors.length,
        warningCount: warnings.length
      })

      return {
        valid: errors.length === 0,
        errors,
        warnings
      }

    } catch (error) {
      this.logger.error('Generic validation failed', { 
        error: error instanceof Error ? error.message : String(error),
        templateName: template.name
      })

      return {
        valid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
        warnings
      }
    }
  }

  /**
   * Generic field validation based on schema definition
   * Handles all validation types: string, number, url, enum, boolean
   */
  private validateField(value: any, schema: EnvVarSchema): string[] {
    const errors: string[] = []
    const fieldName = schema.display_name || schema.name

    // Type validation
    switch (schema.type) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push(`${fieldName} must be a number`)
          return errors // Skip other validations if type is wrong
        }
        break
        
      case 'url':
        try {
          new URL(value)
        } catch {
          errors.push(`${fieldName} must be a valid URL`)
          return errors
        }
        break
        
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`${fieldName} must be true or false`)
          return errors
        }
        break
        
      case 'string':
      default:
        // String validation continues below
        break
    }

    // Pattern validation (regex)
    if (schema.validation?.pattern) {
      const regex = new RegExp(schema.validation.pattern)
      if (!regex.test(String(value))) {
        errors.push(`${fieldName} format is invalid`)
      }
    }

    // Length validation
    const stringValue = String(value)
    if (schema.validation?.minLength && stringValue.length < schema.validation.minLength) {
      errors.push(`${fieldName} must be at least ${schema.validation.minLength} characters`)
    }
    
    if (schema.validation?.maxLength && stringValue.length > schema.validation.maxLength) {
      errors.push(`${fieldName} must be at most ${schema.validation.maxLength} characters`)
    }

    // Numeric range validation (for number types)
    if (schema.type === 'number') {
      const numValue = Number(value)
      if (schema.validation?.min !== undefined && numValue < schema.validation.min) {
        errors.push(`${fieldName} must be at least ${schema.validation.min}`)
      }
      if (schema.validation?.max !== undefined && numValue > schema.validation.max) {
        errors.push(`${fieldName} must be at most ${schema.validation.max}`)
      }
    }

    // Enum validation
    if (schema.type === 'enum' && schema.options && !schema.options.includes(value)) {
      errors.push(`${fieldName} must be one of: ${schema.options.join(', ')}`)
    }

    return errors
  }

  /**
   * Transform configuration for Railway deployment
   * Direct 1:1 mapping - no adapters needed!
   */
  transformConfig(config: Record<string, any>, template: ServerTemplate): DeploymentConfig {
    this.logger.info('Transforming config with generic transformer', {
      templateName: template.name,
      configKeys: Object.keys(config)
    })

    const environmentVariables: Record<string, string> = {}
    
    // Direct 1:1 mapping - field names already match what we need!
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && value !== null && value !== '') {
        environmentVariables[key] = String(value)
      }
    }
    
    // Add standard deployment variables
    environmentVariables.PORT = String(template.port || 3000)
    environmentVariables.HEALTHCHECK_PATH = template.healthcheck_path || '/health'
    environmentVariables.NODE_ENV = 'production'
    
    return {
      environmentVariables,
      port: template.port || 3000,
      healthCheckPath: template.healthcheck_path || '/health',
      buildCommand: template.build_command,
      startCommand: template.start_command,
      memoryMb: template.min_memory_mb || 512,
      cpuCores: template.min_cpu_cores || 0.5
    }
  }

  /**
   * Generate health check URL
   */
  getHealthCheckUrl(baseUrl: string, healthCheckPath: string): string {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '')
    const cleanPath = healthCheckPath.startsWith('/') ? healthCheckPath : `/${healthCheckPath}`
    return `${cleanBaseUrl}${cleanPath}`
  }

  /**
   * Optional: Server connectivity validation
   * Can be extended per server type if needed, but most don't need it
   */
  async validateServerConnection(config: Record<string, any>, template: ServerTemplate): Promise<ValidationResult> {
    // Most server types don't need connectivity validation
    // This can be extended for specific cases if needed
    this.logger.debug('Skipping server connection validation', { 
      templateName: template.name 
    })
    
    return { 
      valid: true, 
      errors: [],
      warnings: ['Connection validation not implemented for this server type']
    }
  }
}

// Export singleton instance
export const genericServerValidator = new GenericServerValidator()

// Export factory function for dependency injection
export const createGenericServerValidator = () => new GenericServerValidator() 