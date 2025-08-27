// Server-only impersonation service
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { adminAuthService } from './admin-auth-service'
import logger from '@/lib/logger'
import type { AdminUserDetail } from '@/contracts/api-contracts'

export interface ImpersonationSession {
  admin_user_id: string
  impersonated_user_id: string
  impersonated_user_email: string
  started_at: string
  expires_at: string
  session_token: string
}

export class AdminImpersonationService {
  private static readonly IMPERSONATION_DURATION_HOURS = 2

  /**
   * Start impersonating a user (admin action) - SERVER ONLY
   */
  static async startImpersonation(
    adminUserId: string,
    targetUserId: string
  ): Promise<ImpersonationSession> {
    try {
      logger.info('Starting user impersonation', { adminUserId, targetUserId })

      // Verify admin has impersonation permission
      const hasPermission = await adminAuthService.hasPermission('impersonate_users', adminUserId)
      if (!hasPermission) {
        throw new Error('Insufficient permissions to impersonate users')
      }

      // Get target user details from user_profiles
      const supabase = await createClient()
      const { data: targetUser, error: userError } = await supabase
        .schema('auth_logic')
        .from('user_profiles')
        .select('*')
        .eq('id', targetUserId)
        .single()
      
      if (userError || !targetUser) {
        throw new Error(`Target user not found: ${targetUserId}`)
      }

      // Prevent impersonating other admins
      const targetUserRole = await adminAuthService.getUserRole(targetUserId)
      if (targetUserRole?.role && ['admin', 'super_admin'].includes(targetUserRole.role)) {
        throw new Error('Cannot impersonate admin users')
      }

      // Create impersonation session
      const sessionToken = crypto.randomUUID()
      const startedAt = new Date()
      const expiresAt = new Date(startedAt.getTime() + (this.IMPERSONATION_DURATION_HOURS * 60 * 60 * 1000))

      const session: ImpersonationSession = {
        admin_user_id: adminUserId,
        impersonated_user_id: targetUserId,
        impersonated_user_email: targetUser.email || 'Unknown',
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        session_token: sessionToken
      }

      // Log the impersonation action
      await adminAuthService.logAdminAction({
        user_id: adminUserId,
        action: 'start_user_impersonation',
        resource_type: 'user_accounts',
        resource_id: targetUserId,
        details: {
          impersonated_user_email: targetUser.email,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString()
        },
        success: true
      })

      logger.info('User impersonation started successfully', {
        adminUserId,
        targetUserId,
        sessionToken,
        expiresAt: expiresAt.toISOString()
      })

      return session

    } catch (error) {
      logger.error('Failed to start user impersonation', {
        adminUserId,
        targetUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * End impersonation session - SERVER ONLY
   */
  static async endImpersonation(sessionToken: string): Promise<void> {
    try {
      logger.info('Ending user impersonation', { sessionToken })

      // In a production system, you'd validate the session token against stored sessions
      // For now, we'll just log the action
      await adminAuthService.logAdminAction({
        user_id: 'system', // We don't have user context here, would need to pass it
        action: 'end_user_impersonation',
        resource_type: 'user_accounts',
        details: {
          session_token: sessionToken
        },
        success: true
      })

      logger.info('User impersonation ended successfully', { sessionToken })

    } catch (error) {
      logger.error('Failed to end user impersonation', {
        sessionToken,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Get users available for impersonation (filtered by trial states) - SERVER ONLY
   */
  static async getImpersonationCandidates(): Promise<{
    no_trial: AdminUserDetail[]
    pending_trial: AdminUserDetail[]
    active_trial: AdminUserDetail[]
    expired_trial: AdminUserDetail[]
  }> {
    try {
      const supabase = await createClient()

      // Get all user profiles (no cross-schema dependency)
      const { data: userProfiles, error: usersError } = await supabase
        .schema('auth_logic')
        .from('user_profiles')
        .select('*')
        .limit(100)

      if (usersError) {
        throw new Error(`Failed to fetch user profiles: ${usersError.message}`)
      }

      // Get user roles
      const userIds = userProfiles?.map(u => u.id) || []
      const { data: userRoles, error: rolesError } = await supabase
        .schema('auth_logic')
        .from('user_roles')
        .select('user_id, role, is_active')
        .in('user_id', userIds)
        .eq('is_active', true)

      if (rolesError) {
        throw new Error(`Failed to fetch user roles: ${rolesError.message}`)
      }

      // Get trial applications
      const { data: trialApps, error: trialError } = await supabase
        .schema('auth_logic')
        .from('trial_applications')
        .select('user_id, status, applied_at')
        .in('user_id', userIds)

      if (trialError) {
        logger.warn('Failed to fetch trial applications', { error: trialError.message })
      }

      // Get deployment trials
      const { data: deploymentTrials, error: trialsError } = await supabase
        .schema('auth_logic')
        .from('deployment_trials')
        .select('user_id, trial_start, trial_end, converted')
        .in('user_id', userIds)

      if (trialsError) {
        logger.warn('Failed to fetch deployment trials', { error: trialsError.message })
      }

      // Create lookup maps for performance
      const roleMap = new Map()
      userRoles?.forEach(role => roleMap.set(role.user_id, role))

      const trialAppMap = new Map()
      trialApps?.forEach(app => trialAppMap.set(app.user_id, app))

      const deploymentTrialMap = new Map()
      deploymentTrials?.forEach(trial => deploymentTrialMap.set(trial.user_id, trial))

      // Categorize users by trial status
      const candidates = {
        no_trial: [] as AdminUserDetail[],
        pending_trial: [] as AdminUserDetail[],
        active_trial: [] as AdminUserDetail[],
        expired_trial: [] as AdminUserDetail[]
      }

      userProfiles?.forEach((userProfile: any) => {
        const userRole = roleMap.get(userProfile.id)
        
        // Skip admin users
        if (userRole && ['admin', 'super_admin'].includes(userRole.role)) {
          return
        }

        const userDetail: AdminUserDetail = {
          id: userProfile.id,
          email: userProfile.email,
          signup_date: userProfile.created_at,
          role: userRole?.role || 'user',
          last_login: userProfile.last_sign_in_at,
          profile: {
            created_at: userProfile.created_at,
            updated_at: userProfile.updated_at,
            email_confirmed_at: userProfile.email_confirmed_at,
            last_sign_in_at: userProfile.last_sign_in_at,
            raw_user_meta_data: userProfile.raw_user_meta_data || {}
          },
          trial_status: 'none',
          funnel_stage: 'signup'
        }

        // Check trial status
        const trialApp = trialAppMap.get(userProfile.id)
        const deploymentTrial = deploymentTrialMap.get(userProfile.id)

        if (!trialApp) {
          candidates.no_trial.push(userDetail)
        } else if (trialApp.status === 'pending') {
          userDetail.trial_status = 'applied'
          userDetail.funnel_stage = 'trial_applied'
          candidates.pending_trial.push(userDetail)
        } else if (deploymentTrial) {
          const now = new Date()
          const trialEnd = new Date(deploymentTrial.trial_end)
          
          if (deploymentTrial.converted) {
            userDetail.trial_status = 'converted'
            userDetail.funnel_stage = 'converted'
            candidates.no_trial.push(userDetail)
          } else if (now <= trialEnd) {
            userDetail.trial_status = 'active'
            userDetail.funnel_stage = 'trial_active'
            candidates.active_trial.push(userDetail)
          } else {
            userDetail.trial_status = 'expired'
            userDetail.funnel_stage = 'deployed'
            candidates.expired_trial.push(userDetail)
          }
        } else {
          // Has approved trial application but no deployment trial yet
          userDetail.trial_status = 'applied'
          userDetail.funnel_stage = 'trial_applied'
          candidates.no_trial.push(userDetail)
        }
      })

      return candidates

    } catch (error) {
      logger.error('Failed to get impersonation candidates', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }
}

export const adminImpersonationService = AdminImpersonationService 
