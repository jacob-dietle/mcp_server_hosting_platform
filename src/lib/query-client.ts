import { QueryClient } from '@tanstack/react-query'
import type { Deployment } from '../../types/database'

// Create a query client with optimized defaults for deployment management
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time - how long data is considered fresh
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Cache time - how long data stays in cache after becoming unused
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      
      // Retry configuration
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (except 429)
        if (error?.statusCode >= 400 && error?.statusCode < 500 && error?.statusCode !== 429) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus for critical data
      refetchOnWindowFocus: true,
      
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once on network errors
      retry: (failureCount, error: any) => {
        if (error?.name === 'NetworkError' && failureCount < 1) {
          return true
        }
        return false
      },
      
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
})

// Query keys factory for consistent key management
export const queryKeys = {
  // Deployment keys
  deployments: (userId?: string) => ['deployments', userId] as const,
  deployment: (id: string) => ['deployment', id] as const,
  deploymentLogs: (id: string) => ['deployment-logs', id] as const,
  activeDeployments: (userId?: string) => ['active-deployments', userId] as const,
  deploymentStats: (userId?: string) => ['deployment-stats', userId] as const,
  
  // Health check keys
  healthChecks: (deploymentId: string) => ['health-checks', deploymentId] as const,
  healthStats: (deploymentId: string, timeRange?: string) => ['health-stats', deploymentId, timeRange] as const,
  
  // Railway keys
  railwayProjects: () => ['railway-projects'] as const,
  railwayProject: (id: string) => ['railway-project', id] as const,
  railwayServices: (projectId: string) => ['railway-services', projectId] as const,
  
  // Analytics keys
  analytics: (type: string, params?: any) => ['analytics', type, params] as const,
  
  // Admin keys
  admin: {
    users: (params?: any) => ['admin', 'users', params] as const,
    user: (id: string) => ['admin', 'user', id] as const,
    trials: (params?: any) => ['admin', 'trials', params] as const,
    trial: (id: string) => ['admin', 'trial', id] as const,
    funnel: (params?: any) => ['admin', 'funnel', params] as const,
    stats: (type: string) => ['admin', 'stats', type] as const,
  },
} as const

// Invalidation utilities
export const invalidateDeploymentData = (deploymentId?: string) => {
  if (deploymentId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.deployment(deploymentId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.deploymentLogs(deploymentId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.healthChecks(deploymentId) })
  }
  // Use partial-key matching so all user-specific variants are covered
  queryClient.invalidateQueries({ queryKey: ['deployments'], exact: false })
  queryClient.invalidateQueries({ queryKey: ['active-deployments'], exact: false })
  queryClient.invalidateQueries({ queryKey: ['deployment-stats'], exact: false })
}

// Clear all deployment-related cache
export const clearDeploymentCache = () => {
  queryClient.removeQueries({ queryKey: ['deployments'] })
  queryClient.removeQueries({ queryKey: ['deployment'] })
  queryClient.removeQueries({ queryKey: ['deployment-logs'] })
  queryClient.removeQueries({ queryKey: ['health-checks'] })
  queryClient.removeQueries({ queryKey: ['active-deployments'] })
  queryClient.removeQueries({ queryKey: ['deployment-stats'] })
}
