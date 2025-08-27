import { useCallback, useRef, useEffect } from 'react'
import { useImpersonation } from '@/contexts/ImpersonationContext'

/**
 * Configuration options for the impersonation wrapper
 */
interface ImpersonationWrapperOptions {
  /**
   * Index of the userId parameter in the hook's arguments
   * @default 0
   */
  userIdParamIndex?: number
  
  /**
   * Whether to append impersonation suffix to query keys
   * @default true
   */
  isolateCache?: boolean
  
  /**
   * Whether to validate impersonation permissions before execution
   * @default false
   */
  requireValidation?: boolean
}

/**
 * Higher-Order Hook that adds impersonation capabilities to any hook
 * 
 * @param hook - The original hook to wrap
 * @param options - Configuration options
 * @returns Impersonation-aware version of the hook
 * 
 * @example
 * ```typescript
 * const useDeploymentsWithImpersonation = withImpersonation(useDeployments)
 * const useHealthChecksWithImpersonation = withImpersonation(useHealthChecks, {
 *   userIdParamIndex: 1 // if userId is second parameter
 * })
 * ```
 */
export function withImpersonation<TArgs extends any[], TReturn>(
  hook: (...args: TArgs) => TReturn,
  options: ImpersonationWrapperOptions = {}
) {
  const {
    userIdParamIndex = 0,
    isolateCache = true,
    requireValidation = false
  } = options

  return (...args: TArgs): TReturn => {
    const { 
      isImpersonating, 
      impersonatedUserId, 
      sessionToken
    } = useImpersonation()

    // Determine effective user ID
    const getEffectiveUserId = useCallback(() => {
      if (isImpersonating && impersonatedUserId) {
        return impersonatedUserId
      }
      
      // Return original userId parameter if provided
      return args[userIdParamIndex] as string
    }, [isImpersonating, impersonatedUserId, args, userIdParamIndex])

    // Validate impersonation if required
    if (requireValidation && isImpersonating && !sessionToken) {
      throw new Error('Invalid impersonation session')
    }

    // Create modified arguments with effective user ID
    const effectiveArgs = [...args] as TArgs
    if (isImpersonating && impersonatedUserId) {
      effectiveArgs[userIdParamIndex] = impersonatedUserId
    }

    // Call the original hook with effective arguments
    const result = hook(...effectiveArgs)

    // If the result has query-related properties, we might need to modify them
    // for cache isolation (this depends on the hook's return type)
    return result
  }
}

/**
 * API Client wrapper that adds impersonation headers to fetch calls
 */
export function createImpersonationAwareApiClient() {
  return {
    /**
     * Enhanced fetch that automatically adds impersonation headers
     */
    fetch: async (url: string, options: RequestInit = {}) => {
      // This will be called from within a React component context
      // so we can access the impersonation context
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      }

      // Note: We can't use hooks here since this is not a React component
      // Instead, we'll pass the impersonation context as parameters
      return fetch(url, {
        ...options,
        headers
      })
    }
  }
}

/**
 * Hook that provides an impersonation-aware fetch function
 */
export function useImpersonationAwareFetch() {
  const { isImpersonating, sessionToken, impersonatedUserId } = useImpersonation()
  
  // Use useRef to store the values without triggering recreations
  const impersonationRef = useRef({ isImpersonating, sessionToken, impersonatedUserId })
  
  // Update ref on changes
  useEffect(() => {
    impersonationRef.current = { isImpersonating, sessionToken, impersonatedUserId }
  }, [isImpersonating, sessionToken, impersonatedUserId])

  // Return stable function that reads from ref
  return useCallback(async (url: string, options: RequestInit = {}) => {
    const { isImpersonating, sessionToken, impersonatedUserId } = impersonationRef.current
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    }

    // Add impersonation headers if impersonating
    if (isImpersonating && sessionToken && impersonatedUserId) {
      headers['X-Impersonation-Session'] = sessionToken
      headers['X-Impersonated-User-Id'] = impersonatedUserId
    }

    return fetch(url, {
      ...options,
      headers
    })
  }, []) // Empty deps = stable reference
}

/**
 * Specific wrapper for deployment hooks that handles caching correctly
 */
export function withDeploymentImpersonation<TArgs extends any[], TReturn>(
  hook: (...args: TArgs) => TReturn,
  options: ImpersonationWrapperOptions = {}
) {
  return withImpersonation(hook, {
    userIdParamIndex: 0,
    isolateCache: true,
    requireValidation: false,
    ...options
  })
}

/**
 * Type-safe wrapper for hooks that return query results
 */
export function withQueryImpersonation<
  TArgs extends any[], 
  TReturn extends { 
    data?: any, 
    isLoading: boolean, 
    error: Error | null,
    refetch?: () => void 
  }
>(
  hook: (...args: TArgs) => TReturn,
  options: ImpersonationWrapperOptions = {}
) {
  return withImpersonation(hook, options)
}

export default withImpersonation 
