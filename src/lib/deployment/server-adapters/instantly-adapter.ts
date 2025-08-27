import { ServerAdapter, ValidationResult, DeploymentConfig } from './types'
import { EnvVarSchema } from '../server-template-service'

export class InstantlyAdapter implements ServerAdapter {
  getServerType(): string {
    return 'instantly-mcp'
  }

  getDefaultPort(): number {
    return 3001
  }

  validateConfig(
    config: Record<string, any>, 
    requiredVars: EnvVarSchema[], 
    optionalVars: EnvVarSchema[]
  ): ValidationResult {
    const errors: string[] = []

    // Instantly-specific validation
    
    // Validate required fields - check for the actual field name from schema
    if (!config.INSTANTLY_API_KEY) {
      errors.push('Instantly API key is required')
    }

    // Validate API key format (Instantly uses different format)
    if (config.INSTANTLY_API_KEY && config.INSTANTLY_API_KEY.length < 20) {
      errors.push('Invalid Instantly API key format')
    }

    // Validate against template schema
    for (const varSchema of requiredVars) {
      const value = config[varSchema.name]
      
      if (varSchema.validation?.required && (value === undefined || value === '')) {
        errors.push(`${varSchema.display_name} is required`)
        continue
      }

      if (value !== undefined && value !== '') {
        // Type validation
        if (varSchema.type === 'number' && isNaN(Number(value))) {
          errors.push(`${varSchema.display_name} must be a number`)
        }
        
        if (varSchema.type === 'url') {
          try {
            new URL(value)
          } catch {
            errors.push(`${varSchema.display_name} must be a valid URL`)
          }
        }

        // Pattern validation
        if (varSchema.validation?.pattern) {
          const regex = new RegExp(varSchema.validation.pattern)
          if (!regex.test(String(value))) {
            errors.push(`${varSchema.display_name} format is invalid`)
          }
        }

        // Length validation
        if (varSchema.validation?.minLength && String(value).length < varSchema.validation.minLength) {
          errors.push(`${varSchema.display_name} must be at least ${varSchema.validation.minLength} characters`)
        }

        if (varSchema.validation?.maxLength && String(value).length > varSchema.validation.maxLength) {
          errors.push(`${varSchema.display_name} must be at most ${varSchema.validation.maxLength} characters`)
        }

        // Numeric range validation
        if (varSchema.type === 'number') {
          const numValue = Number(value)
          if (varSchema.validation?.min !== undefined && numValue < varSchema.validation.min) {
            errors.push(`${varSchema.display_name} must be at least ${varSchema.validation.min}`)
          }
          if (varSchema.validation?.max !== undefined && numValue > varSchema.validation.max) {
            errors.push(`${varSchema.display_name} must be at most ${varSchema.validation.max}`)
          }
        }

        // Enum validation
        if (varSchema.type === 'enum' && varSchema.options && !varSchema.options.includes(value)) {
          errors.push(`${varSchema.display_name} must be one of: ${varSchema.options.join(', ')}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  transformConfig(
    config: Record<string, any>, 
    templateConfig: {
      port: number
      healthcheck_path: string
      build_command?: string
      start_command?: string
      min_memory_mb: number
      min_cpu_cores: number
    }
  ): DeploymentConfig {
    return {
      environmentVariables: {
        INSTANTLY_API_KEY: config.INSTANTLY_API_KEY,
        PORT: templateConfig.port.toString(),
        HEALTHCHECK_PATH: templateConfig.healthcheck_path,
        // Add any additional Instantly-specific environment variables
        ...Object.entries(config)
          .filter(([key]) => !['INSTANTLY_API_KEY'].includes(key))
          .reduce((acc, [key, value]) => {
            acc[key.toUpperCase()] = String(value)
            return acc
          }, {} as Record<string, string>)
      },
      port: templateConfig.port,
      healthCheckPath: templateConfig.healthcheck_path,
      buildCommand: templateConfig.build_command,
      startCommand: templateConfig.start_command,
      memoryMb: templateConfig.min_memory_mb,
      cpuCores: templateConfig.min_cpu_cores
    }
  }

  getHealthCheckUrl(baseUrl: string, healthCheckPath: string): string {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '')
    const cleanPath = healthCheckPath.startsWith('/') ? healthCheckPath : `/${healthCheckPath}`
    return `${cleanBaseUrl}${cleanPath}`
  }

  async validateServerConnection(config: Record<string, any>): Promise<ValidationResult> {
    // Optional: Add Instantly-specific connectivity validation
    // For now, return valid as the basic validation covers the requirements
    return { valid: true, errors: [] }
  }
}

