import 'server-only'

import { ServerTemplate } from './server-template-service'
import logger from '../logger/index'

export type TransportType = 'sse' | 'streamable-http' | 'http'

/**
 * Transport Type Service
 * 
 * Handles intelligent transport type resolution with fallback hierarchy:
 * 1. Explicit user selection (if we ever add UI for this)
 * 2. Server template default (data-driven)
 * 3. Global system default (based on success rates)
 */
export class TransportTypeService {
  /**
   * Global system default based on domain expertise
   * SSE is more reliable for MCP connections in production
   */
  private readonly SYSTEM_DEFAULT: TransportType = 'sse'

  /**
   * Resolve transport type using intelligent fallback hierarchy
   */
  resolveTransportType(options: {
    template?: ServerTemplate
    userSelection?: TransportType
    deploymentName?: string
  }): TransportType {
    const { template, userSelection, deploymentName } = options

    // 1. User explicitly selected transport type (future feature)
    if (userSelection) {
      logger.info('Using user-selected transport type', {
        component: 'TransportTypeService',
        transportType: userSelection,
        deploymentName,
        source: 'user_selection'
      })
      return userSelection
    }

    // 2. Server template default (data-driven)
    if (template?.default_transport_type) {
      logger.info('Using template default transport type', {
        component: 'TransportTypeService',
        transportType: template.default_transport_type,
        templateName: template.name,
        deploymentName,
        source: 'template_default'
      })
      return template.default_transport_type as TransportType
    }

    // 3. Global system default (fallback)
    logger.info('Using system default transport type', {
      component: 'TransportTypeService',
      transportType: this.SYSTEM_DEFAULT,
      deploymentName,
      source: 'system_default',
      reason: 'no_template_or_user_selection'
    })
    return this.SYSTEM_DEFAULT
  }

  /**
   * Get transport type performance metadata for logging/analytics
   */
  static getTransportTypeMetadata(transportType: TransportType): {
    reliability: 'high' | 'medium' | 'low'
    successRate: string
    recommendedFor: string[]
  } {
    switch (transportType) {
      case 'sse':
        return {
          reliability: 'high',
          successRate: 'high', // Recommended by domain expert
          recommendedFor: ['mcp-connections', 'real-time-streaming', 'production-systems']
        }
      case 'streamable-http':
        return {
          reliability: 'medium',
          successRate: '98.1%', // 53/54 in dev testing data
          recommendedFor: ['testing', 'development', 'fallback-option']
        }
      case 'http':
        return {
          reliability: 'low',
          successRate: 'unknown', // No data yet
          recommendedFor: ['simple-request-response', 'legacy-clients']
        }
      default:
        return {
          reliability: 'medium',
          successRate: 'unknown',
          recommendedFor: []
        }
    }
  }

  /**
   * Get all supported transport types with metadata
   */
  getSupportedTransportTypes(): Array<{
    type: TransportType
    displayName: string
    metadata: ReturnType<typeof TransportTypeService.getTransportTypeMetadata>
  }> {
    const types: TransportType[] = ['sse', 'streamable-http', 'http'] // SSE first as preferred
    
    return types.map((type) => ({
      type,
      displayName: TransportTypeService.getDisplayName(type),
      metadata: TransportTypeService.getTransportTypeMetadata(type)
    }))
  }

  private static getDisplayName(type: TransportType): string {
    switch (type) {
      case 'streamable-http':
        return 'Streamable HTTP'
      case 'sse':
        return 'Server-Sent Events'
      case 'http':
        return 'HTTP'
      default:
        return type
    }
  }
}

export const transportTypeService = new TransportTypeService() 