import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { UseDeploymentLogsReturn } from '@/contracts/component-contracts'
import { DeploymentLog } from '../../../types/database'
import { createClient } from '@/lib/supabase/client'
import { subscriptionManager } from '@/lib/supabase/subscription-manager'
import { Deployment } from '../../../types/database'

// API client functions
const apiClient = {
  async getDeploymentLogs(deploymentId: string, limit: number = 100): Promise<DeploymentLog[]> {
    const response = await fetch(`/api/deployments/${deploymentId}/logs?limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch deployment logs')
    }
    
    const result = await response.json()
    return result.data
  },

  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    const response = await fetch(`/api/deployments/${deploymentId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (response.status === 404) {
      return null
    }
    
    if (!response.ok) {
      throw new Error('Failed to fetch deployment')
    }
    
    const result = await response.json()
    return result.data
  }
}

export function useDeploymentLogs(deploymentId: string): UseDeploymentLogsReturn {
  const queryClient = useQueryClient()
  const [isStreaming, setIsStreaming] = useState(false)

  // Get deployment logs query
  const {
    data: logs = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['deployment-logs', deploymentId],
    queryFn: () => apiClient.getDeploymentLogs(deploymentId, 500),
    enabled: !!deploymentId,
    refetchInterval: isStreaming ? 2000 : 30000, // More frequent when streaming
    staleTime: isStreaming ? 1000 : 10000,
  })

  // Start streaming function
  const startStreaming = useCallback(() => {
    setIsStreaming(true)
  }, [])

  // Stop streaming function
  const stopStreaming = useCallback(() => {
    setIsStreaming(false)
  }, [])

  // Clear logs function (client-side only)
  const clearLogs = useCallback(() => {
    queryClient.setQueryData(['deployment-logs', deploymentId], [])
  }, [deploymentId, queryClient])

  // Set up real-time subscription for logs
  useEffect(() => {
    if (!deploymentId || !isStreaming) return

    console.log(`Starting log streaming for deployment: ${deploymentId}`)

    const channelName = `streaming-logs-${deploymentId}`
    let cleanup: (() => void) | undefined

    subscriptionManager.subscribeToPostgresChanges(
      channelName,
      {
        event: 'INSERT',
        schema: 'auth_logic',
        table: 'deployment_logs',
        filter: `deployment_id=eq.${deploymentId}`
      },
      (payload: any) => {
        console.log('New log received:', payload.new)
        
        // Add the new log to the cache
        queryClient.setQueryData(['deployment-logs', deploymentId], (old: DeploymentLog[] = []) => {
          // Prevent duplicates by checking if log already exists
          const exists = old.some(log => log.id === payload.new.id)
          if (exists) return old
          
          return [payload.new as DeploymentLog, ...old]
        })
      }
    ).then((cleanupFn) => {
      cleanup = cleanupFn
      console.log('Log subscription established')
    }).catch((error) => {
      console.error('Failed to subscribe to logs:', error)
    })

    return () => {
      console.log(`Stopping log streaming for deployment: ${deploymentId}`)
      if (cleanup) {
        cleanup()
      }
    }
  }, [deploymentId, isStreaming, queryClient])

  // Auto-start streaming for active deployments
  useEffect(() => {
    if (!deploymentId) return

    // Get deployment status to determine if we should auto-stream
    const checkDeploymentStatus = async () => {
      try {
        const deployment = await apiClient.getDeployment(deploymentId)
        if (deployment && ['pending', 'validating', 'deploying', 'building'].includes(deployment.status || '')) {
          startStreaming()
        }
      } catch (error) {
        console.error('Failed to check deployment status for auto-streaming:', error)
      }
    }

    checkDeploymentStatus()
  }, [deploymentId, startStreaming])

  return {
    logs,
    isLoading,
    isStreaming,
    error: error as Error | null,
    startStreaming,
    stopStreaming,
    clearLogs,
  }
}

// Hook for filtered logs
export function useFilteredDeploymentLogs(
  deploymentId: string, 
  filters: {
    level?: string
    search?: string
    since?: Date
  } = {}
) {
  const { logs, isLoading, error, isStreaming, startStreaming, stopStreaming } = useDeploymentLogs(deploymentId)

  const filteredLogs = logs.filter(log => {
    // Filter by log level
    if (filters.level && log.log_level !== filters.level) {
      return false
    }

    // Filter by search term
    if (filters.search && !log.message.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }

    // Filter by date
    if (filters.since && log.created_at) {
      const logDate = new Date(log.created_at)
      if (logDate < filters.since) {
        return false
      }
    }

    return true
  })

  return {
    logs: filteredLogs,
    allLogs: logs,
    isLoading,
    error,
    isStreaming,
    startStreaming,
    stopStreaming,
  }
}

// Hook for log statistics
export function useDeploymentLogStats(deploymentId: string) {
  const { logs, isLoading } = useDeploymentLogs(deploymentId)

  const stats = {
    total: logs.length,
    byLevel: logs.reduce((acc, log) => {
      acc[log.log_level] = (acc[log.log_level] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    recent: logs.filter(log => {
      if (!log.created_at) return false
      const logTime = new Date(log.created_at).getTime()
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
      return logTime > fiveMinutesAgo
    }).length,
    errors: logs.filter(log => log.log_level === 'error').length,
    warnings: logs.filter(log => log.log_level === 'warn').length,
  }

  return {
    stats,
    isLoading,
  }
}
