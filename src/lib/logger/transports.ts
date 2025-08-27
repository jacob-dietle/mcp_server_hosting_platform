import { LogEntry, LoggerTransport, LoggerConfig } from './types'

/**
 * Console transport - Enhanced console logging with colors and formatting
 */
export class ConsoleTransport implements LoggerTransport {
  name = 'console'
  
  private readonly colors = {
    debug: '\x1b[90m',    // Gray
    info: '\x1b[36m',     // Cyan
    warn: '\x1b[33m',     // Yellow
    error: '\x1b[31m',    // Red
    fatal: '\x1b[35m',    // Magenta
    reset: '\x1b[0m'      // Reset
  }

  constructor(private config: LoggerConfig) {}

  log(entry: LogEntry): void {
    const color = this.colors[entry.level] || this.colors.info
    const reset = this.colors.reset
    
    const timestamp = new Date(entry.timestamp).toISOString()
    const level = entry.level.toUpperCase().padEnd(5)
    const context = this.formatContext(entry.context)
    
    let message = `${color}[${timestamp}] ${level}${reset} ${entry.message}`
    
    if (context) {
      message += ` ${color}${context}${reset}`
    }
    
    const method = entry.level === 'error' || entry.level === 'fatal' ? 'error' : 'log'
    console[method](message)
    
    // Log error details separately
    if (entry.error) {
      console.error('Error details:', entry.error)
    }
    
    // Log full context in debug mode
    if (entry.level === 'debug' && Object.keys(entry.context).length > 0) {
      console.debug('Context:', entry.context)
    }
  }

  private formatContext(context: any): string {
    const parts: string[] = []
    
    if (context.requestId) parts.push(`req:${context.requestId.slice(0, 8)}`)
    if (context.userId) parts.push(`user:${context.userId.slice(0, 8)}`)
    if (context.deploymentId) parts.push(`dep:${context.deploymentId.slice(0, 8)}`)
    if (context.operation) parts.push(`op:${context.operation}`)
    if (context.duration) parts.push(`${context.duration}ms`)
    
    return parts.length > 0 ? `[${parts.join(' ')}]` : ''
  }
}

/**
 * Structured transport - JSON formatted logs for log aggregation
 */
export class StructuredTransport implements LoggerTransport {
  name = 'structured'
  
  constructor(private config: LoggerConfig) {}

  log(entry: LogEntry): void {
    const sanitizedEntry = this.sanitizeEntry(entry)
    console.log(JSON.stringify(sanitizedEntry))
  }

  private sanitizeEntry(entry: LogEntry): LogEntry {
    const sanitized = { ...entry }
    
    // Remove sensitive fields
    if (this.config.sensitiveFields) {
      this.config.sensitiveFields.forEach(field => {
        if (sanitized.context[field]) {
          sanitized.context[field] = '[REDACTED]'
        }
      })
    }
    
    return sanitized
  }
}

/**
 * Remote transport - Send logs to external service
 */
export class RemoteTransport implements LoggerTransport {
  name = 'remote'
  private buffer: LogEntry[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private readonly batchSize = 10
  private readonly flushIntervalMs = 5000

  constructor(private config: LoggerConfig) {
    // Auto-flush every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flush()
    }, this.flushIntervalMs)
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry)
    
    // Flush if buffer is full
    if (this.buffer.length >= this.batchSize) {
      this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.remoteEndpoint) return

    const batch = [...this.buffer]
    this.buffer = []

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LOGGING_API_KEY || ''}`
        },
        body: JSON.stringify({ logs: batch })
      })

      if (!response.ok) {
        console.error('Failed to send logs to remote service:', response.statusText)
        // Re-add to buffer for retry (simple strategy)
        this.buffer.unshift(...batch.slice(0, 5)) // Only retry first 5 to avoid infinite growth
      }
    } catch (error) {
      console.error('Error sending logs to remote service:', error)
      // Re-add to buffer for retry
      this.buffer.unshift(...batch.slice(0, 5))
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush() // Final flush
  }
}

/**
 * File transport - For server-side file logging
 */
export class FileTransport implements LoggerTransport {
  name = 'file'
  
  constructor(private filePath: string) {}

  async log(entry: LogEntry): Promise<void> {
    // Only available on server-side
    if (typeof window === 'undefined') {
      const fs = await import('fs/promises')
      const logLine = JSON.stringify(entry) + '\n'
      
      try {
        await fs.appendFile(this.filePath, logLine)
      } catch (error) {
        console.error('Failed to write to log file:', error)
      }
    }
  }
} 
