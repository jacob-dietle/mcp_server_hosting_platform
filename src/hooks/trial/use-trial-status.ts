'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useImpersonationAwareFetch } from '../core';
import { 
  TrialInfo, 
  TrialApplication, 
  TrialQualificationData,
  UseTrialStatusReturn,
  UseTrialCountdownReturn,
  TrialStatus 
} from '@/contracts/component-contracts';


// Real API functions - no more mock data

// Type for the custom fetch function from useImpersonationAwareFetch
type CustomFetch = (url: string, options?: RequestInit) => Promise<Response>;

// API functions
const fetchTrialStatus = async (
  userId: string, 
  customFetch?: CustomFetch
): Promise<{ trial: TrialInfo | null; application: TrialApplication | null }> => {
  const fetchFn = customFetch || fetch;
  const response = await fetchFn(`/api/trials/status?user_id=${userId}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch trial status');
  }
  
  const data = await response.json();
  return {
    trial: data.trial || null,
    application: data.application || null
  };
};

const submitTrialApplication = async (
  data: (TrialQualificationData | Record<string, any>) & { user_id: string },
  customFetch?: CustomFetch
): Promise<TrialApplication> => {
  const fetchFn = customFetch || fetch;
  
  // Transform form data to API format
  // Handle both legacy TrialQualificationData format and dynamic form data
  let qualificationAnswers: Record<string, any>;
  
  if ('primary_use_case' in data && 'technical_level' in data) {
    // Legacy format from hardcoded form
    qualificationAnswers = {
      use_case: data.primary_use_case,
      technical_level: data.technical_level,
      timeline: data.implementation_timeline,
      company_size: data.company_context,
      company_name: data.company_name,
      role: data.role
    };
  } else {
    // Dynamic form data - already mapped by DynamicTrialQualificationForm
    qualificationAnswers = { ...data };
    delete qualificationAnswers.user_id; // Remove user_id from answers
  }
  
  const apiData = {
    mcp_server_type: 'emailbison', // Default to EmailBison for now
    qualification_answers: qualificationAnswers
  };
  
  const response = await fetchFn('/api/trials/apply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiData),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to submit trial application');
  }
  
  const result = await response.json();
  return result.data.application;
};

// ============================================================================
// TRIAL STATUS HOOK
// ============================================================================

export function useTrialStatus(userId: string, options?: { impersonatedUserId?: string }): UseTrialStatusReturn {
  const queryClient = useQueryClient();
  const impersonationAwareFetch = useImpersonationAwareFetch();
  
  // Cache isolation for impersonation
  const effectiveUserId = options?.impersonatedUserId || userId;
  const queryKey = options?.impersonatedUserId 
    ? ['trial-status', userId, 'impersonated', options.impersonatedUserId]
    : ['trial-status', userId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchTrialStatus(effectiveUserId, impersonationAwareFetch),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute to update countdown
  });

  const submitApplicationMutation = useMutation({
    mutationFn: (applicationData: TrialQualificationData | Record<string, any>) => 
      submitTrialApplication({ ...applicationData, user_id: effectiveUserId }, impersonationAwareFetch),
    onSuccess: () => {
      // Invalidate and refetch trial status after successful application
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const trial = data?.trial || null;
  const application = data?.application || null;

  // Computed values
  const hasActiveTrial = trial?.status === 'active';
  const needsQualification = !trial && !application; // No trial AND no application = needs qualification
  const daysUntilExpiration = trial?.days_remaining || 0;
  const isTrialExpiring = hasActiveTrial && daysUntilExpiration <= 3;

  return {
    trial,
    application,
    isLoading: isLoading || submitApplicationMutation.isPending,
    error: error || submitApplicationMutation.error,
    hasActiveTrial,
    needsQualification,
    isTrialExpiring,
    daysUntilExpiration,
    submitApplication: submitApplicationMutation.mutateAsync,
    refreshTrialStatus: refetch,
  };
}

// ============================================================================
// TRIAL COUNTDOWN HOOK
// ============================================================================

export function useTrialCountdown(trial: TrialInfo | null): UseTrialCountdownReturn {
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!trial || trial.status !== 'active') {
      setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const endTime = new Date(trial.end_date).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeRemaining({ days, hours, minutes, seconds });
      } else {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [trial]);

  const isExpired = timeRemaining.days === 0 && timeRemaining.hours === 0 && 
                   timeRemaining.minutes === 0 && timeRemaining.seconds === 0;
  
  const isExpiring = timeRemaining.days <= 3;
  
  const urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 
    timeRemaining.days > 7 ? 'low' :
    timeRemaining.days > 3 ? 'medium' :
    timeRemaining.days > 1 ? 'high' : 'critical';

  const formatTimeRemaining = (): string => {
    if (isExpired) return 'Trial Expired';
    
    if (timeRemaining.days > 0) {
      return `${timeRemaining.days} day${timeRemaining.days !== 1 ? 's' : ''} remaining`;
    } else if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}h ${timeRemaining.minutes}m remaining`;
    } else {
      return `${timeRemaining.minutes}m ${timeRemaining.seconds}s remaining`;
    }
  };

  return {
    timeRemaining,
    isExpired,
    isExpiring,
    urgencyLevel,
    formatTimeRemaining,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getTrialStatusColor = (status: TrialStatus): string => {
  switch (status) {
    case 'active':
      return 'text-green-500';
    case 'pending':
      return 'text-amber-500';
    case 'expired':
      return 'text-red-500';
    case 'converted':
      return 'text-blue-500';
    default:
      return 'text-muted-foreground';
  }
};

export const getUrgencyColor = (urgencyLevel: 'low' | 'medium' | 'high' | 'critical'): string => {
  switch (urgencyLevel) {
    case 'low':
      return 'text-green-500 border-green-500/20 bg-green-500/5';
    case 'medium':
      return 'text-amber-500 border-amber-500/20 bg-amber-500/5';
    case 'high':
      return 'text-orange-500 border-orange-500/20 bg-orange-500/5';
    case 'critical':
      return 'text-red-500 border-red-500/20 bg-red-500/5';
    default:
      return 'text-muted-foreground border-border bg-muted/5';
  }
};
