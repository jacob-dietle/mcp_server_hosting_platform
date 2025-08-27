import 'server-only'

import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/logger'
import { agentLifecycle } from '@/lib/agents/agent-lifecycle'
import type { 
  TrialApplicationRequest,
  AdminTrialSummary,
  ExpiringTrialSummary 
} from '@/contracts/api-contracts'

export interface QualificationScore {
  use_case_score: number
  technical_level_score: number
  timeline_score: number
  company_size_score: number
  total_score: number
  auto_approved: boolean
}

// Dynamic form configuration interfaces
export interface FormQuestion {
  id: string
  type: 'select' | 'radio' | 'text' | 'textarea' | 'checkbox'
  label: string
  description?: string
  required: boolean
  options?: { value: string; label: string; description?: string }[]
  validation?: {
    min_length?: number
    max_length?: number
    pattern?: string
  }
  order_index: number
}

export interface FormConfiguration {
  id: string
  name: string
  description?: string
  version: number
  is_active: boolean
  questions: FormQuestion[]
  created_at: string
  created_by: string
  updated_at: string
}

export interface ApprovalSettings {
  id: string
  auto_approval_enabled: boolean
  auto_approval_threshold?: number
  require_admin_review: boolean
  approval_required_roles: string[]
  custom_scoring_rules?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface TrialApplication {
  id: string
  user_id: string
  form_configuration_id: string
  mcp_server_type: string
  qualification_answers: any
  status: 'pending' | 'approved' | 'rejected'
  admin_score?: number
  admin_notes?: string
  applied_at: string
  reviewed_at?: string
  reviewed_by?: string
  rejection_reason?: string
}

export interface DeploymentTrial {
  id: string
  user_id: string
  deployment_id: string
  trial_application_id: string
  trial_start: string
  trial_end: string
  converted: boolean
  conversion_value?: number
  conversion_date?: string
}

export class TrialApplicationService {
  private supabase: any
  private logger = logger // Logger doesn't have child method - use base logger

  // DEPRECATED: Auto-qualification scoring matrix - moving to admin-configurable system
  // Keep for backward compatibility during transition
  private readonly LEGACY_SCORING_MATRIX = {
    use_case: {
      'email_automation': 3,
      'customer_support': 2,
      'content_creation': 2,
      'data_analysis': 1,
      'exploration': 0
    },
    technical_level: {
      'expert': 3,
      'intermediate': 2,
      'beginner': 1
    },
    timeline: {
      'immediate': 2,
      'this_month': 1,
      'exploring': 0
    },
    company_size: {
      'enterprise': 2,
      'business': 1,
      'personal': 0
    }
  }

  // DEPRECATED: Auto-approval threshold - now admin controlled
  private readonly LEGACY_AUTO_APPROVAL_THRESHOLD = 4 // Out of 10 points
  private readonly RATE_LIMIT_DAYS = 30

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
   * Get active form configuration
   */
  async getActiveFormConfiguration(): Promise<FormConfiguration | null> {
    try {
      const supabase = await this.getSupabase()

      const { data: config, error } = await supabase
        .schema('auth_logic')
        .from('trial_form_configurations')
        .select('*')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null
        }
        this.logger.error('Error fetching active form configuration', { error })
        throw new Error('Failed to fetch form configuration')
      }

      // Parse questions from JSONB - they're stored directly in the questions column
      const questions: FormQuestion[] = (config.questions || []).map((q: any, index: number) => ({
        id: q.id || `question_${index}`,
        type: q.type,
        label: q.label,
        description: q.description,
        required: q.required,
        options: q.options,
        validation: q.validation,
        order_index: q.order_index ?? index // Use stored order_index or array index as fallback
      }))

      return {
        id: config.id,
        name: config.name,
        description: config.description,
        version: config.version,
        is_active: config.is_active,
        questions,
        created_at: config.created_at,
        created_by: config.created_by,
        updated_at: config.updated_at
      }
    } catch (error) {
      this.logger.error('Error in getActiveFormConfiguration', { error })
      throw error
    }
  }

  /**
   * Get current approval settings (legacy interface for backward compatibility)
   */
  async getApprovalSettings(): Promise<ApprovalSettings | null> {
    try {
      const supabase = await this.getSupabase()

      const { data: settingsRows, error } = await supabase
        .schema('auth_logic')
        .from('trial_approval_settings')
        .select('*')

      if (error) {
        this.logger.error('Error fetching approval settings', { error })
        throw new Error('Failed to fetch approval settings')
      }

      // Transform the new structure to the legacy interface
      const settings: ApprovalSettings = {
        id: 'current',
        auto_approval_enabled: false,
        require_admin_review: true,
        approval_required_roles: ['admin', 'super_admin'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Extract values from the key-value structure
      settingsRows?.forEach((row: any) => {
        switch (row.setting_name) {
          case 'auto_approval':
            settings.auto_approval_enabled = row.setting_value?.enabled || false
            settings.auto_approval_threshold = row.setting_value?.threshold || 4
            break
          case 'manual_review':
            settings.require_admin_review = row.setting_value?.enabled || true
            break
          case 'scoring_rules':
            settings.custom_scoring_rules = row.setting_value
            break
        }
        // Update timestamps from the latest row
        if (row.updated_at) {
          settings.updated_at = row.updated_at
        }
        if (row.created_at) {
          settings.created_at = row.created_at
        }
      })

      return settings
    } catch (error) {
      this.logger.error('Error in getApprovalSettings', { error })
      throw error
    }
  }

  /**
   * Calculate qualification score based on current admin settings and form configuration
   * Returns score for admin reference, but approval is now manual by default
   */
  async calculateQualificationScore(answers: Record<string, any>): Promise<QualificationScore> {
    try {
      // Get current approval settings to check for custom scoring rules
      const approvalSettings = await this.getApprovalSettings()
      const customRules = approvalSettings?.custom_scoring_rules

      if (customRules && typeof customRules === 'object') {
        // Use custom scoring rules if available
        return this.calculateCustomScore(answers, customRules)
      }

      // Fall back to dynamic scoring based on form responses
      return this.calculateDynamicScore(answers)
    } catch (error) {
      this.logger.error('Error calculating qualification score', { error })
      // Return default score if calculation fails
      return {
        use_case_score: 0,
        technical_level_score: 0,
        timeline_score: 0,
        company_size_score: 0,
        total_score: 0,
        auto_approved: false
      }
    }
  }

  /**
   * Calculate score using custom admin-defined rules
   */
  private calculateCustomScore(answers: Record<string, any>, rules: Record<string, any>): QualificationScore {
    let total_score = 0
    const breakdown: any = {}

    // Apply custom scoring rules
    Object.entries(rules).forEach(([questionId, scoring]) => {
      const answer = answers[questionId]
      if (answer && scoring && typeof scoring === 'object') {
        const score = scoring[answer] || 0
        breakdown[`${questionId}_score`] = score
        total_score += score
      }
    })

    return {
      use_case_score: breakdown.use_case_score || 0,
      technical_level_score: breakdown.technical_level_score || 0,
      timeline_score: breakdown.timeline_score || 0,
      company_size_score: breakdown.company_size_score || 0,
      total_score,
      auto_approved: false // Manual approval by default
    }
  }

  /**
   * Calculate score using dynamic heuristics based on form responses
   */
  private calculateDynamicScore(answers: Record<string, any>): QualificationScore {
    let total_score = 0
    const breakdown = {
      use_case_score: 0,
      technical_level_score: 0,
      timeline_score: 0,
      company_size_score: 0
    }

    // Try to find and score common question patterns
    Object.entries(answers).forEach(([questionId, answer]) => {
      const id = questionId.toLowerCase()
      const value = String(answer).toLowerCase()

      // Score use case related questions
      if (id.includes('use_case') || id.includes('goal') || id.includes('purpose')) {
        if (value.includes('automation') || value.includes('email')) breakdown.use_case_score = 3
        else if (value.includes('support') || value.includes('customer')) breakdown.use_case_score = 2
        else if (value.includes('content') || value.includes('creation')) breakdown.use_case_score = 2
        else if (value.includes('analysis') || value.includes('data')) breakdown.use_case_score = 1
        else breakdown.use_case_score = 0
      }

      // Score technical level questions
      if (id.includes('technical') || id.includes('experience') || id.includes('skill')) {
        if (value.includes('expert') || value.includes('advanced')) breakdown.technical_level_score = 3
        else if (value.includes('intermediate') || value.includes('some')) breakdown.technical_level_score = 2
        else if (value.includes('beginner') || value.includes('new')) breakdown.technical_level_score = 1
        else breakdown.technical_level_score = 0
      }

      // Score timeline questions
      if (id.includes('timeline') || id.includes('when') || id.includes('implement')) {
        if (value.includes('immediate') || value.includes('now')) breakdown.timeline_score = 2
        else if (value.includes('month') || value.includes('soon')) breakdown.timeline_score = 1
        else breakdown.timeline_score = 0
      }

      // Score company size questions
      if (id.includes('company') || id.includes('organization') || id.includes('size')) {
        if (value.includes('enterprise') || value.includes('large')) breakdown.company_size_score = 2
        else if (value.includes('business') || value.includes('medium')) breakdown.company_size_score = 1
        else breakdown.company_size_score = 0
      }
    })

    total_score = breakdown.use_case_score + breakdown.technical_level_score + 
                  breakdown.timeline_score + breakdown.company_size_score

    return {
      ...breakdown,
      total_score,
      auto_approved: false // Manual approval by default
    }
  }

  /**
   * Check if user can apply for a trial (rate limiting)
   */
  async canUserApplyForTrial(userId: string): Promise<{ canApply: boolean; reason?: string; nextApplicationDate?: string }> {
    try {
      try {
        const supabase = await this.getSupabase()

        // Check for existing applications within rate limit period
        const rateLimitDate = new Date()
        rateLimitDate.setDate(rateLimitDate.getDate() - this.RATE_LIMIT_DAYS)

        const { data: recentApplications, error } = await supabase
          .schema('auth_logic')
          .from('trial_applications')
          .select('applied_at, status')
          .eq('user_id', userId)
          .gte('applied_at', rateLimitDate.toISOString())
          .order('applied_at', { ascending: false })
          .limit(1)

        if (error) {
          this.logger.error('Error checking trial application rate limit', { userId, error })
          throw new Error('Failed to check trial eligibility')
        }

        if (recentApplications && recentApplications.length > 0) {
          const lastApplication = recentApplications[0]
          const nextApplicationDate = new Date(lastApplication.applied_at)
          nextApplicationDate.setDate(nextApplicationDate.getDate() + this.RATE_LIMIT_DAYS)

          return {
            canApply: false,
            reason: `You can only apply for one trial every ${this.RATE_LIMIT_DAYS} days`,
            nextApplicationDate: nextApplicationDate.toISOString()
          }
        }

        return { canApply: true }
      } catch (error) {
        this.logger.error('Error in canUserApplyForTrial', { userId, error })
        throw error
      }
    } catch (error) {
      this.logger.error('Error in canUserApplyForTrial', { userId, error })
      throw error
    }
  }

  /**
   * Submit a trial application (now requires admin approval by default)
   */
  async submitTrialApplication(
    userId: string, 
    request: TrialApplicationRequest,
    formConfigurationId?: string
  ): Promise<{ application: TrialApplication; qualificationScore: QualificationScore }> {
    try {
      this.logger.info('Submitting trial application', { 
        userId, 
        mcp_server_type: request.mcp_server_type,
        formConfigurationId
      })

      try {
        const supabase = await this.getSupabase()

        // Check rate limiting
        const eligibility = await this.canUserApplyForTrial(userId)
        if (!eligibility.canApply) {
          throw new Error(eligibility.reason || 'Trial application not allowed')
        }

        // Get current approval settings
        const approvalSettings = await this.getApprovalSettings()
        
        // Get active form configuration if not specified
        let activeFormId = formConfigurationId
        if (!activeFormId) {
          const activeForm = await this.getActiveFormConfiguration()
          if (!activeForm) {
            throw new Error('No active form configuration found. Please contact administrator.')
          }
          activeFormId = activeForm.id
        }

        // Calculate qualification score (for admin reference)
        const qualificationScore = await this.calculateQualificationScore(request.qualification_answers)

        // Determine initial status based on admin settings
        let initialStatus: 'pending' | 'approved' = 'pending'
        if (approvalSettings?.auto_approval_enabled && qualificationScore.total_score >= (approvalSettings.auto_approval_threshold || 8)) {
          initialStatus = 'approved'
          qualificationScore.auto_approved = true
        }

        // Prepare insert data
        const insertData = {
          user_id: userId,
          form_configuration_id: activeFormId,
          mcp_server_type: request.mcp_server_type,
          qualification_answers: request.qualification_answers,
          status: initialStatus,
          admin_score: qualificationScore.total_score
          // applied_at will be set automatically by database default
        };

        this.logger.info('Attempting to insert trial application', { 
          userId, 
          insertData,
          approvalSettings: {
            auto_approval_enabled: approvalSettings?.auto_approval_enabled,
            threshold: approvalSettings?.auto_approval_threshold
          },
          dataTypes: {
            user_id: typeof userId,
            form_configuration_id: typeof activeFormId,
            mcp_server_type: typeof request.mcp_server_type,
            qualification_answers: typeof request.qualification_answers,
            status: typeof initialStatus
          }
        });

        // Insert trial application
        const { data: application, error: insertError } = await supabase
          .schema('auth_logic')
          .from('trial_applications')
          .insert(insertData)
          .select()
          .single()

        if (insertError) {
          this.logger.error('Error inserting trial application', { 
            userId, 
            error: insertError,
            errorCode: insertError.code,
            errorMessage: insertError.message,
            errorDetails: insertError.details,
            errorHint: insertError.hint
          })
          throw new Error(`Failed to submit trial application: ${insertError.message || insertError.code || 'Unknown database error'}`)
        }

        // If auto-approved by admin settings, create deployment trial record
        if (qualificationScore.auto_approved && initialStatus === 'approved') {
          await this.createDeploymentTrialRecord(application.id, userId)
        }

        // Create agent immediately when a user applies
        try {
          await agentLifecycle.createTrialAgent(application.id, userId, request.mcp_server_type)
          this.logger.info('Trial agent created successfully', { 
            applicationId: application.id, 
            userId, 
            mcpServerType: request.mcp_server_type 
          })
        } catch (agentError) {
          // Log the error but don't fail the entire application process
          this.logger.error('Failed to create trial agent', { 
            applicationId: application.id, 
            userId, 
            mcpServerType: request.mcp_server_type,
            error: agentError instanceof Error ? agentError.message : String(agentError)
          })
        }

        this.logger.info('Trial application submitted successfully', {
          userId,
          applicationId: application.id,
          status: initialStatus,
          qualificationScore: qualificationScore.total_score,
          autoApproved: qualificationScore.auto_approved,
          adminControlled: !approvalSettings?.auto_approval_enabled
        })

        return { application, qualificationScore }
      } catch (error) {
        this.logger.error('Error in submitTrialApplication', { userId, error })
        throw error
      }
    } catch (error) {
      this.logger.error('Error in submitTrialApplication', { userId, error })
      throw error
    }
  }

  /**
   * Create deployment trial record for approved applications
   */
  private async createDeploymentTrialRecord(applicationId: string, userId: string): Promise<DeploymentTrial> {
    const supabase = await this.getSupabase()

    const trialStart = new Date()
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 7) // Default 7-day trial

    const { data: deploymentTrial, error } = await supabase
      .schema('auth_logic')
      .from('deployment_trials')
      .insert({
        user_id: userId,
        trial_application_id: applicationId,
        trial_start: trialStart.toISOString(),
        trial_end: trialEnd.toISOString(),
        converted: false
      })
      .select()
      .single()

    if (error) {
      this.logger.error('Error creating deployment trial record', { applicationId, userId, error })
      throw new Error('Failed to create trial deployment record')
    }

    return deploymentTrial
  }

  /**
   * Get trial application by ID
   */
  async getTrialApplication(applicationId: string): Promise<TrialApplication | null> {
    try {
      try {
        const supabase = await this.getSupabase()

        const { data: application, error } = await supabase
          .schema('auth_logic')
          .from('trial_applications')
          .select('*')
          .eq('id', applicationId)
          .single()

        if (error) {
          if (error.code === 'PGRST116') { // Not found
            return null
          }
          this.logger.error('Error fetching trial application', { applicationId, error })
          throw new Error('Failed to fetch trial application')
        }

        return application
      } catch (error) {
        this.logger.error('Error in getTrialApplication', { applicationId, error })
        throw error
      }
    } catch (error) {
      this.logger.error('Error in getTrialApplication', { applicationId, error })
      throw error
    }
  }

  /**
   * Get user's trial status by deployment ID
   */
  async getTrialStatusByDeployment(deploymentId: string, userId: string): Promise<any> {
    try {
      try {
        const supabase = await this.getSupabase()

        // Get deployment trial with application info
        const { data: deploymentTrial, error } = await supabase
          .schema('auth_logic')
          .from('deployment_trials')
          .select(`
            *,
            trial_applications (
              id,
              status,
              applied_at,
              mcp_server_type
            )
          `)
          .eq('deployment_id', deploymentId)
          .eq('user_id', userId)
          .single()

        if (error) {
          if (error.code === 'PGRST116') { // Not found
            return null
          }
          this.logger.error('Error fetching trial status', { deploymentId, userId, error })
          throw new Error('Failed to fetch trial status')
        }

        // Calculate days remaining
        const now = new Date()
        const trialEnd = new Date(deploymentTrial.trial_end)
        const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

        // Determine status
        let status = 'active'
        if (deploymentTrial.converted) {
          status = 'converted'
        } else if (daysRemaining <= 0) {
          status = 'expired'
        }

        return {
          ...deploymentTrial,
          days_remaining: daysRemaining,
          status,
          conversion_eligible: daysRemaining > 0 && !deploymentTrial.converted
        }
      } catch (error) {
        this.logger.error('Error in getTrialStatusByDeployment', { deploymentId, userId, error })
        throw error
      }
    } catch (error) {
      this.logger.error('Error in getTrialStatusByDeployment', { deploymentId, userId, error })
      throw error
    }
  }

  /**
   * List trial applications for admin review
   */
  async listTrialApplicationsForAdmin(filters: any = {}, pagination: any = {}): Promise<{ applications: AdminTrialSummary[]; total: number }> {
    try {
      try {
        const supabase = await this.getSupabase()

        let query = supabase
          .schema('auth_logic')
          .from('trial_applications')
          .select(`
            *,
            auth.users (
              id,
              email,
              created_at
            ),
            deployment_trials (
              trial_start,
              trial_end,
              converted,
              conversion_value
            )
          `, { count: 'exact' })

        // Apply filters
        if (filters.status) {
          query = query.eq('status', filters.status)
        }
        if (filters.mcp_server_type) {
          query = query.eq('mcp_server_type', filters.mcp_server_type)
        }
        if (filters.applied_date_from) {
          query = query.gte('applied_at', filters.applied_date_from)
        }
        if (filters.applied_date_to) {
          query = query.lte('applied_at', filters.applied_date_to)
        }

        // Apply sorting
        const sortBy = filters.sort_by || 'applied_at'
        const sortOrder = filters.sort_order === 'asc' ? { ascending: true } : { ascending: false }
        query = query.order(sortBy, sortOrder)

        // Apply pagination
        const limit = pagination.limit || 20
        const offset = pagination.offset || 0
        query = query.range(offset, offset + limit - 1)

        const { data: applications, error, count } = await query

        if (error) {
          this.logger.error('Error listing trial applications for admin', { error })
          throw new Error('Failed to fetch trial applications')
        }

        // Transform data for admin view
        const transformedApplications: AdminTrialSummary[] = await Promise.all(
          (applications || []).map(async (app: any) => {
            const qualificationScore = await this.calculateQualificationScore(app.qualification_answers)
            return {
              id: app.id,
              user: {
                id: app.auth?.users?.id || app.user_id,
                email: app.auth?.users?.email || 'Unknown',
                signup_date: app.auth?.users?.created_at || ''
              },
              mcp_server_type: app.mcp_server_type,
              qualification_answers: app.qualification_answers,
              auto_qualification_score: qualificationScore.total_score,
              status: app.status,
              applied_at: app.applied_at,
              reviewed_at: app.reviewed_at,
              reviewed_by: app.reviewed_by,
              rejection_reason: app.rejection_reason,
              trial_start: app.deployment_trials?.[0]?.trial_start,
              trial_end: app.deployment_trials?.[0]?.trial_end,
              conversion_value: app.deployment_trials?.[0]?.conversion_value,
              priority_score: await this.calculatePriorityScore(app)
            }
          })
        )

        return {
          applications: transformedApplications,
          total: count || 0
        }
      } catch (error) {
        this.logger.error('Error in listTrialApplicationsForAdmin', { error })
        throw error
      }
    } catch (error) {
      this.logger.error('Error in listTrialApplicationsForAdmin', { error })
      throw error
    }
  }

  /**
   * Calculate priority score for admin review
   */
  private async calculatePriorityScore(application: any): Promise<number> {
    const qualificationScore = await this.calculateQualificationScore(application.qualification_answers)
    const daysSinceApplication = Math.floor((Date.now() - new Date(application.applied_at).getTime()) / (1000 * 60 * 60 * 24))
    
    // Higher qualification score + longer wait time = higher priority
    return qualificationScore.total_score + Math.min(daysSinceApplication * 0.1, 2)
  }

  /**
   * Approve trial application (admin action)
   */
  async approveTrialApplication(
    applicationId: string, 
    adminUserId: string, 
    options: { trialDurationDays?: number; customMessage?: string } = {}
  ): Promise<{ application: TrialApplication; deploymentTrial: DeploymentTrial }> {
    try {
      this.logger.info('Approving trial application', { applicationId, adminUserId })

      try {
        const supabase = await this.getSupabase()

        // Update application status
        const { data: application, error: updateError } = await supabase
          .schema('auth_logic')
          .from('trial_applications')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: adminUserId
          })
          .eq('id', applicationId)
          .select()
          .single()

        if (updateError) {
          this.logger.error('Error approving trial application', { applicationId, error: updateError })
          throw new Error('Failed to approve trial application')
        }

        // Create deployment trial record
        const trialDurationDays = options.trialDurationDays || 7
        const trialStart = new Date()
        const trialEnd = new Date()
        trialEnd.setDate(trialEnd.getDate() + trialDurationDays)

        const { data: deploymentTrial, error: trialError } = await supabase
          .schema('auth_logic')
          .from('deployment_trials')
          .insert({
            user_id: application.user_id,
            trial_application_id: applicationId,
            trial_start: trialStart.toISOString(),
            trial_end: trialEnd.toISOString(),
            converted: false
          })
          .select()
          .single()

        if (trialError) {
          this.logger.error('Error creating deployment trial', { applicationId, error: trialError })
          throw new Error('Failed to create trial deployment')
        }

        this.logger.info('Trial application approved successfully', {
          applicationId,
          adminUserId,
          trialDurationDays
        })

        return { application, deploymentTrial }
      } catch (error) {
        this.logger.error('Error in approveTrialApplication', { applicationId, adminUserId, error })
        throw error
      }
    } catch (error) {
      this.logger.error('Error in approveTrialApplication', { applicationId, adminUserId, error })
      throw error
    }
  }

  /**
   * Reject trial application (admin action)
   */
  async rejectTrialApplication(
    applicationId: string, 
    adminUserId: string, 
    rejectionReason: string,
    options: { customMessage?: string; reapplicationAllowed?: boolean } = {}
  ): Promise<TrialApplication> {
    try {
      this.logger.info('Rejecting trial application', { applicationId, adminUserId, rejectionReason })

      try {
        const supabase = await this.getSupabase()

        const { data: application, error } = await supabase
          .schema('auth_logic')
          .from('trial_applications')
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: adminUserId,
            rejection_reason: rejectionReason
          })
          .eq('id', applicationId)
          .select()
          .single()

        if (error) {
          this.logger.error('Error rejecting trial application', { applicationId, error })
          throw new Error('Failed to reject trial application')
        }

        this.logger.info('Trial application rejected successfully', {
          applicationId,
          adminUserId,
          rejectionReason
        })

        return application
      } catch (error) {
        this.logger.error('Error in rejectTrialApplication', { applicationId, adminUserId, error })
        throw error
      }
    } catch (error) {
      this.logger.error('Error in rejectTrialApplication', { applicationId, adminUserId, error })
      throw error
    }
  }

  /**
   * Get expiring trials for admin action
   */
  async getExpiringTrials(daysUntilExpiry: number = 3): Promise<ExpiringTrialSummary[]> {
    try {
      try {
        const supabase = await this.getSupabase()

        const expiryThreshold = new Date()
        expiryThreshold.setDate(expiryThreshold.getDate() + daysUntilExpiry)

        const { data: expiringTrials, error } = await supabase
          .schema('auth_logic')
          .from('deployment_trials')
          .select(`
            *,
            auth.users (
              id,
              email
            ),
            deployments (
              id,
              deployment_name,
              service_url
            )
          `)
          .lte('trial_end', expiryThreshold.toISOString())
          .eq('converted', false)
          .order('trial_end', { ascending: true })

        if (error) {
          this.logger.error('Error fetching expiring trials', { error })
          throw new Error('Failed to fetch expiring trials')
        }

        // Transform and calculate metrics
        const transformedTrials: ExpiringTrialSummary[] = expiringTrials?.map((trial: any) => {
          const now = new Date()
          const trialEnd = new Date(trial.trial_end)
          const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

          return {
            id: trial.id,
            user: {
              id: trial.auth?.users?.id || trial.user_id,
              email: trial.auth?.users?.email || 'Unknown'
            },
            deployment: {
              id: trial.deployments?.id || trial.deployment_id,
              deployment_name: trial.deployments?.deployment_name || 'Unknown',
              service_url: trial.deployments?.service_url
            },
            trial_end: trial.trial_end,
            days_remaining: daysRemaining,
            usage_stats: {
              requests_made: 0, // TODO: Implement usage tracking
              last_activity: null, // TODO: Implement activity tracking
              engagement_score: 0 // TODO: Implement engagement scoring
            },
            conversion_likelihood: this.calculateConversionLikelihood(trial),
            recommended_actions: this.getRecommendedActions(daysRemaining, trial)
          }
        }) || []

        return transformedTrials
      } catch (error) {
        this.logger.error('Error in getExpiringTrials', { error })
        throw error
      }
    } catch (error) {
      this.logger.error('Error in getExpiringTrials', { error })
      throw error
    }
  }

  /**
   * Calculate conversion likelihood based on trial data
   */
  private calculateConversionLikelihood(trial: any): 'high' | 'medium' | 'low' {
    // TODO: Implement sophisticated conversion likelihood algorithm
    // For now, use simple heuristics
    const daysRemaining = Math.max(0, Math.ceil((new Date(trial.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    
    if (daysRemaining > 2) {
      return 'high'
    } else if (daysRemaining > 0) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  /**
   * Get recommended actions for expiring trials
   */
  private getRecommendedActions(daysRemaining: number, trial: any): string[] {
    const actions: string[] = []

    if (daysRemaining > 2) {
      actions.push('Send trial reminder email')
      actions.push('Offer conversion discount')
    } else if (daysRemaining > 0) {
      actions.push('Send urgent conversion email')
      actions.push('Schedule follow-up call')
    } else {
      actions.push('Send trial expired notification')
      actions.push('Offer trial extension')
    }

    return actions
  }
}

// Export singleton instance
export const trialApplicationService = new TrialApplicationService()
