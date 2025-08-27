import 'server-only'

import { createClient } from '@/lib/supabase/server'
import logger from '../logger/index'
import type { FormConfiguration, FormQuestion } from './trial-application-service'

export interface CreateFormConfigurationRequest {
  name: string
  description?: string
  questions: Omit<FormQuestion, 'id'>[]
}

export interface UpdateFormConfigurationRequest {
  name?: string
  description?: string
  questions?: Omit<FormQuestion, 'id'>[]
}

export class FormConfigurationService {
  private supabase: any
  private logger = logger

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
   * List all form configurations
   */
  async listFormConfigurations(includeInactive = false): Promise<FormConfiguration[]> {
    try {
      this.logger.info('Listing form configurations', { includeInactive })

      const supabase = await this.getSupabase()
      
      let query = supabase
        .schema('auth_logic')
        .from('trial_form_configurations')
        .select('*')
        .order('version', { ascending: false })

      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data: configs, error } = await query

      if (error) {
        this.logger.error('Error listing form configurations', { error })
        throw new Error('Failed to list form configurations')
      }

      return configs?.map(this.transformConfigFromDB) || []
    } catch (error) {
      this.logger.error('Error in listFormConfigurations', { error })
      throw error
    }
  }

  /**
   * Get form configuration by ID
   */
  async getFormConfiguration(configId: string): Promise<FormConfiguration | null> {
    try {
      this.logger.info('Getting form configuration', { configId })

      const supabase = await this.getSupabase()

      const { data: config, error } = await supabase
        .schema('auth_logic')
        .from('trial_form_configurations')
        .select('*')
        .eq('id', configId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        this.logger.error('Error getting form configuration', { configId, error })
        throw new Error('Failed to get form configuration')
      }

      return this.transformConfigFromDB(config)
    } catch (error) {
      this.logger.error('Error in getFormConfiguration', { configId, error })
      throw error
    }
  }

  /**
   * Create new form configuration
   */
  async createFormConfiguration(
    request: CreateFormConfigurationRequest,
    adminUserId: string
  ): Promise<FormConfiguration> {
    try {
      this.logger.info('Creating form configuration', { 
        name: request.name,
        adminUserId,
        questionCount: request.questions.length
      })

      const supabase = await this.getSupabase()

      // Transform questions to include proper IDs and structure
      const questionsWithIds = request.questions.map((question, index) => ({
        ...question,
        id: `question_${index}`, // Generate ID for each question
        order_index: question.order_index ?? index
      }))

      const { data: config, error: configError } = await supabase
        .schema('auth_logic')
        .from('trial_form_configurations')
        .insert({
          name: request.name,
          description: request.description,
          questions: questionsWithIds, // Store as JSONB
          version: 1,
          is_active: false, // Don't activate automatically
          created_by: adminUserId
        })
        .select()
        .single()

      if (configError) {
        this.logger.error('Error creating form configuration', { error: configError })
        throw new Error(`Failed to create form configuration: ${configError.message}`)
      }

      this.logger.info('Form configuration created successfully', {
        configId: config.id,
        name: request.name,
        questionCount: request.questions.length
      })

      return this.transformConfigFromDB(config)
    } catch (error) {
      this.logger.error('Error in createFormConfiguration', { error })
      throw error
    }
  }

  /**
   * Update form configuration
   */
  async updateFormConfiguration(
    configId: string,
    request: UpdateFormConfigurationRequest,
    adminUserId: string
  ): Promise<FormConfiguration> {
    try {
      this.logger.info('Updating form configuration', { configId, adminUserId })

      const supabase = await this.getSupabase()

      const updates: any = { 
        updated_at: new Date().toISOString(),
        updated_by: adminUserId
      }
      
      if (request.name) updates.name = request.name
      if (request.description) updates.description = request.description
      
      // Update questions if provided
      if (request.questions) {
        const questionsWithIds = request.questions.map((question, index) => ({
          ...question,
          id: `question_${index}`,
          order_index: question.order_index ?? index
        }))
        updates.questions = questionsWithIds
      }

      const { data: config, error: updateError } = await supabase
        .schema('auth_logic')
        .from('trial_form_configurations')
        .update(updates)
        .eq('id', configId)
        .select()
        .single()

      if (updateError) {
        this.logger.error('Error updating form configuration', { configId, error: updateError })
        throw new Error(`Failed to update form configuration: ${updateError.message}`)
      }

      this.logger.info('Form configuration updated successfully', { configId })

      return this.transformConfigFromDB(config)
    } catch (error) {
      this.logger.error('Error in updateFormConfiguration', { configId, error })
      throw error
    }
  }

  /**
   * Activate form configuration (deactivates others)
   */
  async activateFormConfiguration(configId: string, adminUserId: string): Promise<FormConfiguration> {
    try {
      this.logger.info('Activating form configuration', { configId, adminUserId })

      const supabase = await this.getSupabase()

      // Deactivate all other configurations first
      await supabase
        .schema('auth_logic')
        .from('trial_form_configurations')
        .update({ 
          is_active: false, 
          updated_at: new Date().toISOString(),
          updated_by: adminUserId
        })
        .neq('id', configId)

      // Activate the target configuration
      const { data: config, error: activateError } = await supabase
        .schema('auth_logic')
        .from('trial_form_configurations')
        .update({ 
          is_active: true, 
          updated_at: new Date().toISOString(),
          updated_by: adminUserId
        })
        .eq('id', configId)
        .select()
        .single()

      if (activateError) {
        this.logger.error('Error activating form configuration', { configId, error: activateError })
        throw new Error(`Failed to activate form configuration: ${activateError.message}`)
      }

      this.logger.info('Form configuration activated successfully', { configId })

      return this.transformConfigFromDB(config)
    } catch (error) {
      this.logger.error('Error in activateFormConfiguration', { configId, error })
      throw error
    }
  }

  /**
   * Delete form configuration
   */
  async deleteFormConfiguration(configId: string, adminUserId: string): Promise<void> {
    try {
      this.logger.info('Deleting form configuration', { configId, adminUserId })

      const supabase = await this.getSupabase()

      // Check if this is the active configuration
      const config = await this.getFormConfiguration(configId)
      if (config?.is_active) {
        throw new Error('Cannot delete active form configuration')
      }

      // Delete configuration (no need to delete questions as they're stored as JSONB)
      const { error: deleteError } = await supabase
        .schema('auth_logic')
        .from('trial_form_configurations')
        .delete()
        .eq('id', configId)

      if (deleteError) {
        this.logger.error('Error deleting form configuration', { configId, error: deleteError })
        throw new Error(`Failed to delete form configuration: ${deleteError.message}`)
      }

      this.logger.info('Form configuration deleted successfully', { configId })
    } catch (error) {
      this.logger.error('Error in deleteFormConfiguration', { configId, error })
      throw error
    }
  }

  /**
   * Create default form configuration
   */
  async createDefaultFormConfiguration(adminUserId: string): Promise<FormConfiguration> {
    const defaultQuestions: Omit<FormQuestion, 'id'>[] = [
      {
        type: 'select',
        label: 'Primary Use Case',
        description: 'What\'s your main goal with EmailBison MCP Server?',
        required: true,
        order_index: 0,
        options: [
          { value: 'email_automation', label: 'Email Automation', description: 'Automate email campaigns, responses, and workflows' },
          { value: 'customer_support', label: 'Customer Support', description: 'Enhance support workflows and response automation' },
          { value: 'content_creation', label: 'Content Creation', description: 'Generate and manage content at scale' },
          { value: 'data_analysis', label: 'Data Analysis', description: 'Analyze and process data with AI assistance' },
          { value: 'exploration', label: 'Exploration', description: 'Explore MCP capabilities and potential use cases' }
        ]
      },
      {
        type: 'radio',
        label: 'Technical Experience Level',
        description: 'How would you describe your technical experience level?',
        required: true,
        order_index: 1,
        options: [
          { value: 'expert', label: 'Expert', description: 'Extensive experience with APIs, integrations, and development' },
          { value: 'intermediate', label: 'Intermediate', description: 'Some technical experience, comfortable with configuration' },
          { value: 'beginner', label: 'Beginner', description: 'Limited technical experience, prefer guided setup' }
        ]
      },
      {
        type: 'radio',
        label: 'Implementation Timeline',
        description: 'When are you planning to implement this solution?',
        required: true,
        order_index: 2,
        options: [
          { value: 'immediate', label: 'Immediate', description: 'Ready to implement and deploy right away' },
          { value: 'this_month', label: 'This Month', description: 'Planning to implement within the next 30 days' },
          { value: 'exploring', label: 'Exploring', description: 'Evaluating options and gathering requirements' }
        ]
      },
      {
        type: 'radio',
        label: 'Company Context',
        description: 'What type of organization will be using this?',
        required: true,
        order_index: 3,
        options: [
          { value: 'enterprise', label: 'Enterprise', description: 'Large organization with complex requirements' },
          { value: 'business', label: 'Business', description: 'Small to medium business with specific needs' },
          { value: 'personal', label: 'Personal', description: 'Individual use or personal projects' }
        ]
      },
      {
        type: 'text',
        label: 'Company Name',
        description: 'Enter your company name (optional for personal use)',
        required: false,
        order_index: 4,
        validation: {
          max_length: 100
        }
      },
      {
        type: 'text',
        label: 'Your Role',
        description: 'e.g., DevOps Engineer, CTO, Developer (optional for personal use)',
        required: false,
        order_index: 5,
        validation: {
          max_length: 100
        }
      }
    ]

    return this.createFormConfiguration({
      name: 'Default Trial Application Form',
      description: 'Standard trial application form with qualification questions',
      questions: defaultQuestions
    }, adminUserId)
  }

  /**
   * Helper method to transform database record to interface
   */
  private transformConfigFromDB(config: any): FormConfiguration {
    // Questions are stored as JSONB, so we can use them directly
    const questions: FormQuestion[] = (config.questions || []).map((q: any, index: number) => ({
      id: q.id || `question_${index}`,
      type: q.type,
      label: q.label,
      description: q.description,
      required: q.required,
      options: q.options,
      validation: q.validation,
      order_index: q.order_index ?? index
    })).sort((a: FormQuestion, b: FormQuestion) => a.order_index - b.order_index)

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
  }
}

// Export singleton instance
export const formConfigurationService = new FormConfigurationService()

// Export factory function for dependency injection
export function createFormConfigurationService(supabaseClient?: any): FormConfigurationService {
  return new FormConfigurationService(supabaseClient)
} 
