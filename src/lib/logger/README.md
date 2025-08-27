# 🚀 MCPGTM Logger System

A comprehensive, production-ready logging system designed for enterprise applications with Railway deployment orchestration.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Core Features](#core-features)
- [Basic Usage](#basic-usage)
- [Advanced Features](#advanced-features)
- [Context Management](#context-management)
- [Performance Monitoring](#performance-monitoring)
- [Security Logging](#security-logging)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Environment Configuration](#environment-configuration)

## 🚀 Quick Start

```typescript
import logger from '@/lib/logger'

// Basic logging
logger.info('Application started')
logger.error('Something went wrong', { userId: '123' }, error)

// Child logger with context
const apiLogger = logger.child({ component: 'API', requestId: 'req-123' })
apiLogger.info('Processing request')
```

## ✨ Core Features

- **🎯 Contextual Logging**: Rich metadata with every log entry
- **⏱️ Performance Monitoring**: Automatic timing and metrics
- **🔒 Security Events**: Specialized security logging
- **📡 Multiple Transports**: Console, JSON, Remote, File
- **🏷️ PII Protection**: Automatic sensitive data filtering
- **📍 Request Tracing**: End-to-end request correlation

## 📝 Basic Usage

### Log Levels

```typescript
import logger from '@/lib/logger'

logger.debug('Debugging information', { variable: value })
logger.info('General information', { operation: 'user_login' })
logger.warn('Warning message', { deprecated: true })
logger.error('Error occurred', { userId: '123' }, error)
logger.fatal('Critical system failure', { service: 'database' }, error)
```

### Adding Context

```typescript
// Simple context
logger.info('User action', { 
  userId: 'user-123',
  action: 'create_deployment',
  deploymentName: 'my-app'
})

// Context with error
logger.error('Operation failed', {
  operation: 'railway_deploy',
  deploymentId: 'dep-456'
}, error)
```

## 🎛️ Advanced Features

### Child Loggers

```typescript
// Service logger
class DeploymentService {
  private logger = logger.child({ component: 'DeploymentService' })
  
  async createDeployment(input) {
    this.logger.info('Creating deployment', { name: input.name })
    // All logs include component: 'DeploymentService'
  }
}

// Request logger
const reqLogger = logger.child({ 
  requestId: 'req-123',
  endpoint: '/api/deployments'
})
```

## ⏱️ Performance Monitoring

### Automatic Timing

```typescript
import { logPerformance } from '@/lib/logger'

class RailwayService {
  @logPerformance('deployProject')
  async deployProject(projectId: string) {
    // Automatically logs duration and success/failure
  }
}
```

### Manual Timing

```typescript
const result = await logger.time('database_query', async () => {
  return await db.query('SELECT * FROM deployments')
}, { table: 'deployments' })
```

## 🔐 Security Logging

```typescript
await logger.security({
  type: 'auth_failure',
  severity: 'medium',
  context: { userId: 'user-123', ipAddress: request.ip },
  description: 'Failed login attempt'
})
```

## 🎯 Usage Examples

### API Route

```typescript
export async function POST(request: NextRequest) {
  const logger = createRequestLogger(crypto.randomUUID(), userId)
  
  logger.info('API request started', { endpoint: '/api/deployments' })
  
  try {
    const result = await deploymentService.create(input)
    logger.info('Request completed', { deploymentId: result.id })
    return NextResponse.json(result)
  } catch (error) {
    logger.error('Request failed', { endpoint: '/api/deployments' }, error)
    throw error
  }
}
```

### Service Class

```typescript
export class DeploymentService {
  private logger = logger.child({ component: 'DeploymentService' })
  
  async createDeployment(input) {
    return this.logger.time('createDeployment', async () => {
      this.logger.info('Creating deployment', { name: input.name })
      
      try {
        const result = await this.processDeployment(input)
        this.logger.info('Deployment created', { id: result.id })
        return result
      } catch (error) {
        this.logger.error('Deployment failed', { name: input.name }, error)
        throw error
      }
    })
  }
}
```

## 🏗️ Best Practices

### 1. Use Appropriate Log Levels

```typescript
logger.debug('Variable state', { userId })          // Development debugging
logger.info('User logged in', { userId })           // Business events
logger.warn('Deprecated API used', { endpoint })     // Warnings
logger.error('Operation failed', {}, error)         // Errors
logger.fatal('System failure', { service })         // Critical failures
```

### 2. Include Relevant Context

```typescript
// ✅ Good - Rich context
logger.info('Deployment status changed', {
  deploymentId: 'dep-123',
  previousStatus: 'pending',
  newStatus: 'running',
  userId: 'user-456'
})

// ❌ Poor - No context
logger.info('Status changed')
```

### 3. Use Child Loggers

```typescript
// ✅ Good - Consistent context
class UserService {
  private logger = logger.child({ component: 'UserService' })
  
  async getUser(id: string) {
    this.logger.info('Fetching user', { userId: id })
  }
}
```

## ⚙️ Environment Configuration

### Development

```bash
LOG_LEVEL=debug
NODE_ENV=development
```

### Production

```bash
LOG_LEVEL=info
NODE_ENV=production
LOGGING_ENDPOINT=https://logs.company.com/api/ingest
LOGGING_API_KEY=your-api-key
```

## 📈 Features Summary

- **🔍 Complete Observability**: Every operation traced
- **🎯 Rich Context**: Detailed metadata
- **📊 Performance Insights**: Built-in timing
- **🔒 Security Compliance**: PII filtering
- **📈 Production Ready**: Multiple transports
- **🚀 Developer Friendly**: Beautiful console output 