import { LOG_LEVEL } from '@/constants'

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none'

// Map log levels to numeric values for comparison
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  'debug': 0,
  'info': 1,
  'warn': 2,
  'error': 3,
  'none': 4
}

// Parse the configured log level
const configuredLevel = (LOG_LEVEL as LogLevel) || 'error'
const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel]
}

// Logger implementation
const logger = {
  debug: (message: string, ...args: any[]): void => {
    if (shouldLog('debug')) {
      console.debug(message, ...args)
    }
  },
  info: (message: string, ...args: any[]): void => {
    if (shouldLog('info')) {
      console.log(message, ...args)
    }
  },
  warn: (message: string, ...args: any[]): void => {
    if (shouldLog('warn')) {
      console.warn(message, ...args)
    }
  },
  error: (message: string, ...args: any[]): void => {
    if (shouldLog('error')) {
      console.error(message, ...args)
    }
  }
}

export default logger 
