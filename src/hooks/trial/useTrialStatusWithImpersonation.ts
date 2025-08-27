'use client';

import { useTrialStatus, useTrialCountdown } from './use-trial-status';
import { withImpersonation } from '../core';
import { useQuery } from '@tanstack/react-query'

// Wrapped hooks for impersonation support
export const useTrialStatusWithImpersonation = withImpersonation(useTrialStatus);
export const useTrialCountdownWithImpersonation = useTrialCountdown; // This doesn't need wrapping as it doesn't fetch data

/**
 * Hook to check if user has a trial agent ready for activation
 */
export function useTrialAgentStatus() {
  return useQuery({
    queryKey: ['trial-agent-status'],
    queryFn: async () => {
      const response = await fetch('/api/trials/agent-status')
      
      if (!response.ok) {
        throw new Error('Failed to check trial agent status')
      }
      
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  })
}

// Re-export other trial utilities for convenience
export { getTrialStatusColor } from './use-trial-status'; 
