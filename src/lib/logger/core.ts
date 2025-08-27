import { 
  LogLevel, 
  LogEntry, 
  LogContext, 
  LoggerConfig, 
  LoggerTransport,
  PerformanceMetrics,
  SecurityEvent
} from './types'

/**
 * Core Logger Class - Enterprise-grade logging with context awareness
 */
export class Logger {
  private transports: LoggerTransport[] = []
  private contextStack: LogContext[] = []
  private performanceMetrics: PerformanceMetrics[] = []
  
  // Log level priorities for filtering
  private static readonly levelPriorities: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
  }

  constructor(private config: LoggerConfig) {}

  /**
   * Add a transport for log output
   */
  addTransport(transport: LoggerTransport): void {
    this.transports.push(transport)
  }

  /**
   * Remove a transport
   */
  removeTransport(name: string): void {
    this.transports = this.transports.filter(t => t.name !== name)
  }

  /**
   * Push context onto the stack - useful for request tracing
   */
  pushContext(context: LogContext): void {
    this.contextStack.push(context)
  }

  /**
   * Pop context from the stack
   */
  popContext(): LogContext | undefined {
    return this.contextStack.pop()
  }

  /**
   * Get merged context from stack + provided context
   */
  private getMergedContext(additionalContext: LogContext = {}): LogContext {
    return {
      ...this.config.defaultContext,
      ...this.contextStack.reduce((acc, ctx) => ({ ...acc, ...ctx }), {}),
      ...additionalContext
    }
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return Logger.levelPriorities[level] >= Logger.levelPriorities[this.config.level]
  }

  /**
   * Core logging method
   */
  private async log(level: LogLevel, message: string, context: LogContext = {}, error?: Error): Promise<void> {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.getMergedContext(context),
      source: typeof window === 'undefined' ? 'server' : 'client',
      environment: this.config.environment,
      version: this.config.version,
      tags: context.tags || []
    }

    // Add error details if provided
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      }
    }

    // Send to all transports
    const promises = this.transports.map(transport => {
      try {
        return transport.log(entry)
      } catch (err) {
        console.error(`Transport ${transport.name} failed:`, err)
        return Promise.resolve()
      }
    })

    await Promise.allSettled(promises)
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): Promise<void> {
    return this.log('debug', message, context)
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): Promise<void> {
    return this.log('info', message, context)
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext, error?: Error): Promise<void> {
    return this.log('warn', message, context, error)
  }

  /**
   * Error level logging
   */
  error(message: string, context?: LogContext, error?: Error): Promise<void> {
    return this.log('error', message, context, error)
  }

  /**
   * Fatal level logging
   */
  fatal(message: string, context?: LogContext, error?: Error): Promise<void> {
    return this.log('fatal', message, context, error)
  }

  /**
   * Performance tracking
   */
  async time<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    const startTime = Date.now()
    let success = false
    
    try {
      this.debug(`Starting operation: ${operation}`, { 
        ...context, 
        operation, 
        startTime 
      })
      
      const result = await fn()
      success = true
      return result
    } catch (error) {
      this.error(`Operation failed: ${operation}`, { 
        ...context, 
        operation,
        duration: Date.now() - startTime 
      }, error as Error)
      throw error
    } finally {
      const duration = Date.now() - startTime
      
      // Log completion
      const level = success ? 'info' : 'error'
      this.log(level, `Operation completed: ${operation}`, { 
        ...context, 
        operation,
        duration,
        success 
      })
      
      // Store metrics
      this.performanceMetrics.push({
        operation,
        duration,
        success,
        context: this.getMergedContext(context)
      })
      
      // Keep only last 100 metrics
      if (this.performanceMetrics.length > 100) {
        this.performanceMetrics = this.performanceMetrics.slice(-100)
      }
    }
  }

  /**
   * Security event logging
   */
  async security(event: SecurityEvent): Promise<void> {
    const level: LogLevel = event.severity === 'critical' || event.severity === 'high' ? 'error' : 'warn'
    
    await this.log(level, `Security Event: ${event.type}`, {
      ...event.context,
      securityEventType: event.type,
      securitySeverity: event.severity,
      tags: ['security', event.type, event.severity]
    })
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetrics]
  }

  /**
   * Clear performance metrics
   */
  clearPerformanceMetrics(): void {
    this.performanceMetrics = []
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.config)
    childLogger.transports = [...this.transports]
    childLogger.contextStack = [...this.contextStack, context]
    return childLogger
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    const promises = this.transports
      .filter(transport => transport.flush)
      .map(transport => transport.flush!())
    
    await Promise.allSettled(promises)
  }

  /**
   * Destroy logger and cleanup resources
   */
  async destroy(): Promise<void> {
    await this.flush()
    
    // Cleanup transports that support it
    this.transports.forEach(transport => {
      if ('destroy' in transport && typeof transport.destroy === 'function') {
        (transport as any).destroy()
      }
    })
    
    this.transports = []
    this.contextStack = []
    this.performanceMetrics = []
  }
} 
