import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UseHealthChecksReturn } from '../../contracts/component-contracts'
import { HealthCheck, HealthStatus } from '../../../types/database'
import { subscriptionManager } from '../../lib/supabase/subscription-manager'
import { Deployment } from '../../../types/database'

// API client functions
const apiClient = {
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
  },

  async recordHealthCheck(deploymentId: string, check: Omit<HealthCheck, 'id' | 'deployment_id' | 'checked_at'>): Promise<HealthCheck> {
    const response = await fetch(`/api/deployments/${deploymentId}/health`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(check),
    })
    
    if (!response.ok) {
      throw new Error('Failed to record health check')
    }
    
    const result = await response.json()
    return result.data
  }
}

export function useHealthChecks(deploymentId: string): UseHealthChecksReturn {
  const queryClient = useQueryClient()

  // Get health checks query
  const {
    data: checks = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['health-checks', deploymentId],
    queryFn: async () => {
      // Get health checks via API (avoids schema issues)
      const response = await fetch(`/api/deployments/${deploymentId}/health?limit=50`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch health checks')
      }
      
      const result = await response.json()
      return result.data?.data || []
    },
    enabled: !!deploymentId,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000,
  })

  // Get latest health check
  const latestCheck = checks.length > 0 ? checks[0] : null

  // Perform health check mutation
  const performCheckMutation = useMutation({
    mutationFn: async (): Promise<HealthCheck> => {
      // Use backend API to perform health check (avoids CORS issues)
      const response = await fetch(`/api/deployments/${deploymentId}/health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to perform health check via backend API')
      }
      
      const result = await response.json()
      return result.data
    },
    onSuccess: async (newCheck) => {
      // Add the new health check to the cache
      queryClient.setQueryData(['health-checks', deploymentId], (old: HealthCheck[] = []) => [
        newCheck,
        ...old.slice(0, 49) // Keep only the most recent 50 checks
      ])
      
      // Invalidate deployment cache to update health status
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] })
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
      
      // Force refetch after a short delay to ensure backend has updated
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] })
        queryClient.invalidateQueries({ queryKey: ['deployments'] })
      }, 1000)
    },
    onError: (error) => {
      console.error('Failed to perform health check:', error)
    }
  })

  // Set up real-time subscription for health checks
  useEffect(() => {
    if (!deploymentId) return

    const channelName = `health-checks-${deploymentId}`
    let cleanup: (() => void) | undefined

    subscriptionManager.subscribeToPostgresChanges(
      channelName,
      {
        event: 'INSERT',
        schema: 'auth_logic',
        table: 'health_checks',
        filter: `deployment_id=eq.${deploymentId}`
      },
      (payload: any) => {
        console.log('New health check:', payload)
        
        // Add the new health check to the cache
        queryClient.setQueryData(['health-checks', deploymentId], (old: HealthCheck[] = []) => {
          // Prevent duplicates
          const exists = old.some(check => check.id === payload.new.id)
          if (exists) return old
          
          return [payload.new as HealthCheck, ...old.slice(0, 49)]
        })
      }
    ).then((cleanupFn) => {
      cleanup = cleanupFn
    }).catch((error) => {
      console.error('Failed to subscribe to health checks:', error)
    })

    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, [deploymentId, queryClient])

  return {
    checks,
    latestCheck,
    isLoading,
    error: error as Error | null,
    performCheck: performCheckMutation.mutateAsync,
    isPerformingCheck: performCheckMutation.isPending,
    refetch,
  }
}

// Hook for health check statistics
export function useHealthCheckStats(deploymentId: string, timeRange: '1h' | '6h' | '24h' | '7d' = '24h') {
  const { checks, isLoading } = useHealthChecks(deploymentId)

  const timeRangeMs = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  }

  const cutoffTime = Date.now() - timeRangeMs[timeRange]
  
  const recentChecks = checks.filter(check => {
    if (!check.checked_at) return false
    return new Date(check.checked_at).getTime() > cutoffTime
  })

  const stats = {
    total: recentChecks.length,
    healthy: recentChecks.filter(check => check.status === 'healthy').length,
    unhealthy: recentChecks.filter(check => check.status === 'unhealthy').length,
    degraded: recentChecks.filter(check => check.status === 'degraded').length,
    unknown: recentChecks.filter(check => check.status === 'unknown').length,
    averageResponseTime: recentChecks.length > 0 
      ? Math.round(recentChecks.reduce((sum, check) => sum + (check.response_time_ms || 0), 0) / recentChecks.length)
      : 0,
    uptime: recentChecks.length > 0 
      ? Math.round((recentChecks.filter(check => check.status === 'healthy').length / recentChecks.length) * 100)
      : 0,
    timeRange,
  }

  return {
    stats,
    recentChecks,
    isLoading,
  }
}

// Hook for automated health checking
export function useAutomatedHealthChecks(deploymentId: string, intervalMinutes: number = 5) {
  const { performCheck } = useHealthChecks(deploymentId)

  useEffect(() => {
    if (!deploymentId || intervalMinutes <= 0) return

    // Perform initial health check
    performCheck().catch(error => {
      console.error('Initial health check failed:', error)
    })

    // Set up interval for automated checks
    const interval = setInterval(() => {
      performCheck().catch(error => {
        console.error('Automated health check failed:', error)
      })
    }, intervalMinutes * 60 * 1000)

    return () => {
      clearInterval(interval)
    }
  }, [deploymentId, intervalMinutes, performCheck])
}
