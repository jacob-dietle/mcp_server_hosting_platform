import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback, useMemo } from 'react'
import { useImpersonationAwareFetch } from '../core'
import logger from '@/lib/logger/client'

// Create specialized logger for MCP server hooks
const hookLogger = logger.child({ component: 'MCPServerHooks' })

interface MCPServerRecord {
  id: string
  user_id: string
  name: string
  config: {
    url: string
    transportType: 'sse' | 'streamable-http'
  }
  created_at: string
  updated_at: string
}

interface CreateMCPServerInput {
  name: string
  config: {
    url: string
    transportType: 'sse' | 'streamable-http'
  }
}

interface UseMCPServersReturn {
  servers: MCPServerRecord[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
  createServer: (data: CreateMCPServerInput) => Promise<MCPServerRecord>
  deleteServer: (serverName: string) => Promise<void>
}

interface UseMCPServersOptions {
  impersonatedUserId?: string
}

// Simple client-side auth check
const requireAuth = async () => {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  return hookLogger.time('authCheck', async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      hookLogger.warn('Authentication required for MCP server operation')
      throw new Error('Authentication required')
    }
    hookLogger.debug('User authenticated for MCP server operation', { userId: user.id })
    return user
  })
}

// Type for custom fetch function
type CustomFetch = (url: string, options?: RequestInit) => Promise<Response>;

// API client functions with custom fetch support
const apiClient = {
  async listServers(userId: string, customFetch?: CustomFetch): Promise<MCPServerRecord[]> {
    const fetchFn = customFetch || fetch;
    const response = await fetchFn('/api/mcp-servers', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch MCP servers')
    }
    
    const result = await response.json()
    return result.data
  },

  async createServer(input: CreateMCPServerInput, customFetch?: CustomFetch): Promise<MCPServerRecord> {
    const fetchFn = customFetch || fetch;
    const response = await fetchFn('/api/mcp-servers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to create MCP server')
    }
    
    const result = await response.json()
    return result.data
  },

  async deleteServer(serverName: string, customFetch?: CustomFetch): Promise<void> {
    const fetchFn = customFetch || fetch;
    const response = await fetchFn(`/api/mcp-servers?name=${encodeURIComponent(serverName)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to delete MCP server')
    }
  }
}

export function useMCPServers(userId?: string, options?: UseMCPServersOptions): UseMCPServersReturn {
  const queryClient = useQueryClient()
  const impersonationAwareFetch = useImpersonationAwareFetch()
  
  // Memoize the logger to prevent recreation on every render
  const mcpLogger = useMemo(() => 
    hookLogger.child({ hook: 'useMCPServers', userId }),
    [userId]
  )

  // Cache isolation for impersonation
  const effectiveUserId = options?.impersonatedUserId || userId;
  const queryKey = useMemo(() => 
    options?.impersonatedUserId 
      ? ['mcp-servers', userId, 'impersonated', options.impersonatedUserId]
      : ['mcp-servers', userId],
    [options?.impersonatedUserId, userId]
  );

  // Remove the debug log that was causing performance issues
  // Log only when there's an actual state change or error

  // Memoize the query function to prevent recreation
  const queryFn = useCallback(async () => {
    const startTime = Date.now()
    let targetUserId = effectiveUserId
    
    mcpLogger.info('Fetching MCP servers list')
    
    try {
      if (!targetUserId) {
        const user = await requireAuth()
        targetUserId = user.id
      }

      const result = await mcpLogger.time('fetchMCPServersList', async () => {
        return await apiClient.listServers(targetUserId!, impersonationAwareFetch)
      }, { userId: targetUserId })

      mcpLogger.info('MCP servers fetched successfully', { 
        count: result.length,
        duration: Date.now() - startTime,
        userId: targetUserId,
        isImpersonating: !!options?.impersonatedUserId
      })

      return result
    } catch (error) {
      mcpLogger.error('Failed to fetch MCP servers', { 
        duration: Date.now() - startTime,
        userId: targetUserId,
        isImpersonating: !!options?.impersonatedUserId
      }, error as Error)
      throw error
    }
  }, [effectiveUserId, impersonationAwareFetch, options?.impersonatedUserId, mcpLogger])

  // Get MCP servers query
  const {
    data: servers = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn,
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  })

  // Log errors using useEffect - removed logger from dependencies to prevent infinite loop
  useEffect(() => {
    if (error) {
      mcpLogger.error('MCP servers query failed', { 
        userId, 
        isImpersonating: !!options?.impersonatedUserId 
      }, error as Error)
    }
  }, [error, userId, options?.impersonatedUserId]) // Removed mcpLogger from dependencies

  // Create MCP server mutation
  const createServerMutation = useMutation({
    mutationFn: useCallback(async (data: CreateMCPServerInput) => {
      const startTime = Date.now()
      mcpLogger.info('Creating new MCP server', { 
        serverName: data.name,
        transportType: data.config.transportType
      })

      try {
        const result = await mcpLogger.time('createMCPServerMutation', async () => {
          return await apiClient.createServer(data, impersonationAwareFetch)
        }, { 
          serverName: data.name,
          operation: 'create'
        })

        mcpLogger.info('MCP server created successfully', {
          serverId: result.id,
          serverName: result.name,
          duration: Date.now() - startTime,
          isImpersonating: !!options?.impersonatedUserId
        })

        return result
      } catch (error) {
        mcpLogger.error('Failed to create MCP server', {
          serverName: data.name,
          duration: Date.now() - startTime,
          isImpersonating: !!options?.impersonatedUserId
        }, error as Error)
        throw error
      }
    }, [impersonationAwareFetch, options?.impersonatedUserId, mcpLogger]),
    onSuccess: useCallback((newServer: MCPServerRecord) => {
      mcpLogger.debug('Updating query cache after MCP server creation', {
        serverId: newServer.id,
        userId: newServer.user_id
      })

      // Add the new server to the cache using the same query key
      queryClient.setQueryData(queryKey, (old: MCPServerRecord[] = []) => [
        newServer,
        ...old
      ])
      // Invalidate only the specific query to ensure fresh data
      queryClient.invalidateQueries({ queryKey })

      mcpLogger.info('Query cache updated after MCP server creation', {
        serverId: newServer.id
      })
    }, [queryClient, queryKey, mcpLogger]),
    onError: useCallback((error: Error) => {
      mcpLogger.error('Create MCP server mutation failed', {}, error)
    }, [mcpLogger])
  })

  // Delete MCP server mutation
  const deleteServerMutation = useMutation({
    mutationFn: useCallback(async (serverName: string) => {
      const startTime = Date.now()
      mcpLogger.info('Deleting MCP server', { serverName })

      try {
        await mcpLogger.time('deleteMCPServerMutation', async () => {
          await apiClient.deleteServer(serverName, impersonationAwareFetch)
        }, { 
          serverName,
          operation: 'delete'
        })

        mcpLogger.info('MCP server deleted successfully', {
          serverName,
          duration: Date.now() - startTime,
          isImpersonating: !!options?.impersonatedUserId
        })

        // Don't return serverName - return void to match interface
      } catch (error) {
        mcpLogger.error('Failed to delete MCP server', {
          serverName,
          duration: Date.now() - startTime,
          isImpersonating: !!options?.impersonatedUserId
        }, error as Error)
        throw error
      }
    }, [impersonationAwareFetch, options?.impersonatedUserId, mcpLogger]),
    onSuccess: useCallback(() => {
      // Since we don't return the serverName anymore, we'll invalidate the query
      // to ensure the cache is refreshed with the latest data
      queryClient.invalidateQueries({ queryKey })

      mcpLogger.info('Query cache invalidated after MCP server deletion')
    }, [queryClient, queryKey, mcpLogger]),
    onError: useCallback((error: Error) => {
      mcpLogger.error('Delete MCP server mutation failed', {}, error)
    }, [mcpLogger])
  })

  // Memoize the return object to prevent recreation
  return useMemo(() => ({
    servers,
    isLoading,
    error: error as Error | null,
    refetch,
    createServer: createServerMutation.mutateAsync,
    deleteServer: deleteServerMutation.mutateAsync,
  }), [servers, isLoading, error, refetch, createServerMutation.mutateAsync, deleteServerMutation.mutateAsync])
} 
