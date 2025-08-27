'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { 
  ListAdminUsersResponse,
  AdminUserSummary,
  GetAdminUserDetailResponse 
} from '@/contracts/api-contracts'

// Query key factory for admin users
export const adminUserKeys = {
  all: ['admin', 'users'] as const,
  lists: () => [...adminUserKeys.all, 'list'] as const,
  list: (params: AdminUsersQueryParams) => [...adminUserKeys.lists(), params] as const,
  details: () => [...adminUserKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminUserKeys.details(), id] as const,
}

export interface AdminUsersQueryParams {
  limit?: number
  offset?: number
  role?: 'user' | 'admin' | 'super_admin'
  signup_date_from?: string
  signup_date_to?: string
  activity_level?: 'active' | 'inactive' | 'new'
  search?: string
  funnel_stage?: 'signup' | 'trial_applied' | 'trial_active' | 'deployed' | 'converted'
  sort_by?: 'email' | 'role' | 'signup_date' | 'last_login' | 'mcp_servers' | 'deployments'
  sort_order?: 'asc' | 'desc'
}

export interface AdminUsersQueryResult {
  users: AdminUserSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  // Note: API doesn't return filters separately, they're calculated from the data
}

// Hook for fetching paginated admin users list
export function useAdminUsers(params: AdminUsersQueryParams = {}) {
  return useQuery({
    queryKey: adminUserKeys.list(params),
    queryFn: async (): Promise<AdminUsersQueryResult> => {
      const searchParams = new URLSearchParams()
      
      // Add all non-undefined params to search
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value))
        }
      })

      const response = await fetch(`/api/admin/users?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions for user management')
        }
        throw new Error(`Failed to fetch admin users: ${response.status}`)
      }

      const result: ListAdminUsersResponse = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch admin users')
      }

      return {
        users: result.data?.data || [],
        pagination: result.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - admin data should be relatively fresh
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    refetchOnWindowFocus: true, // Refetch when admin returns to tab
  })
}

// Hook for fetching individual user details
export function useAdminUserDetail(userId: string | null) {
  return useQuery({
    queryKey: adminUserKeys.detail(userId || ''),
    queryFn: async (): Promise<GetAdminUserDetailResponse['data']> => {
      if (!userId) {
        throw new Error('User ID is required')
      }

      // Include all detailed data by default
      const searchParams = new URLSearchParams({
        include_mcp_servers: 'true',
        include_deployments: 'true',
        include_trial_history: 'true',
        include_activity_timeline: 'true'
      })

      const response = await fetch(`/api/admin/users/${userId}?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        if (response.status === 404) {
          throw new Error('User not found')
        }
        throw new Error(`Failed to fetch user details: ${response.status}`)
      }

      const result: GetAdminUserDetailResponse = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch user details')
      }

      return result.data
    },
    enabled: !!userId, // Only run query if userId is provided
    staleTime: 1 * 60 * 1000, // 1 minute - user details should be fresh
    gcTime: 3 * 60 * 1000, // 3 minutes cache time
  })
}

// Hook for updating user role
export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'user' | 'admin' | 'super_admin' }) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        throw new Error(`Failed to update user role: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to update user role')
      }

      return result.data
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch user lists
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() })
      // Update the specific user detail cache
      queryClient.invalidateQueries({ queryKey: adminUserKeys.detail(variables.userId) })
    },
  })
}

// Hook for exporting users to CSV
export function useExportUsers() {
  return useMutation({
    mutationFn: async (params: AdminUsersQueryParams = {}) => {
      const searchParams = new URLSearchParams()
      
      // Add all non-undefined params to search
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value))
        }
      })
      
      // Add export flag
      searchParams.append('export', 'csv')

      const response = await fetch(`/api/admin/users?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to export users: ${response.status}`)
      }

      // Get the CSV data as blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `admin-users-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      return { success: true }
    },
  })
}

// Note: User stats are now calculated from the main user list data
// rather than being a separate API endpoint

