export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogContext {
  // Request context
  requestId?: string
  userId?: string
  sessionId?: string
  
  // Deployment context
  deploymentId?: string
  railwayProjectId?: string
  railwayServiceId?: string
  
  // Operation context
  operation?: string
  component?: string
  method?: string
  
  // Performance context
  duration?: number
  startTime?: number
  
  // Custom metadata
  [key: string]: any
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context: LogContext
  error?: {
    name: string
    message: string
    stack?: string
    cause?: any
  }
  tags?: string[]
  source: 'client' | 'server' | 'api'
  environment: string
  version: string
}

export interface LoggerConfig {
  level: LogLevel
  environment: string
  version: string
  enableConsole: boolean
  enableStructured: boolean
  enableRemote: boolean
  remoteEndpoint?: string
  defaultContext?: LogContext
  sensitiveFields?: string[]
}

export interface LoggerTransport {
  name: string
  log: (entry: LogEntry) => void | Promise<void>
  flush?: () => void | Promise<void>
}

export interface PerformanceMetrics {
  operation: string
  duration: number
  success: boolean
  context?: LogContext
}

export interface SecurityEvent {
  type: 'auth_failure' | 'access_denied' | 'suspicious_activity' | 'data_breach'
  severity: 'low' | 'medium' | 'high' | 'critical'
  context: LogContext
  description: string
} 
