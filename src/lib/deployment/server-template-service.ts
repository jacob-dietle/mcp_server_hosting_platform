import 'server-only'

import { createClient } from '@/lib/supabase/server'
import logger from '../logger/index'

export interface ServerTemplate {
  id: string
  name: string
  display_name: string
  description?: string
  category: string
  github_repo: string
  github_branch: string
  required_env_vars: EnvVarSchema[]
  optional_env_vars: EnvVarSchema[]
  port: number
  healthcheck_path: string
  build_command?: string
  start_command?: string
  min_memory_mb: number
  min_cpu_cores: number
  default_transport_type: 'sse' | 'streamable-http' | 'http'
  // estimated_cost_usd?: string // Removed pricing display
  icon_url?: string
  documentation_url?: string
  example_config?: Record<string, any>
  tags: string[]
  is_active: boolean
  is_featured: boolean
  requires_approval: boolean
  allowed_user_ids: string[]
  created_at: string
  updated_at: string
  created_by?: string
}

export interface EnvVarSchema {
  name: string
  display_name: string
  description?: string
  type: 'string' | 'number' | 'boolean' | 'url' | 'enum' | 'textarea'
  validation?: {
    required?: boolean
    minLength?: number
    maxLength?: number
    pattern?: string
    min?: number
    max?: number
  }
  options?: string[] // For enum type
  default?: any
  sensitive?: boolean
  placeholder?: string
  help_text?: string
}

export class ServerTemplateService {
  private logger = logger.child({ component: 'ServerTemplateService' })

  async listTemplates(userId?: string): Promise<ServerTemplate[]> {
    this.logger.info('Listing server templates', { userId })

    const supabase = await createClient()
    
    let query = supabase
      .from('server_templates')
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('display_name')

    // If user ID provided, include templates restricted to that user
    if (userId) {
      // Check for templates with empty allowed_user_ids OR containing the user ID
      query = query.or(`allowed_user_ids.eq.{},allowed_user_ids.cs.{${userId}}`)
    } else {
      // Only show public templates (empty allowed_user_ids array)
      query = query.eq('allowed_user_ids', '{}')
    }

    const { data, error } = await query

    if (error) {
      this.logger.error('Failed to list templates', { error })
      throw new Error(`Failed to list templates: ${error.message}`)
    }

    return data || []
  }

  async getTemplate(templateId: string): Promise<ServerTemplate | null> {
    this.logger.info('Getting server template', { templateId })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('server_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      this.logger.error('Failed to get template', { error, templateId })
      throw new Error(`Failed to get template: ${error.message}`)
    }

    return data
  }

  async createTemplate(template: Omit<ServerTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<ServerTemplate> {
    this.logger.info('Creating server template', { name: template.name })

    const supabase = await createClient()
    const { data: user } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('server_templates')
      .insert({
        ...template,
        created_by: user.user?.id
      })
      .select()
      .single()

    if (error) {
      this.logger.error('Failed to create template', { error })
      throw new Error(`Failed to create template: ${error.message}`)
    }

    this.logger.info('Server template created', { 
      templateId: data.id,
      name: data.name 
    })

    return data
  }

  async updateTemplate(
    templateId: string, 
    updates: Partial<Omit<ServerTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>>
  ): Promise<ServerTemplate> {
    this.logger.info('Updating server template', { templateId, updates })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('server_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single()

    if (error) {
      this.logger.error('Failed to update template', { error, templateId })
      throw new Error(`Failed to update template: ${error.message}`)
    }

    this.logger.info('Server template updated', { templateId })
    return data
  }

  async deleteTemplate(templateId: string): Promise<void> {
    this.logger.info('Deleting server template', { templateId })

    const supabase = await createClient()
    const { error } = await supabase
      .from('server_templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      this.logger.error('Failed to delete template', { error, templateId })
      throw new Error(`Failed to delete template: ${error.message}`)
    }

    this.logger.info('Server template deleted', { templateId })
  }

  async validateEnvVars(
    templateId: string, 
    providedVars: Record<string, any>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const template = await this.getTemplate(templateId)
    if (!template) {
      return { valid: false, errors: ['Template not found'] }
    }

    const errors: string[] = []

    // Validate required vars
    for (const varSchema of template.required_env_vars) {
      const value = providedVars[varSchema.name]
      
      if (varSchema.validation?.required && (value === undefined || value === '')) {
        errors.push(`${varSchema.display_name} is required`)
        continue
      }

      if (value !== undefined && value !== '') {
        // Type validation
        if (varSchema.type === 'number' && isNaN(Number(value))) {
          errors.push(`${varSchema.display_name} must be a number`)
        }
        
        if (varSchema.type === 'url') {
          try {
            new URL(value)
          } catch {
            errors.push(`${varSchema.display_name} must be a valid URL`)
          }
        }

        // Pattern validation
        if (varSchema.validation?.pattern) {
          const regex = new RegExp(varSchema.validation.pattern)
          if (!regex.test(String(value))) {
            errors.push(`${varSchema.display_name} format is invalid`)
          }
        }

        // Length validation
        if (varSchema.validation?.minLength && String(value).length < varSchema.validation.minLength) {
          errors.push(`${varSchema.display_name} must be at least ${varSchema.validation.minLength} characters`)
        }

        if (varSchema.validation?.maxLength && String(value).length > varSchema.validation.maxLength) {
          errors.push(`${varSchema.display_name} must be at most ${varSchema.validation.maxLength} characters`)
        }

        // Numeric range validation
        if (varSchema.type === 'number') {
          const numValue = Number(value)
          if (varSchema.validation?.min !== undefined && numValue < varSchema.validation.min) {
            errors.push(`${varSchema.display_name} must be at least ${varSchema.validation.min}`)
          }
          if (varSchema.validation?.max !== undefined && numValue > varSchema.validation.max) {
            errors.push(`${varSchema.display_name} must be at most ${varSchema.validation.max}`)
          }
        }

        // Enum validation
        if (varSchema.type === 'enum' && varSchema.options && !varSchema.options.includes(value)) {
          errors.push(`${varSchema.display_name} must be one of: ${varSchema.options.join(', ')}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  async getTemplatesByCategory(category: string, userId?: string): Promise<ServerTemplate[]> {
    this.logger.info('Getting templates by category', { category, userId })

    const supabase = await createClient()
    
    let query = supabase
      .from('server_templates')
      .select('*')
      .eq('is_active', true)
      .eq('category', category)
      .order('is_featured', { ascending: false })
      .order('display_name')

    // If user ID provided, include templates restricted to that user
    if (userId) {
      query = query.or(`allowed_user_ids.eq.{},allowed_user_ids.cs.{${userId}}`)
    } else {
      // Only show public templates
      query = query.eq('allowed_user_ids', '{}')
    }

    const { data, error } = await query

    if (error) {
      this.logger.error('Failed to get templates by category', { error, category })
      throw new Error(`Failed to get templates by category: ${error.message}`)
    }

    return data || []
  }

  async getFeaturedTemplates(userId?: string): Promise<ServerTemplate[]> {
    this.logger.info('Getting featured templates', { userId })

    const supabase = await createClient()
    
    let query = supabase
      .from('server_templates')
      .select('*')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('display_name')

    // If user ID provided, include templates restricted to that user
    if (userId) {
      query = query.or(`allowed_user_ids.eq.{},allowed_user_ids.cs.{${userId}}`)
    } else {
      // Only show public templates
      query = query.eq('allowed_user_ids', '{}')
    }

    const { data, error } = await query

    if (error) {
      this.logger.error('Failed to get featured templates', { error })
      throw new Error(`Failed to get featured templates: ${error.message}`)
    }

    return data || []
  }

  async canUserAccessTemplate(userId: string, templateId: string): Promise<boolean> {
    this.logger.info('Checking user access to template', { userId, templateId })

    const template = await this.getTemplate(templateId)
    if (!template) {
      return false
    }

    // Check if template is public (empty allowed_user_ids array)
    if (template.allowed_user_ids.length === 0) {
      return true
    }

    // Check if user is in allowed list
    return template.allowed_user_ids.includes(userId)
  }

  async getTemplateCategories(userId?: string): Promise<string[]> {
    this.logger.info('Getting template categories', { userId })

    const supabase = await createClient()
    
    let query = supabase
      .from('server_templates')
      .select('category')
      .eq('is_active', true)

    // If user ID provided, include templates restricted to that user
    if (userId) {
      query = query.or(`allowed_user_ids.eq.{},allowed_user_ids.cs.{${userId}}`)
    } else {
      // Only show public templates
      query = query.eq('allowed_user_ids', '{}')
    }

    const { data, error } = await query

    if (error) {
      this.logger.error('Failed to get template categories', { error })
      throw new Error(`Failed to get template categories: ${error.message}`)
    }

    // Extract unique categories
    const categories = [...new Set(data?.map(item => item.category) || [])]
    return categories.sort()
  }

  async searchTemplates(
    searchTerm: string, 
    options: {
      category?: string
      featured?: boolean
      userId?: string
      limit?: number
    } = {}
  ): Promise<ServerTemplate[]> {
    this.logger.info('Searching templates', { searchTerm, options })

    const supabase = await createClient()
    
    let query = supabase
      .from('server_templates')
      .select('*')
      .eq('is_active', true)

    // Add search filters
    if (searchTerm) {
      query = query.or(`display_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,tags.cs.{${searchTerm}}`)
    }

    if (options.category) {
      query = query.eq('category', options.category)
    }

    if (options.featured !== undefined) {
      query = query.eq('is_featured', options.featured)
    }

    // User access control
    if (options.userId) {
      query = query.or(`allowed_user_ids.eq.{},allowed_user_ids.cs.{${options.userId}}`)
    } else {
      query = query.eq('allowed_user_ids', '{}')
    }

    // Ordering and limit
    query = query
      .order('is_featured', { ascending: false })
      .order('display_name')

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) {
      this.logger.error('Failed to search templates', { error, searchTerm })
      throw new Error(`Failed to search templates: ${error.message}`)
    }

    return data || []
  }
}

export const createServerTemplateService = () => new ServerTemplateService()
