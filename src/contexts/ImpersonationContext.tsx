'use client'

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { adminImpersonationClient } from '@/lib/admin'
import type { ImpersonationContext, ImpersonationSession } from '@/lib/admin'
import type { AdminUserDetail } from '@/contracts/api-contracts'
import logger from '@/lib/logger'

interface ImpersonationContextState extends ImpersonationContext {
  candidates: {
    no_trial: AdminUserDetail[]
    pending_trial: AdminUserDetail[]
    active_trial: AdminUserDetail[]
    expired_trial: AdminUserDetail[]
  } | null
  isLoading: boolean
  error: string | null
}

interface ImpersonationContextActions {
  startImpersonation: (targetUserId: string) => Promise<void>
  endImpersonation: () => Promise<void>
  refreshCandidates: () => Promise<void>
  clearError: () => void
}

type ImpersonationContextValue = ImpersonationContextState & ImpersonationContextActions

const ImpersonationContext = createContext<ImpersonationContextValue | null>(null)

interface ImpersonationProviderProps {
  children: React.ReactNode
}

export function ImpersonationProvider({ children }: ImpersonationProviderProps) {
  const [state, setState] = useState<ImpersonationContextState>({
    isImpersonating: false,
    adminUserId: null,
    impersonatedUserId: null,
    impersonatedUserEmail: null,
    sessionToken: null,
    candidates: null,
    isLoading: false,
    error: null
  })

  // Initialize impersonation context from localStorage
  useEffect(() => {
    const context = adminImpersonationClient.getImpersonationContext()
    setState(prev => ({
      ...prev,
      ...context
    }))
  }, [])

  // Auto-refresh candidates when context changes
  useEffect(() => {
    if (state.isImpersonating) {
      refreshCandidates()
    }
  }, [state.isImpersonating])

  const startImpersonation = useCallback(async (targetUserId: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const response = await fetch('/api/admin/impersonation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_user_id: targetUserId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to start impersonation')
      }

      const { data } = await response.json()
      const session: ImpersonationSession = data.session

      // Store session locally
      adminImpersonationClient.storeSession(session)

      // Update context state
      setState(prev => ({
        ...prev,
        isImpersonating: true,
        adminUserId: session.admin_user_id,
        impersonatedUserId: session.impersonated_user_id,
        impersonatedUserEmail: session.impersonated_user_email,
        sessionToken: session.session_token,
        isLoading: false,
        error: null
      }))

      logger.info('Impersonation started successfully', {
        targetUserId,
        sessionToken: session.session_token
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start impersonation'
      logger.error('Failed to start impersonation', { targetUserId, error: errorMessage })
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      
      throw error
    }
  }, [])

  const endImpersonation = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const sessionToken = state.sessionToken
      if (!sessionToken) {
        throw new Error('No active impersonation session')
      }

      const response = await fetch(`/api/admin/impersonation?session_token=${encodeURIComponent(sessionToken)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to end impersonation')
      }

      // Clear local session
      adminImpersonationClient.clearStoredSession()

      // Reset context state
      setState(prev => ({
        ...prev,
        isImpersonating: false,
        adminUserId: null,
        impersonatedUserId: null,
        impersonatedUserEmail: null,
        sessionToken: null,
        isLoading: false,
        error: null
      }))

      logger.info('Impersonation ended successfully', { sessionToken })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to end impersonation'
      logger.error('Failed to end impersonation', { error: errorMessage })
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      
      throw error
    }
  }, [state.sessionToken])

  const refreshCandidates = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const response = await fetch('/api/admin/impersonation', {
        method: 'GET'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to fetch impersonation candidates')
      }

      const { data } = await response.json()

      setState(prev => ({
        ...prev,
        candidates: data.candidates,
        isLoading: false,
        error: null
      }))

      logger.info('Impersonation candidates refreshed successfully')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh candidates'
      logger.error('Failed to refresh impersonation candidates', { error: errorMessage })
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const contextValue: ImpersonationContextValue = React.useMemo(() => ({
    ...state,
    startImpersonation,
    endImpersonation,
    refreshCandidates,
    clearError
  }), [state, startImpersonation, endImpersonation, refreshCandidates, clearError])

  return (
    <ImpersonationContext.Provider value={contextValue}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation(): ImpersonationContextValue {
  const context = useContext(ImpersonationContext)
  if (!context) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider')
  }
  return context
}

// Hook to get the effective user ID (impersonated user if active, otherwise current user)
export function useEffectiveUserId(currentUserId: string | null): string | null {
  const { isImpersonating, impersonatedUserId } = useImpersonation()
  
  if (isImpersonating && impersonatedUserId) {
    return impersonatedUserId
  }
  
  return currentUserId
} 
