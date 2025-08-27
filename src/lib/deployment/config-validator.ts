import 'server-only'

import { EnvVarSchema } from './server-template-service'
import { serverAdapterFactory } from './server-adapters'
import logger from '../logger/index'

export interface ConfigValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

export class ConfigValidator {
  private logger = logger.child({ component: 'ConfigValidator' })

  /**
   * Validates configuration against server template schema using the appropriate adapter
   */
  async validateConfig(
    templateName: string,
    config: Record<string, any>,
    requiredVars: EnvVarSchema[],
    optionalVars: EnvVarSchema[]
  ): Promise<ConfigValidationResult> {
    this.logger.info('Validating configuration', { 
      templateName, 
      configKeys: Object.keys(config),
      requiredVarCount: requiredVars.length,
      optionalVarCount: optionalVars.length
    })

    try {
      // Check if adapter exists for this template
      if (!serverAdapterFactory.isSupported(templateName)) {
        this.logger.error('Unsupported server template', { templateName })
        return {
          valid: false,
          errors: [`Unsupported server template: ${templateName}`]
        }
      }

      // Get the appropriate adapter
      const adapter = serverAdapterFactory.createAdapter(templateName)

      // Validate using the adapter
      const result = adapter.validateConfig(config, requiredVars, optionalVars)

      this.logger.info('Configuration validation completed', {
        templateName,
        valid: result.valid,
        errorCount: result.errors.length
      })

      return {
        valid: result.valid,
        errors: result.errors,
        warnings: []
      }
    } catch (error) {
      this.logger.error('Configuration validation failed', { 
        error: error instanceof Error ? error.message : String(error),
        templateName 
      })

      return {
        valid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`]
      }
    }
  }

  /**
   * Validates server connectivity (if supported by the adapter)
   */
  async validateServerConnection(
    templateName: string,
    config: Record<string, any>
  ): Promise<ConfigValidationResult> {
    this.logger.info('Validating server connection', { templateName })

    try {
      if (!serverAdapterFactory.isSupported(templateName)) {
        return {
          valid: false,
          errors: [`Unsupported server template: ${templateName}`]
        }
      }

      const adapter = serverAdapterFactory.createAdapter(templateName)

      // Check if adapter supports connection validation
      if (!adapter.validateServerConnection) {
        this.logger.debug('Adapter does not support connection validation', { templateName })
        return {
          valid: true,
          errors: [],
          warnings: ['Connection validation not supported for this server type']
        }
      }

      const result = await adapter.validateServerConnection(config)

      this.logger.info('Server connection validation completed', {
        templateName,
        valid: result.valid,
        errorCount: result.errors.length
      })

      return {
        valid: result.valid,
        errors: result.errors,
        warnings: []
      }
    } catch (error) {
      this.logger.error('Server connection validation failed', { 
        error: error instanceof Error ? error.message : String(error),
        templateName 
      })

      return {
        valid: false,
        errors: [`Connection validation failed: ${error instanceof Error ? error.message : String(error)}`]
      }
    }
  }

  /**
   * Validates a single environment variable against its schema
   */
  validateEnvVar(value: any, schema: EnvVarSchema): string[] {
    const errors: string[] = []

    // Required validation
    if (schema.validation?.required && (value === undefined || value === '')) {
      errors.push(`${schema.display_name} is required`)
      return errors
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === '') {
      return errors
    }

    // Type validation
    switch (schema.type) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push(`${schema.display_name} must be a number`)
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean' && !['true', 'false', '1', '0'].includes(String(value).toLowerCase())) {
          errors.push(`${schema.display_name} must be a boolean`)
        }
        break
      case 'url':
        try {
          new URL(value)
        } catch {
          errors.push(`${schema.display_name} must be a valid URL`)
        }
        break
      case 'enum':
        if (schema.options && !schema.options.includes(value)) {
          errors.push(`${schema.display_name} must be one of: ${schema.options.join(', ')}`)
        }
        break
    }

    // Pattern validation
    if (schema.validation?.pattern) {
      const regex = new RegExp(schema.validation.pattern)
      if (!regex.test(String(value))) {
        errors.push(`${schema.display_name} format is invalid`)
      }
    }

    // Length validation
    if (schema.validation?.minLength && String(value).length < schema.validation.minLength) {
      errors.push(`${schema.display_name} must be at least ${schema.validation.minLength} characters`)
    }

    if (schema.validation?.maxLength && String(value).length > schema.validation.maxLength) {
      errors.push(`${schema.display_name} must be at most ${schema.validation.maxLength} characters`)
    }

    // Numeric range validation
    if (schema.type === 'number') {
      const numValue = Number(value)
      if (schema.validation?.min !== undefined && numValue < schema.validation.min) {
        errors.push(`${schema.display_name} must be at least ${schema.validation.min}`)
      }
      if (schema.validation?.max !== undefined && numValue > schema.validation.max) {
        errors.push(`${schema.display_name} must be at most ${schema.validation.max}`)
      }
    }

    return errors
  }

  /**
   * Gets supported server types
   */
  getSupportedServerTypes(): string[] {
    return serverAdapterFactory.getSupportedTypes()
  }
}

export const createConfigValidator = () => new ConfigValidator()

