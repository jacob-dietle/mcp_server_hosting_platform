import { useMCPServers } from './useMCPServers'
import { useImpersonation } from '@/contexts/ImpersonationContext'

/**
 * Impersonation-aware version of useMCPServers
 * 
 * This hook automatically detects if impersonation is active and passes
 * the appropriate options to the base useMCPServers hook.
 * 
 * Usage:
 * ```typescript
 * // Instead of: const servers = useMCPServers(userId)
 * const servers = useMCPServersWithImpersonation(userId)
 * 
 * // The hook automatically handles impersonation:
 * // - When not impersonating: works exactly like useMCPServers
 * // - When impersonating: fetches data for the impersonated user
 * ```
 */
export function useMCPServersWithImpersonation(userId: string) {
  const { isImpersonating, impersonatedUserId } = useImpersonation()
  
  return useMCPServers(userId, {
    impersonatedUserId: isImpersonating ? impersonatedUserId || undefined : undefined
  })
}

/**
 * Example usage in components:
 * 
 * Before (original hook):
 * ```typescript
 * function ServerList({ userId }: { userId: string }) {
 *   const { servers, isLoading, createServer, deleteServer } = useMCPServers(userId)
 *   // ...
 * }
 * ```
 * 
 * After (impersonation-aware):
 * ```typescript
 * function ServerList({ userId }: { userId: string }) {
 *   const { servers, isLoading, createServer, deleteServer } = useMCPServersWithImpersonation(userId)
 *   // Automatically handles impersonation - no other changes needed!
 * }
 * ```
 */ 
