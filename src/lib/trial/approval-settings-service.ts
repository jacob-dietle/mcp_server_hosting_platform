import 'server-only'

import { createClient } from '@/lib/supabase/server'
import logger from '../logger/index'

export interface ApprovalSettings {
  auto_approval: {
    enabled: boolean
    threshold: number
  }
  manual_review: {
    enabled: boolean
    require_admin_notes: boolean
  }
  scoring_rules: Record<string, any>
}

export interface UpdateApprovalSettingsRequest {
  auto_approval_enabled?: boolean
  auto_approval_threshold?: number
  require_admin_review?: boolean
  approval_required_roles?: string[]
  custom_scoring_rules?: Record<string, any>
}

export class ApprovalSettingsService {
  private supabase: any
  private logger = logger.child({ component: 'ApprovalSettingsService' })

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient
  }

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Get current approval settings
   */
  async getApprovalSettings(): Promise<ApprovalSettings> {
    try {
      this.logger.info('Getting approval settings')

      const supabase = await this.getSupabase()

      const { data: settingsRows, error } = await supabase
        .from('trial_approval_settings')
        .select('*')

      if (error) {
        this.logger.error('Error getting approval settings', { error })
        throw new Error('Failed to get approval settings')
      }

      // Transform the settings rows into our ApprovalSettings structure
      const settings: ApprovalSettings = {
        auto_approval: { enabled: false, threshold: 4 },
        manual_review: { enabled: true, require_admin_notes: true },
        scoring_rules: {}
      }

      settingsRows?.forEach((row: any) => {
        switch (row.setting_name) {
          case 'auto_approval':
            settings.auto_approval = row.setting_value
            break
          case 'manual_review':
            settings.manual_review = row.setting_value
            break
          case 'scoring_rules':
            settings.scoring_rules = row.setting_value
            break
        }
      })

      this.logger.info('Approval settings retrieved successfully', { 
        settingsCount: settingsRows?.length || 0 
      })

      return settings
    } catch (error) {
      this.logger.error('Error in getApprovalSettings', { error })
      throw error
    }
  }

  /**
   * Update approval settings
   */
  async updateApprovalSettings(
    newSettings: Partial<ApprovalSettings>,
    adminUserId: string
  ): Promise<ApprovalSettings> {
    try {
      this.logger.info('Updating approval settings', { 
        adminUserId,
        updates: newSettings
      })

      const supabase = await this.getSupabase()

      // Update each setting individually
      const updatePromises: Promise<any>[] = []

      if (newSettings.auto_approval) {
        updatePromises.push(
          supabase
            .from('trial_approval_settings')
            .update({ 
              setting_value: newSettings.auto_approval,
              updated_by: adminUserId,
              updated_at: new Date().toISOString()
            })
            .eq('setting_name', 'auto_approval')
        )
      }

      if (newSettings.manual_review) {
        updatePromises.push(
          supabase
            .from('trial_approval_settings')
            .update({ 
              setting_value: newSettings.manual_review,
              updated_by: adminUserId,
              updated_at: new Date().toISOString()
            })
            .eq('setting_name', 'manual_review')
        )
      }

      if (newSettings.scoring_rules) {
        updatePromises.push(
          supabase
            .from('trial_approval_settings')
            .update({ 
              setting_value: newSettings.scoring_rules,
              updated_by: adminUserId,
              updated_at: new Date().toISOString()
            })
            .eq('setting_name', 'scoring_rules')
        )
      }

      // Execute all updates
      const results = await Promise.all(updatePromises)
      
      // Check for errors
      for (const result of results) {
        if (result.error) {
          this.logger.error('Error updating approval setting', { error: result.error })
          throw new Error(`Failed to update approval settings: ${result.error.message}`)
        }
      }

      this.logger.info('Approval settings updated successfully', {
        adminUserId,
        updatedSettings: Object.keys(newSettings)
      })

      // Return the updated settings
      return this.getApprovalSettings()
    } catch (error) {
      this.logger.error('Error in updateApprovalSettings', { error })
      throw error
    }
  }

  /**
   * Reset to default settings
   */
  async resetToDefaults(adminUserId: string): Promise<ApprovalSettings> {
    const defaultSettings: Partial<ApprovalSettings> = {
      auto_approval: { enabled: false, threshold: 4 },
      manual_review: { enabled: true, require_admin_notes: true }
    }

    return this.updateApprovalSettings(defaultSettings, adminUserId)
  }

  /**
   * Enable auto-approval with specific threshold
   */
  async enableAutoApproval(
    threshold: number,
    adminUserId: string,
    customScoringRules?: Record<string, any>
  ): Promise<ApprovalSettings> {
    const settings: Partial<ApprovalSettings> = {
      auto_approval: { enabled: true, threshold },
      manual_review: { enabled: false, require_admin_notes: false }
    }

    if (customScoringRules) {
      settings.scoring_rules = customScoringRules
    }

    return this.updateApprovalSettings(settings, adminUserId)
  }

  /**
   * Disable auto-approval (require manual review)
   */
  async disableAutoApproval(adminUserId: string): Promise<ApprovalSettings> {
    const settings: Partial<ApprovalSettings> = {
      auto_approval: { enabled: false, threshold: 4 },
      manual_review: { enabled: true, require_admin_notes: true }
    }

    return this.updateApprovalSettings(settings, adminUserId)
  }

  /**
   * Get approval settings history
   */
  async getApprovalSettingsHistory(limit = 10): Promise<ApprovalSettings[]> {
    try {
      this.logger.info('Getting approval settings history', { limit })

      const supabase = await this.getSupabase()

      const { data: history, error } = await supabase
        .schema('auth_logic')
        .from('trial_approval_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        this.logger.error('Error getting approval settings history', { error })
        throw new Error('Failed to get approval settings history')
      }

      return history || []
    } catch (error) {
      this.logger.error('Error in getApprovalSettingsHistory', { error })
      throw error
    }
  }

  /**
   * Validate approval settings configuration
   */
  validateApprovalSettings(settings: UpdateApprovalSettingsRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate auto-approval threshold
    if (settings.auto_approval_enabled && settings.auto_approval_threshold !== undefined) {
      if (settings.auto_approval_threshold < 0 || settings.auto_approval_threshold > 10) {
        errors.push('Auto-approval threshold must be between 0 and 10')
      }
    }

    // Validate required roles
    if (settings.approval_required_roles) {
      const validRoles = ['admin', 'super_admin']
      const invalidRoles = settings.approval_required_roles.filter(role => !validRoles.includes(role))
      if (invalidRoles.length > 0) {
        errors.push(`Invalid approval roles: ${invalidRoles.join(', ')}`)
      }
    }

    // Validate logical consistency
    if (settings.auto_approval_enabled && settings.require_admin_review) {
      errors.push('Cannot require admin review when auto-approval is enabled')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get default approval settings
   */
  private getDefaultSettings(): ApprovalSettings {
    return {
      auto_approval: { enabled: false, threshold: 4 },
      manual_review: { enabled: true, require_admin_notes: true },
      scoring_rules: {}
    }
  }
}

export const createApprovalSettingsService = () => new ApprovalSettingsService() 
