import { ServerAdapter, AdapterFactory } from './types'
import { EmailBisonAdapter } from './emailbison-adapter'
import { InstantlyAdapter } from './instantly-adapter'
import { SnowflakeAdapter } from './snowflake-adapter'

export class ServerAdapterFactory implements AdapterFactory {
  private adapters: Map<string, () => ServerAdapter> = new Map()

  constructor() {
    // Register all available adapters
    this.adapters.set('emailbison-mcp', () => new EmailBisonAdapter())
    this.adapters.set('instantly-mcp', () => new InstantlyAdapter())
    this.adapters.set('snowflake-mcp', () => new SnowflakeAdapter())
  }

  createAdapter(templateName: string): ServerAdapter {
    const adapterFactory = this.adapters.get(templateName)
    
    if (!adapterFactory) {
      throw new Error(`No adapter found for server template: ${templateName}`)
    }

    return adapterFactory()
  }

  getSupportedTypes(): string[] {
    return Array.from(this.adapters.keys())
  }

  isSupported(templateName: string): boolean {
    return this.adapters.has(templateName)
  }

  /**
   * Register a new adapter for a server template
   */
  registerAdapter(templateName: string, adapterFactory: () => ServerAdapter): void {
    this.adapters.set(templateName, adapterFactory)
  }

  /**
   * Unregister an adapter for a server template
   */
  unregisterAdapter(templateName: string): boolean {
    return this.adapters.delete(templateName)
  }
}

// Export singleton instance
export const serverAdapterFactory = new ServerAdapterFactory()

// Export factory function for dependency injection
export const createServerAdapterFactory = () => new ServerAdapterFactory()

