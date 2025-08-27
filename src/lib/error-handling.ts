import { RetryConfig } from '../contracts/service-contracts'

// Enhanced error classes
export class DeploymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'DeploymentError'
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    }
  }
}

export class RailwayApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message)
    this.name = 'RailwayApiError'
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      response: this.response,
    }
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value?: any
  ) {
    super(message)
    this.name = 'ValidationError'
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      field: this.field,
      value: this.value,
    }
  }
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

// Exponential backoff retry function
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error = new Error('Unknown error')

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on the last attempt
      if (attempt === retryConfig.maxRetries) {
        break
      }

      // Don't retry certain types of errors
      if (shouldNotRetry(error)) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
        retryConfig.maxDelay
      )

      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error)
      
      await sleep(delay)
    }
  }

  throw new DeploymentError(
    `Operation failed after ${retryConfig.maxRetries + 1} attempts: ${lastError.message}`,
    'RETRY_EXHAUSTED',
    500,
    { originalError: lastError, attempts: retryConfig.maxRetries + 1 }
  )
}

// Determine if an error should not be retried
function shouldNotRetry(error: any): boolean {
  // Don't retry validation errors
  if (error instanceof ValidationError) {
    return true
  }

  // Don't retry circuit breaker open errors
  if (error instanceof DeploymentError && error.code === 'CIRCUIT_BREAKER_OPEN') {
    return true
  }

  // Don't retry 4xx errors (except 429 - rate limit)
  if (error instanceof RailwayApiError) {
    // Don't retry client errors except rate limits
    if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
      return true
    }
  }

  // Don't retry Railway-specific errors that won't change on retry
  if (error.message?.includes('Invalid project name')) {
    return true // This won't be fixed by retrying
  }

  // Don't retry authentication errors
  if (error.message?.includes('auth') || error.message?.includes('unauthorized')) {
    return true
  }

  // Don't retry permission errors
  if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
    return true
  }

  return false
}

// Sleep utility function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Circuit breaker pattern for external API calls
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 60000, // 1 minute
    private monitoringPeriod = 300000 // 5 minutes
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new DeploymentError(
          'Circuit breaker is OPEN - service temporarily unavailable',
          'CIRCUIT_BREAKER_OPEN',
          503
        )
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    }
  }

  reset() {
    this.failures = 0
    this.lastFailureTime = 0
    this.state = 'CLOSED'
  }
}

// Global circuit breaker instances
export const railwayApiCircuitBreaker = new CircuitBreaker(5, 60000, 300000)
export const supabaseCircuitBreaker = new CircuitBreaker(3, 30000, 180000)

// Error reporting utility
export class ErrorReporter {
  private static instance: ErrorReporter
  private errors: Array<{ error: Error; timestamp: Date; context?: any }> = []

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  report(error: Error, context?: any) {
    this.errors.push({
      error,
      timestamp: new Date(),
      context,
    })

    // Keep only the last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error reported:', error, context)
    }

    // In production, you might want to send to an error tracking service
    // like Sentry, LogRocket, etc.
  }

  getRecentErrors(limit = 10) {
    return this.errors
      .slice(-limit)
      .reverse()
      .map(({ error, timestamp, context }) => ({
        message: error.message,
        name: error.name,
        timestamp,
        context,
      }))
  }

  clearErrors() {
    this.errors = []
  }
}

// Global error reporter instance
export const errorReporter = ErrorReporter.getInstance()

// Utility function to handle async operations with error reporting
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context?: any,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    errorReporter.report(error instanceof Error ? error : new Error(String(error)), context)
    
    if (fallback !== undefined) {
      return fallback
    }
    
    return undefined
  }
}

// Validation utilities
export function validateRequired(value: any, fieldName: string): void {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName, value)
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', 'email', email)
  }
}

export function validateUrl(url: string, fieldName: string = 'url'): void {
  try {
    new URL(url)
  } catch {
    throw new ValidationError(`Invalid URL format for ${fieldName}`, fieldName, url)
  }
}

export function validateLength(
  value: string, 
  min: number, 
  max: number, 
  fieldName: string
): void {
  if (value.length < min) {
    throw new ValidationError(
      `${fieldName} must be at least ${min} characters long`,
      fieldName,
      value
    )
  }
  if (value.length > max) {
    throw new ValidationError(
      `${fieldName} must be no more than ${max} characters long`,
      fieldName,
      value
    )
  }
}
