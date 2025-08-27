import 'server-only'

import { Logger } from './core'
import { ConsoleTransport, StructuredTransport, RemoteTransport, FileTransport } from './transports'
import { LoggerConfig } from './types'

// Environment-based configuration
const getLoggerConfig = (): LoggerConfig => {
  const isProduction = process.env.NODE_ENV === 'production'
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return {
    level: (process.env.LOG_LEVEL as any) || (isDevelopment ? 'debug' : 'info'),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    enableConsole: true,
    enableStructured: isProduction,
    enableRemote: isProduction && !!process.env.LOGGING_ENDPOINT,
    remoteEndpoint: process.env.LOGGING_ENDPOINT,
    defaultContext: {
      service: 'mcpgtm-web',
      component: 'unknown'
    },
    sensitiveFields: [
      'password',
      'token',
      'api_key',
      'apiKey',
      'authorization',
      'cookie',
      'session',
      'email',
      'phone'
    ]
  }
}

// Create global logger instance
const config = getLoggerConfig()
const logger = new Logger(config)

// Setup transports based on environment
if (config.enableConsole) {
  logger.addTransport(new ConsoleTransport(config))
}

if (config.enableStructured) {
  logger.addTransport(new StructuredTransport(config))
}

if (config.enableRemote && config.remoteEndpoint) {
  logger.addTransport(new RemoteTransport(config))
}

// Add file transport for server-side in production
if (typeof window === 'undefined' && config.environment === 'production') {
  logger.addTransport(new FileTransport('/var/log/mcpgtm-web.log'))
}

// Export logger and utilities
export { logger }
export { Logger } from './core'
export * from './types'
export * from './transports'

// Convenience methods
export const createChildLogger = (context: any) => logger.child(context)
export const createRequestLogger = (requestId: string, userId?: string) => 
  logger.child({ requestId, userId, component: 'api' })

// Express/Next.js middleware helper
export const withLogContext = (context: any) => {
  return (fn: Function) => {
    return async (...args: any[]) => {
      logger.pushContext(context)
      try {
        return await fn(...args)
      } finally {
        logger.popContext()
      }
    }
  }
}

// Performance monitoring decorator
export const logPerformance = (operation: string, context?: any) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      return logger.time(
        `${target.constructor.name}.${propertyName}`,
        () => method.apply(this, args),
        { ...context, operation }
      )
    }
    
    return descriptor
  }
}

// Error boundary logging
export const logError = (error: Error, context?: any) => {
  logger.error('Unhandled error', context, error)
}

export default logger 
