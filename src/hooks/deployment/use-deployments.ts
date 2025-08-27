import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import { 
  UseDeploymentsReturn
} from '../../contracts/component-contracts'
import { 
  CreateDeploymentInput,
  UpdateDeploymentInput 
} from '../../contracts/service-contracts'
import { Deployment, DeploymentStatus } from '../../../types/database'
import { createClient } from '../../lib/supabase/client'
import { subscriptionManager } from '../../lib/supabase/subscription-manager'
import logger from '../../lib/logger/client'

// Create specialized logger for hooks
const hookLogger = logger.child({ component: 'DeploymentHooks' })

// Simple client-side auth check
const requireAuth = async () => {
  const supabase = createClient()
  return hookLogger.time('authCheck', async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      hookLogger.warn('Authentication required for deployment operation')
      throw new Error('Authentication required')
    }
    hookLogger.debug('User authenticated for deployment operation', { userId: user.id })
    return user
  })
}

// API client functions with optional impersonation headers
const apiClient = {
  async listDeployments(userId: string, headers: Record<string, string> = {}): Promise<Deployment[]> {
    const response = await fetch('/api/deployments', {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch deployments')
    }
    
    const result = await response.json()
    return result.data.data // Unwrap the paginated response
  },

  async createDeployment(input: CreateDeploymentInput, headers: Record<string, string> = {}): Promise<Deployment> {
    const response = await fetch('/api/deployments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(input),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to create deployment')
    }
    
    const result = await response.json()
    return result.data.deployment
  },

  async updateDeployment(id: string, data: UpdateDeploymentInput, headers: Record<string, string> = {}): Promise<Deployment> {
    const response = await fetch(`/api/deployments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      throw new Error('Failed to update deployment')
    }
    
    const result = await response.json()
    return result.data
  },

  async deleteDeployment(id: string, headers: Record<string, string> = {}): Promise<void> {
    const response = await fetch(`/api/deployments/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to delete deployment')
    }
  },

  async getUserActiveDeployments(userId: string, headers: Record<string, string> = {}): Promise<Deployment[]> {
    const response = await fetch(`/api/deployments?status=running,building,deploying`, {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch active deployments')
    }
    
    const result = await response.json()
    return result.data.data
  }
}

export function useDeployments(userId?: string): UseDeploymentsReturn {
  const queryClient = useQueryClient()
  const { isImpersonating, sessionToken, impersonatedUserId } = useImpersonation()
  const logger = hookLogger.child({ hook: 'useDeployments', userId })

  // Create impersonation headers if needed
  const getImpersonationHeaders = (): Record<string, string> => {
    if (isImpersonating && sessionToken && impersonatedUserId) {
      return {
        'X-Impersonation-Session': sessionToken,
        'X-Impersonated-User-Id': impersonatedUserId
      }
    }
    return {}
  }

  logger.debug('useDeployments hook initialized', { hasUserId: !!userId, isImpersonating })

  // Create cache-isolated query key that includes impersonation state
  const queryKey = isImpersonating 
    ? ['deployments', userId, 'impersonated', impersonatedUserId]
    : ['deployments', userId]

  // Get deployments query
  const {
    data: deployments = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const startTime = Date.now()
      let targetUserId = userId // Declare outside try block
      
      logger.info('Fetching deployments list')
      
      try {
        if (!targetUserId) {
          const user = await requireAuth()
          targetUserId = user.id
        }

        const result = await logger.time('fetchDeploymentsList', async () => {
          return await apiClient.listDeployments(targetUserId!, getImpersonationHeaders())
        }, { userId: targetUserId })

        logger.info('Deployments fetched successfully', { 
          count: result.length,
          duration: Date.now() - startTime,
          userId: targetUserId
        })

        return result
      } catch (error) {
        logger.error('Failed to fetch deployments', { 
          duration: Date.now() - startTime,
          userId: targetUserId 
        }, error as Error)
        throw error
      }
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  })

  // Log errors using useEffect instead of onError
  useEffect(() => {
    if (error) {
      logger.error('Deployments query failed', { userId }, error as Error)
    }
  }, [error, userId, logger])

  // Create deployment mutation
  const createDeploymentMutation = useMutation({
    mutationFn: async (data: CreateDeploymentInput) => {
      const startTime = Date.now()
      logger.info('Creating new deployment', { 
        deploymentName: data.deployment_name,
        environment: data.environment,
        hasUserId: !!data.user_id
      })

      try {
        if (!data.user_id) {
          const user = await requireAuth()
          data.user_id = user.id
        }

        const headers: Record<string, string> = {}
        if (isImpersonating && sessionToken && impersonatedUserId) {
          headers['X-Impersonation-Session'] = sessionToken
          headers['X-Impersonated-User-Id'] = impersonatedUserId
        }

        const result = await logger.time('createDeploymentMutation', async () => {
          return await apiClient.createDeployment(data, headers)
        }, { 
          deploymentName: data.deployment_name,
          userId: data.user_id,
          operation: 'create'
        })

        logger.info('Deployment created successfully', {
          deploymentId: result.id,
          deploymentName: result.deployment_name,
          status: result.status,
          duration: Date.now() - startTime,
          userId: data.user_id
        })

        return result
      } catch (error) {
        logger.error('Failed to create deployment', {
          deploymentName: data.deployment_name,
          duration: Date.now() - startTime,
          userId: data.user_id
        }, error as Error)
        throw error
      }
    },
    onSuccess: (newDeployment) => {
      logger.debug('Updating query cache after deployment creation', {
        deploymentId: newDeployment.id,
        userId: newDeployment.user_id
      })

      // Create the appropriate query key for cache update
      const cacheKey = isImpersonating 
        ? ['deployments', newDeployment.user_id, 'impersonated', impersonatedUserId]
        : ['deployments', newDeployment.user_id]

      // Add the new deployment to the cache
      queryClient.setQueryData(cacheKey, (old: Deployment[] = []) => [
        newDeployment,
        ...old
      ])
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['deployments'] })

      logger.info('Query cache updated after deployment creation', {
        deploymentId: newDeployment.id
      })
    },
    onError: (error) => {
      logger.error('Create deployment mutation failed', {}, error as Error)
    }
  })

  // Update deployment mutation
  const updateDeploymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDeploymentInput }) => {
      const startTime = Date.now()
      logger.info('Updating deployment', { 
        deploymentId: id,
        updateFields: Object.keys(data)
      })

      try {
        const headers: Record<string, string> = {}
        if (isImpersonating && sessionToken && impersonatedUserId) {
          headers['X-Impersonation-Session'] = sessionToken
          headers['X-Impersonated-User-Id'] = impersonatedUserId
        }

        const result = await logger.time('updateDeploymentMutation', async () => {
          return await apiClient.updateDeployment(id, data, headers)
        }, { 
          deploymentId: id,
          operation: 'update'
        })

        logger.info('Deployment updated successfully', {
          deploymentId: id,
          status: result.status,
          duration: Date.now() - startTime
        })

        return result
      } catch (error) {
        logger.error('Failed to update deployment', {
          deploymentId: id,
          duration: Date.now() - startTime
        }, error as Error)
        throw error
      }
    },
    onSuccess: (updatedDeployment) => {
      logger.debug('Updating query cache after deployment update', {
        deploymentId: updatedDeployment.id
      })

      // Create the appropriate query key for cache update
      const cacheKey = isImpersonating 
        ? ['deployments', updatedDeployment.user_id, 'impersonated', impersonatedUserId]
        : ['deployments', updatedDeployment.user_id]

      // Update the deployment in the cache
      queryClient.setQueryData(cacheKey, (old: Deployment[] = []) =>
        old.map(deployment => 
          deployment.id === updatedDeployment.id ? updatedDeployment : deployment
        )
      )
      // Also update individual deployment cache
      queryClient.setQueryData(['deployment', updatedDeployment.id], updatedDeployment)
    },
    onError: (error) => {
      logger.error('Update deployment mutation failed', {}, error as Error)
    }
  })

  // Delete deployment mutation
  const deleteDeploymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const startTime = Date.now()
      logger.info('Deleting deployment', { deploymentId: id })

      try {
        const headers: Record<string, string> = {}
        if (isImpersonating && sessionToken && impersonatedUserId) {
          headers['X-Impersonation-Session'] = sessionToken
          headers['X-Impersonated-User-Id'] = impersonatedUserId
        }

        await logger.time('deleteDeploymentMutation', async () => {
          await apiClient.deleteDeployment(id, headers)
        }, { 
          deploymentId: id,
          operation: 'delete'
        })

        logger.info('Deployment deleted successfully', {
          deploymentId: id,
          duration: Date.now() - startTime
        })

        return id
      } catch (error) {
        logger.error('Failed to delete deployment', {
          deploymentId: id,
          duration: Date.now() - startTime
        }, error as Error)
        throw error
      }
    },
    onSuccess: (deletedId) => {
      logger.debug('Cleaning up query cache after deployment deletion', {
        deploymentId: deletedId
      })

      // Create the appropriate query key for cache update
      const cacheKey = isImpersonating 
        ? ['deployments', userId, 'impersonated', impersonatedUserId]
        : ['deployments', userId]

      // Remove the deployment from all relevant caches
      queryClient.setQueryData(cacheKey, (old: Deployment[] = []) =>
        old.filter(deployment => deployment.id !== deletedId)
      )
      queryClient.removeQueries({ queryKey: ['deployment', deletedId] })
      queryClient.removeQueries({ queryKey: ['deployment-logs', deletedId] })
      queryClient.removeQueries({ queryKey: ['health-checks', deletedId] })

      logger.info('Query cache cleaned up after deployment deletion', {
        deploymentId: deletedId
      })
    },
    onError: (error) => {
      logger.error('Delete deployment mutation failed', {}, error as Error)
    }
  })

  // Set up real-time subscriptions
  // TODO: Implement subscription deduplication to prevent multiple channels for same data
  // Currently each component instance creates its own subscription
  useEffect(() => {
    const effectiveUserId = isImpersonating && impersonatedUserId ? impersonatedUserId : userId
    
    if (!effectiveUserId) {
      logger.debug('Skipping real-time subscription setup - no effective userId')
      return
    }

    // Create impersonation-aware channel name to prevent data mixing
    const channelName = isImpersonating 
      ? `deployments-${effectiveUserId}-impersonated-${userId}`
      : `deployments-${effectiveUserId}`

    logger.info('Setting up real-time subscription for deployments', { 
      effectiveUserId, 
      isImpersonating,
      channelName 
    })

    let cleanup: (() => void) | undefined

    // Handle async subscription setup
    subscriptionManager.subscribeToPostgresChanges(
      channelName,
      {
        event: '*',
        schema: 'auth_logic',
        table: 'deployments',
        filter: `user_id=eq.${effectiveUserId}`
      },
      (payload: any) => {
        logger.debug('Received real-time deployment change', { 
          event: payload.eventType,
          deploymentId: payload.new?.id || payload.old?.id,
          effectiveUserId,
          isImpersonating
        })

        // Create the appropriate query key for cache update
        const cacheKey = isImpersonating 
          ? ['deployments', effectiveUserId, 'impersonated', impersonatedUserId]
          : ['deployments', effectiveUserId]
        
        switch (payload.eventType) {
          case 'INSERT':
            logger.info('Real-time: New deployment created', { 
              deploymentId: payload.new.id,
              deploymentName: payload.new.deployment_name
            })
            queryClient.setQueryData(cacheKey, (old: Deployment[] = []) => [
              payload.new as Deployment,
              ...old
            ])
            break
          
          case 'UPDATE':
            logger.info('Real-time: Deployment updated', { 
              deploymentId: payload.new.id,
              status: payload.new.status
            })
            queryClient.setQueryData(cacheKey, (old: Deployment[] = []) =>
              old.map(deployment => 
                deployment.id === payload.new.id ? payload.new as Deployment : deployment
              )
            )
            // Also update individual deployment cache
            queryClient.setQueryData(['deployment', payload.new.id], payload.new as Deployment)
            break
          
          case 'DELETE':
            logger.info('Real-time: Deployment deleted', { 
              deploymentId: payload.old.id
            })
            queryClient.setQueryData(cacheKey, (old: Deployment[] = []) =>
              old.filter(deployment => deployment.id !== payload.old.id)
            )
            queryClient.removeQueries({ queryKey: ['deployment', payload.old.id] })
            break
        }
      }
    ).then((cleanupFn) => {
      cleanup = cleanupFn
      logger.debug('Real-time subscription established', { userId })
    }).catch((error) => {
      logger.error('Failed to establish real-time subscription', { error })
    })

    return () => {
      if (cleanup) {
        logger.debug('Cleaning up real-time subscription', { effectiveUserId, isImpersonating })
        cleanup()
      }
    }
  }, [userId, impersonatedUserId, isImpersonating, queryClient, logger])

  return {
    deployments,
    isLoading,
    error: error as Error | null,
    refetch,
    createDeployment: createDeploymentMutation.mutateAsync,
    updateDeployment: async (id: string, data: UpdateDeploymentInput) => 
      updateDeploymentMutation.mutateAsync({ id, data }),
    deleteDeployment: async (id: string) => {
      await deleteDeploymentMutation.mutateAsync(id)
    },
  }
}

// Hook for getting active deployments only
export function useActiveDeployments(userId?: string) {
  const { isImpersonating, sessionToken, impersonatedUserId } = useImpersonation()
  const logger = hookLogger.child({ hook: 'useActiveDeployments', userId })
  
  // Create impersonation headers if needed
  const getImpersonationHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {}
    if (isImpersonating && sessionToken && impersonatedUserId) {
      headers['X-Impersonation-Session'] = sessionToken
      headers['X-Impersonated-User-Id'] = impersonatedUserId
    }
    return headers
  }
  
  logger.debug('useActiveDeployments hook initialized', { hasUserId: !!userId, isImpersonating })

  // Create cache-isolated query key that includes impersonation state
  const activeQueryKey = isImpersonating 
    ? ['active-deployments', userId, 'impersonated', impersonatedUserId]
    : ['active-deployments', userId]

  return useQuery({
    queryKey: activeQueryKey,
    queryFn: async () => {
      const startTime = Date.now()
      let targetUserId = userId
      
      logger.info('Fetching active deployments')

      try {
        if (!targetUserId) {
          const user = await requireAuth()
          targetUserId = user.id
        }

        const result = await logger.time('fetchActiveDeployments', async () => {
          return await apiClient.getUserActiveDeployments(targetUserId!, getImpersonationHeaders())
        }, { userId: targetUserId })

        logger.info('Active deployments fetched successfully', {
          count: result.length,
          duration: Date.now() - startTime,
          userId: targetUserId
        })

        return result
      } catch (error) {
        logger.error('Failed to fetch active deployments', {
          duration: Date.now() - startTime,
          userId: targetUserId
        }, error as Error)
        throw error
      }
    },
    enabled: !!userId,
    refetchInterval: 10000, // More frequent updates for active deployments
    staleTime: 5000,
  })
}

// Hook for deployment statistics
export function useDeploymentStats(userId?: string) {
  const { isImpersonating, sessionToken, impersonatedUserId } = useImpersonation()
  const logger = hookLogger.child({ hook: 'useDeploymentStats', userId })
  
  // Create impersonation headers if needed
  const getImpersonationHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {}
    if (isImpersonating && sessionToken && impersonatedUserId) {
      headers['X-Impersonation-Session'] = sessionToken
      headers['X-Impersonated-User-Id'] = impersonatedUserId
    }
    return headers
  }
  
  logger.debug('useDeploymentStats hook initialized', { hasUserId: !!userId, isImpersonating })

  // Create cache-isolated query key that includes impersonation state
  const statsQueryKey = isImpersonating 
    ? ['deployment-stats', userId, 'impersonated', impersonatedUserId]
    : ['deployment-stats', userId]

  return useQuery({
    queryKey: statsQueryKey,
    queryFn: async () => {
      const startTime = Date.now()
      let targetUserId = userId // Declare at function level for error handling
      
      logger.info('Fetching deployment statistics')

      try {
        if (!targetUserId) {
          const user = await requireAuth()
          targetUserId = user.id
        }

        const deployments = await logger.time('fetchDeploymentsForStats', async () => {
          return await apiClient.listDeployments(targetUserId!, getImpersonationHeaders())
        }, { userId: targetUserId })

        // Calculate statistics
        const stats = {
          total: deployments.length,
          active: deployments.filter(d => ['running', 'building', 'deploying'].includes(d.status || '')).length,
          failed: deployments.filter(d => d.status === 'failed').length,
          healthy: deployments.filter(d => d.health_status === 'healthy').length,
          byStatus: deployments.reduce((acc, d) => {
            const status = d.status || 'unknown'
            acc[status] = (acc[status] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }

        logger.info('Deployment statistics calculated', {
          ...stats,
          duration: Date.now() - startTime,
          userId: targetUserId
        })

        return stats
      } catch (error) {
        logger.error('Failed to fetch deployment statistics', {
          duration: Date.now() - startTime,
          userId: targetUserId
        }, error as Error)
        throw error
      }
    },
    enabled: !!userId,
    staleTime: 30000, // Stats can be a bit staler
  })
}
