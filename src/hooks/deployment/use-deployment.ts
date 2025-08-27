import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { 
  UseDeploymentReturn 
} from '../../contracts/component-contracts'
import { DeploymentStatus, DeploymentLog } from '../../../types/database'
import { createClient } from '../../lib/supabase/client'
import { subscriptionManager } from '../../lib/supabase/subscription-manager'
import { DeploymentWithLogs } from '../../contracts/service-contracts'

// API client functions
const apiClient = {
  async getDeploymentWithLogs(deploymentId: string): Promise<DeploymentWithLogs | null> {
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

  async updateDeploymentStatus(deploymentId: string, status: DeploymentStatus): Promise<void> {
    const response = await fetch(`/api/deployments/${deploymentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to update deployment status')
    }
  },

  async addDeploymentLog(deploymentId: string, log: Omit<DeploymentLog, 'id' | 'deployment_id' | 'created_at'>): Promise<DeploymentLog> {
    const response = await fetch(`/api/deployments/${deploymentId}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(log),
    })
    
    if (!response.ok) {
      throw new Error('Failed to add deployment log')
    }
    
    const result = await response.json()
    return result.data
  }
}

export function useDeployment(deploymentId: string): UseDeploymentReturn {
  const queryClient = useQueryClient()

  // Get deployment with logs query
  const {
    data: deployment = null,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['deployment', deploymentId],
    queryFn: () => apiClient.getDeploymentWithLogs(deploymentId),
    enabled: !!deploymentId,
    refetchInterval: 15000, // Refetch every 15 seconds
    staleTime: 5000,
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: DeploymentStatus) => {
      await apiClient.updateDeploymentStatus(deploymentId, status)
    },
    onSuccess: () => {
      // Invalidate and refetch deployment data
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] })
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
    },
    onError: (error) => {
      console.error('Failed to update deployment status:', error)
    }
  })

  // Add log mutation
  const addLogMutation = useMutation({
    mutationFn: async (log: Omit<DeploymentLog, 'id' | 'deployment_id' | 'created_at'>) => {
      return apiClient.addDeploymentLog(deploymentId, log)
    },
    onSuccess: (newLog) => {
      // Add the new log to the deployment cache
      queryClient.setQueryData(['deployment', deploymentId], (old: any) => {
        if (!old) return old
        return {
          ...old,
          logs: [newLog, ...(old.logs || [])]
        }
      })
      // Also invalidate logs cache
      queryClient.invalidateQueries({ queryKey: ['deployment-logs', deploymentId] })
    },
    onError: (error) => {
      console.error('Failed to add deployment log:', error)
    }
  })

  // Set up real-time subscriptions for deployment updates
  useEffect(() => {
    if (!deploymentId) return

    const cleanups: Array<(() => void) | undefined> = []

    // Deployment updates subscription
    const deploymentChannelName = `deployment-${deploymentId}`
    subscriptionManager.subscribeToPostgresChanges(
      deploymentChannelName,
      {
        event: 'UPDATE',
        schema: 'auth_logic',
        table: 'deployments',
        filter: `id=eq.${deploymentId}`
      },
      (payload: any) => {
        console.log('Deployment updated:', payload)
        // Update the deployment in cache
        queryClient.setQueryData(['deployment', deploymentId], (old: any) => {
          if (!old) return old
          return {
            ...old,
            ...payload.new,
          }
        })
      }
    ).then((cleanup) => {
      cleanups[0] = cleanup
    }).catch((error) => {
      console.error('Failed to subscribe to deployment updates:', error)
    })

    // Logs subscription
    const logsChannelName = `deployment-logs-${deploymentId}`
    subscriptionManager.subscribeToPostgresChanges(
      logsChannelName,
      {
        event: 'INSERT',
        schema: 'auth_logic',
        table: 'deployment_logs',
        filter: `deployment_id=eq.${deploymentId}`
      },
      (payload: any) => {
        console.log('New deployment log:', payload)
        // Add the new log to the deployment cache
        queryClient.setQueryData(['deployment', deploymentId], (old: any) => {
          if (!old) return old
          return {
            ...old,
            logs: [payload.new as DeploymentLog, ...(old.logs || [])]
          }
        })
        // Also update logs cache
        queryClient.setQueryData(['deployment-logs', deploymentId], (old: DeploymentLog[] = []) => [
          payload.new as DeploymentLog,
          ...old
        ])
      }
    ).then((cleanup) => {
      cleanups[1] = cleanup
    }).catch((error) => {
      console.error('Failed to subscribe to deployment logs:', error)
    })

    // Health checks subscription
    const healthChannelName = `deployment-health-${deploymentId}`
    subscriptionManager.subscribeToPostgresChanges(
      healthChannelName,
      {
        event: 'INSERT',
        schema: 'auth_logic',
        table: 'health_checks',
        filter: `deployment_id=eq.${deploymentId}`
      },
      (payload: any) => {
        console.log('New health check:', payload)
        // Add the new health check to the deployment cache
        queryClient.setQueryData(['deployment', deploymentId], (old: any) => {
          if (!old) return old
          return {
            ...old,
            health_checks: [payload.new, ...(old.health_checks || [])]
          }
        })
        // Also update health checks cache
        queryClient.setQueryData(['health-checks', deploymentId], (old: any[] = []) => [
          payload.new,
          ...old
        ])
      }
    ).then((cleanup) => {
      cleanups[2] = cleanup
    }).catch((error) => {
      console.error('Failed to subscribe to health checks:', error)
    })

    return () => {
      cleanups.forEach(cleanup => cleanup?.())
    }
  }, [deploymentId, queryClient])

  return {
    deployment,
    isLoading,
    error: error as Error | null,
    refetch,
    updateStatus: updateStatusMutation.mutateAsync,
    addLog: addLogMutation.mutateAsync,
  }
}
