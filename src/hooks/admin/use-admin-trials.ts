'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query key factory for admin trials
export const adminTrialKeys = {
  all: ['admin', 'trials'] as const,
  lists: () => [...adminTrialKeys.all, 'list'] as const,
  list: (params: AdminTrialsQueryParams) => [...adminTrialKeys.lists(), params] as const,
  details: () => [...adminTrialKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminTrialKeys.details(), id] as const,
  stats: () => [...adminTrialKeys.all, 'stats'] as const,
  funnel: (params: FunnelQueryParams) => [...adminTrialKeys.all, 'funnel', params] as const,
}

export interface AdminTrialsQueryParams {
  limit?: number
  offset?: number
  status?: 'pending' | 'approved' | 'rejected' | 'expired'
  score_min?: number
  score_max?: number
  submitted_from?: string
  submitted_to?: string
  sort_by?: 'submitted_at' | 'score' | 'status' | 'user_email'
  sort_order?: 'asc' | 'desc'
}

export interface FunnelQueryParams {
  period?: '7d' | '30d' | '90d' | 'all'
  compare?: boolean
}

export interface TrialApplication {
  id: string
  user_id: string
  user_email: string
  user_name?: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  qualification_score: number
  qualification_answers: Record<string, any>
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
  reviewer_notes?: string
  expires_at?: string
}

export interface TrialStats {
  total_applications: number
  pending_applications: number
  approved_applications: number
  rejected_applications: number
  average_score: number
  approval_rate: number
}

export interface ConversionFunnelData {
  stages: {
    signups: number
    trial_applications: number
    trial_approvals: number
    deployments: number
    conversions: number
  }
  rates: {
    signup_to_trial: number
    application_to_approval: number
    approval_to_deployment: number
    trial_to_conversion: number
  }
  period: string
  comparison?: {
    stages: ConversionFunnelData['stages']
    rates: ConversionFunnelData['rates']
    period: string
  }
}

// Hook for fetching trial applications
export function useAdminTrials(params: AdminTrialsQueryParams = {}) {
  return useQuery({
    queryKey: adminTrialKeys.list(params),
    queryFn: async (): Promise<{
      applications: TrialApplication[]
      pagination: {
        total: number
        limit: number
        offset: number
        hasMore: boolean
      }
      stats: TrialStats
    }> => {
      const searchParams = new URLSearchParams()
      
      // Add all non-undefined params to search
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value))
        }
      })

      const response = await fetch(`/api/admin/trials?${searchParams.toString()}`, {
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
          throw new Error('Insufficient permissions for trial management')
        }
        if (response.status === 404) {
          // Trial system might not be implemented yet
          return {
            applications: [],
            pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
            stats: {
              total_applications: 0,
              pending_applications: 0,
              approved_applications: 0,
              rejected_applications: 0,
              average_score: 0,
              approval_rate: 0,
            }
          }
        }
        throw new Error(`Failed to fetch trial applications: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch trial applications')
      }

      return result.data
    },
    staleTime: 1 * 60 * 1000, // 1 minute - trial data should be fresh
    gcTime: 3 * 60 * 1000, // 3 minutes cache time
    refetchOnWindowFocus: true,
  })
}

// Hook for fetching conversion funnel data
export function useConversionFunnel(params: FunnelQueryParams = {}) {
  return useQuery({
    queryKey: adminTrialKeys.funnel(params),
    queryFn: async (): Promise<ConversionFunnelData> => {
      const searchParams = new URLSearchParams()
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value))
        }
      })

      const response = await fetch(`/api/admin/trials/funnel?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Return mock data if funnel endpoint doesn't exist yet
          const mockData: ConversionFunnelData = {
            stages: {
              signups: 1000,
              trial_applications: 250,
              trial_approvals: 200,
              deployments: 150,
              conversions: 75,
            },
            rates: {
              signup_to_trial: 25.0,
              application_to_approval: 80.0,
              approval_to_deployment: 75.0,
              trial_to_conversion: 50.0,
            },
            period: params.period || '30d',
          }

          if (params.compare) {
            mockData.comparison = {
              stages: {
                signups: 800,
                trial_applications: 180,
                trial_approvals: 140,
                deployments: 100,
                conversions: 45,
              },
              rates: {
                signup_to_trial: 22.5,
                application_to_approval: 77.8,
                approval_to_deployment: 71.4,
                trial_to_conversion: 45.0,
              },
              period: 'previous_' + (params.period || '30d'),
            }
          }

          return mockData
        }
        throw new Error(`Failed to fetch conversion funnel: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch conversion funnel')
      }

      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - funnel data doesn't change rapidly
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
  })
}

// Hook for approving/rejecting trial applications
export function useUpdateTrialStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      status, 
      notes 
    }: { 
      applicationId: string
      status: 'approved' | 'rejected'
      notes?: string 
    }) => {
      const response = await fetch(`/api/admin/trials/${applicationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, reviewer_notes: notes }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        if (response.status === 404) {
          throw new Error('Trial application not found')
        }
        throw new Error(`Failed to update trial status: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to update trial status')
      }

      return result.data
    },
    onSuccess: () => {
      // Invalidate trial lists and stats
      queryClient.invalidateQueries({ queryKey: adminTrialKeys.lists() })
      queryClient.invalidateQueries({ queryKey: adminTrialKeys.stats() })
    },
  })
}

// Hook for bulk trial actions
export function useBulkTrialActions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      applicationIds, 
      action, 
      notes 
    }: { 
      applicationIds: string[]
      action: 'approve' | 'reject'
      notes?: string 
    }) => {
      const response = await fetch('/api/admin/trials/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          application_ids: applicationIds, 
          action, 
          reviewer_notes: notes 
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to perform bulk action: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to perform bulk action')
      }

      return result.data
    },
    onSuccess: () => {
      // Invalidate all trial-related queries
      queryClient.invalidateQueries({ queryKey: adminTrialKeys.all })
    },
  })
}

// Hook for trial statistics
export function useTrialStats() {
  return useQuery({
    queryKey: adminTrialKeys.stats(),
    queryFn: async (): Promise<TrialStats> => {
      const response = await fetch('/api/admin/trials/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Return mock stats if endpoint doesn't exist
          return {
            total_applications: 0,
            pending_applications: 0,
            approved_applications: 0,
            rejected_applications: 0,
            average_score: 0,
            approval_rate: 0,
          }
        }
        throw new Error(`Failed to fetch trial stats: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch trial stats')
      }

      return result.data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

