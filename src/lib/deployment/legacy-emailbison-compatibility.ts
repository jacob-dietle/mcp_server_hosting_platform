import 'server-only'

import { CreateDeploymentInput } from '../../contracts/service-contracts'
import logger from '../logger/index'

// Extended type for backward compatibility with EmailBison
type CreateDeploymentInputWithLegacy = CreateDeploymentInput & {
  emailbison_config?: {
    api_key: string
    base_url: string
  }
}

/**
 * Legacy EmailBison compatibility helper
 * Handles the old api_key/base_url field mapping for backward compatibility
 */
export class LegacyEmailBisonCompatibility {
  private logger = logger.child({ component: 'LegacyEmailBisonCompatibility' })

  /**
   * Check if this is a legacy EmailBison request
   */
  isLegacyEmailBisonRequest(input: CreateDeploymentInputWithLegacy): boolean {
    // Legacy request: has emailbison_config but no server_template_id
    const hasEmailBisonConfig = !!(input.emailbison_config?.api_key && input.emailbison_config?.base_url)
    const hasServerTemplateId = !!input.server_template_id
    const hasServerConfig = !!input.server_config
    
    const isLegacy = hasEmailBisonConfig && !hasServerTemplateId && !hasServerConfig
    
    this.logger.info('Checking for legacy EmailBison request', {
      hasEmailBisonConfig,
      hasServerTemplateId,
      hasServerConfig,
      isLegacy
    })
    
    return isLegacy
  }

  /**
   * Transform legacy EmailBison config to new generic format
   */
  transformLegacyEmailBisonConfig(input: CreateDeploymentInputWithLegacy): {
    server_template_id: string
    server_config: Record<string, any>
  } {
    this.logger.info('Transforming legacy EmailBison config to generic format')
    
    if (!input.emailbison_config?.api_key || !input.emailbison_config?.base_url) {
      throw new Error('Legacy EmailBison config missing required fields')
    }

    // EmailBison template ID (should match what's in your database)
    const emailBisonTemplateId = 'b4d07684-f381-44a3-9a02-f2c423eede6e'
    
    // Transform legacy field names to new schema field names
    const server_config: Record<string, any> = {
      EMAILBISON_API_KEY: input.emailbison_config.api_key,
      EMAILBISON_BASE_URL: input.emailbison_config.base_url
    }

    // Include any additional fields from emailbison_config
    for (const [key, value] of Object.entries(input.emailbison_config)) {
      if (!['api_key', 'base_url'].includes(key)) {
        // Convert to uppercase and add to server_config
        server_config[key.toUpperCase()] = value
      }
    }

    this.logger.info('Legacy EmailBison config transformed', {
      originalFields: Object.keys(input.emailbison_config),
      transformedFields: Object.keys(server_config),
      templateId: emailBisonTemplateId
    })

    return {
      server_template_id: emailBisonTemplateId,
      server_config
    }
  }

  /**
   * Update deployment input to use generic format while maintaining legacy support
   */
  convertLegacyEmailBisonInput(input: CreateDeploymentInputWithLegacy): CreateDeploymentInputWithLegacy {
    if (!this.isLegacyEmailBisonRequest(input)) {
      return input // Not a legacy request, return as-is
    }

    this.logger.info('Converting legacy EmailBison input to generic format')

    const { server_template_id, server_config } = this.transformLegacyEmailBisonConfig(input)
    
    // Create new input with both legacy and new fields
    const convertedInput: CreateDeploymentInputWithLegacy = {
      ...input,
      server_template_id,
      server_config,
      // Keep original emailbison_config for database backward compatibility
      emailbison_config: input.emailbison_config
    }

    this.logger.info('Legacy EmailBison input converted successfully', {
      hasOriginalEmailBisonConfig: !!convertedInput.emailbison_config,
      hasNewServerTemplateId: !!convertedInput.server_template_id,
      hasNewServerConfig: !!convertedInput.server_config
    })

    return convertedInput
  }
}

// Export singleton instance
export const legacyEmailBisonCompatibility = new LegacyEmailBisonCompatibility()

// Export factory function for dependency injection  
export const createLegacyEmailBisonCompatibility = () => new LegacyEmailBisonCompatibility() 