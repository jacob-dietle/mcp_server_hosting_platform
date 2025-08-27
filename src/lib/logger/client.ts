// Client-safe logger for use in browser environments
export interface ClientLogger {
  debug: (message: string, context?: any) => void
  info: (message: string, context?: any) => void
  warn: (message: string, context?: any) => void
  error: (message: string, context?: any, error?: Error) => void
  time: <T>(operation: string, fn: () => T | Promise<T>, context?: any) => T | Promise<T>
  child: (context: any) => ClientLogger
}

class SimpleClientLogger implements ClientLogger {
  private context: any = {}

  constructor(context?: any) {
    this.context = context || {}
  }

  private log(level: string, message: string, context?: any, error?: Error) {
    if (typeof window === 'undefined') return // Safety check
    
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (!isDevelopment && level === 'debug') return // Skip debug logs in production

    const logData = {
      level,
      message,
      ...this.context,
      ...context,
      timestamp: new Date().toISOString()
    }

    switch (level) {
      case 'debug':
        console.debug(message, logData)
        break
      case 'info':
        console.info(message, logData)
        break
      case 'warn':
        console.warn(message, logData)
        break
      case 'error':
        console.error(message, logData, error)
        break
    }
  }

  debug(message: string, context?: any) {
    this.log('debug', message, context)
  }

  info(message: string, context?: any) {
    this.log('info', message, context)
  }

  warn(message: string, context?: any) {
    this.log('warn', message, context)
  }

  error(message: string, context?: any, error?: Error) {
    this.log('error', message, context, error)
  }

  async time<T>(operation: string, fn: () => T | Promise<T>, context?: any): Promise<T> {
    const startTime = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - startTime
      this.debug(`${operation} completed`, { ...context, duration, operation })
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.error(`${operation} failed`, { ...context, duration, operation }, error as Error)
      throw error
    }
  }

  child(context: any): ClientLogger {
    return new SimpleClientLogger({ ...this.context, ...context })
  }
}

// Export a singleton instance for convenience
export const clientLogger = new SimpleClientLogger()

// Export factory function
export const createClientLogger = (context?: any) => new SimpleClientLogger(context)

export default clientLogger 
