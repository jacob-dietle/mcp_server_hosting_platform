import { ServerAdapter, ValidationResult, DeploymentConfig } from './types'
import { EnvVarSchema } from '../server-template-service'

export class EmailBisonAdapter implements ServerAdapter {
  getServerType(): string {
    return 'emailbison-mcp'
  }

  getDefaultPort(): number {
    return 3000
  }

  validateConfig(
    config: Record<string, any>, 
    requiredVars: EnvVarSchema[], 
    optionalVars: EnvVarSchema[]
  ): ValidationResult {
    const errors: string[] = []

    // EmailBison-specific validation (extracted from deployment-orchestrator.ts)
    
    // Validate required fields
    if (!config.api_key) {
      errors.push('EmailBison API key is required')
    }

    if (!config.base_url) {
      errors.push('EmailBison base URL is required')
    }

    // Validate API key format (basic check)
    if (config.api_key && config.api_key.length < 10) {
      errors.push('Invalid API key format')
    }

    // Validate base URL format
    if (config.base_url) {
      try {
        new URL(config.base_url)
      } catch {
        errors.push('Invalid base URL format')
      }
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
        EMAILBISON_API_KEY: config.api_key,
        EMAILBISON_BASE_URL: config.base_url,
        PORT: templateConfig.port.toString(),
        HEALTHCHECK_PATH: templateConfig.healthcheck_path,
        // Add any additional EmailBison-specific environment variables
        ...Object.entries(config)
          .filter(([key]) => !['api_key', 'base_url'].includes(key))
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
    // Optional: Add EmailBison-specific connectivity validation
    // For now, return valid as the basic validation covers the requirements
    return { valid: true, errors: [] }
  }
}

