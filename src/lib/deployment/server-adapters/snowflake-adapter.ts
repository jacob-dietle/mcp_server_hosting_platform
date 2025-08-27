import { ServerAdapter, ValidationResult, DeploymentConfig } from './types'
import { EnvVarSchema } from '../server-template-service'

export class SnowflakeAdapter implements ServerAdapter {
  getServerType(): string {
    return 'snowflake-mcp'
  }

  getDefaultPort(): number {
    return 3002
  }

  validateConfig(
    config: Record<string, any>, 
    requiredVars: EnvVarSchema[], 
    optionalVars: EnvVarSchema[]
  ): ValidationResult {
    const errors: string[] = []

    // Snowflake-specific validation
    
    // Validate required fields - check for actual field names from schema
    if (!config.SNOWFLAKE_ACCOUNT) {
      errors.push('Snowflake account is required')
    }

    if (!config.SNOWFLAKE_USERNAME) {
      errors.push('Snowflake username is required')
    }

    if (!config.SNOWFLAKE_PASSWORD) {
      errors.push('Snowflake password is required')
    }

    if (!config.SNOWFLAKE_WAREHOUSE) {
      errors.push('Snowflake warehouse is required')
    }

    if (!config.SNOWFLAKE_DATABASE) {
      errors.push('Snowflake database is required')
    }

    if (!config.SNOWFLAKE_SCHEMA) {
      errors.push('Snowflake schema is required')
    }

    // Validate account format (Snowflake accounts have specific format)
    if (config.SNOWFLAKE_ACCOUNT && !config.SNOWFLAKE_ACCOUNT.includes('.')) {
      errors.push('Snowflake account must include region (e.g., account.region)')
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
        SNOWFLAKE_ACCOUNT: config.SNOWFLAKE_ACCOUNT,
        SNOWFLAKE_USERNAME: config.SNOWFLAKE_USERNAME,
        SNOWFLAKE_PASSWORD: config.SNOWFLAKE_PASSWORD,
        SNOWFLAKE_WAREHOUSE: config.SNOWFLAKE_WAREHOUSE,
        SNOWFLAKE_DATABASE: config.SNOWFLAKE_DATABASE,
        SNOWFLAKE_SCHEMA: config.SNOWFLAKE_SCHEMA,
        PORT: templateConfig.port.toString(),
        HEALTHCHECK_PATH: templateConfig.healthcheck_path,
        // Add any additional Snowflake-specific environment variables
        ...Object.entries(config)
          .filter(([key]) => !['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USERNAME', 'SNOWFLAKE_PASSWORD', 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_DATABASE', 'SNOWFLAKE_SCHEMA'].includes(key))
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
    // Optional: Add Snowflake-specific connectivity validation
    // For now, return valid as the basic validation covers the requirements
    return { valid: true, errors: [] }
  }
}

