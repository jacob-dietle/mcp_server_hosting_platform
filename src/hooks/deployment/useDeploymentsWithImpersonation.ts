import { useDeployments, useActiveDeployments, useDeploymentStats } from './use-deployments'
import { withImpersonation, useImpersonationAwareFetch } from '../core'

/**
 * Impersonation-aware version of useDeployments
 * 
 * Usage:
 * ```typescript
 * // Instead of: const deployments = useDeployments(userId)
 * const deployments = useDeploymentsWithImpersonation(userId)
 * 
 * // The hook automatically handles impersonation:
 * // - When not impersonating: works exactly like useDeployments
 * // - When impersonating: fetches data for the impersonated user
 * ```
 */
export const useDeploymentsWithImpersonation = withImpersonation(useDeployments)

/**
 * Impersonation-aware version of useActiveDeployments
 */
export const useActiveDeploymentsWithImpersonation = withImpersonation(useActiveDeployments)

/**
 * Impersonation-aware version of useDeploymentStats
 */
export const useDeploymentStatsWithImpersonation = withImpersonation(useDeploymentStats)

/**
 * Example usage in components:
 * 
 * Before (original hook):
 * ```typescript
 * function DeploymentList({ userId }: { userId: string }) {
 *   const { deployments, isLoading } = useDeployments(userId)
 *   // ...
 * }
 * ```
 * 
 * After (impersonation-aware):
 * ```typescript
 * function DeploymentList({ userId }: { userId: string }) {
 *   const { deployments, isLoading } = useDeploymentsWithImpersonation(userId)
 *   // Automatically handles impersonation - no other changes needed!
 * }
 * ```
 */

export { useImpersonationAwareFetch } 
