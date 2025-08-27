import { EnvVarSchema } from '../server-template-service'

export interface ValidationResult {
  valid: boolean
  errors: string[]
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

export interface ServerAdapter {
  /**
   * Validates the provided configuration against the server template schema
   */
  validateConfig(config: Record<string, any>, requiredVars: EnvVarSchema[], optionalVars: EnvVarSchema[]): ValidationResult

  /**
   * Transforms the user-provided configuration into Railway deployment configuration
   */
  transformConfig(config: Record<string, any>, templateConfig: {
    port: number
    healthcheck_path: string
    build_command?: string
    start_command?: string
    min_memory_mb: number
    min_cpu_cores: number
  }): DeploymentConfig

  /**
   * Generates the health check URL for this server type
   */
  getHealthCheckUrl(baseUrl: string, healthCheckPath: string): string

  /**
   * Gets the default port for this server type
   */
  getDefaultPort(): number

  /**
   * Gets the server type identifier
   */
  getServerType(): string

  /**
   * Validates server-specific requirements (e.g., API connectivity)
   */
  validateServerConnection?(config: Record<string, any>): Promise<ValidationResult>
}

export interface AdapterFactory {
  /**
   * Creates an adapter instance for the given server template
   */
  createAdapter(templateName: string): ServerAdapter

  /**
   * Gets all supported server types
   */
  getSupportedTypes(): string[]

  /**
   * Checks if a server type is supported
   */
  isSupported(templateName: string): boolean
}

