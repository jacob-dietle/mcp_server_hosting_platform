import 'server-only'

import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/logger'

export type UserRole = 'user' | 'admin' | 'super_admin'

export interface UserRoleInfo {
  id: string
  user_id: string
  role: UserRole
  is_active: boolean
  granted_at: string
  expires_at: string | null
}

export interface AdminPermission {
  id: string
  permission_name: string
  description: string
  category: string
}

export interface AdminAuditLogEntry {
  user_id: string
  action: string
  resource_type?: string
  resource_id?: string
  details?: Record<string, any>
  metadata?: Record<string, any>
  ip_address?: string
  user_agent?: string
  success?: boolean
  error_message?: string
}

export class AdminAuthService {
  private supabase: any

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient
  }

  private async getSupabase() {
    if (!this.supabase) {
      // Create client without schema param like deployment service - defaults to auth_logic
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Get the current user's role information
   */
  async getUserRole(userId?: string): Promise<UserRoleInfo | null> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      const supabase = await this.getSupabase()
      
      // If no userId provided, get current user
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          logger.warn('No authenticated user found for role check', { requestId })
          return null
        }
        userId = user.id
      }

      logger.debug('Checking user role', { userId, requestId })

      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No role found - user has default 'user' role
          logger.debug('No explicit role found, defaulting to user role', { userId, requestId })
          return null
        }
        throw error
      }

      logger.debug('User role retrieved', { 
        userId, 
        role: data.role, 
        requestId,
        duration: Date.now() - startTime 
      })

      return data as UserRoleInfo
    } catch (error) {
      // Better error serialization like deployment service
      const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        stack: error.stack
      } : { raw: String(error) }
      
      logger.error('Failed to get user role', {
        userId,
        requestId,
        duration: Date.now() - startTime,
        errorDetails
      }, error as Error)
      throw error
    }
  }

  /**
   * Check if user has admin access (admin or super_admin role)
   */
  async hasAdminAccess(userId?: string): Promise<boolean> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      const roleInfo = await this.getUserRole(userId)
      const hasAccess = roleInfo?.role === 'admin' || roleInfo?.role === 'super_admin'
      
      logger.debug('Admin access check completed', {
        userId,
        hasAccess,
        role: roleInfo?.role || 'user',
        requestId,
        duration: Date.now() - startTime
      })

      return hasAccess
    } catch (error) {
      const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint
      } : { raw: String(error) }
      
      logger.error('Failed to check admin access', {
        userId,
        requestId,
        duration: Date.now() - startTime,
        errorDetails
      }, error as Error)
      return false
    }
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(permissionName: string, userId?: string): Promise<boolean> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      const roleInfo = await this.getUserRole(userId)
      if (!roleInfo) {
        logger.debug('No role found, permission denied', { permissionName, userId, requestId })
        return false
      }

      const supabase = await this.getSupabase()
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          admin_permissions!inner (
            permission_name
          )
        `)
        .eq('role', roleInfo.role)
        .eq('admin_permissions.permission_name', permissionName)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      const hasPermission = !!data
      
      logger.debug('Permission check completed', {
        userId,
        permissionName,
        role: roleInfo.role,
        hasPermission,
        requestId,
        duration: Date.now() - startTime
      })

      return hasPermission
    } catch (error) {
      logger.error('Failed to check permission', {
        userId,
        permissionName,
        requestId,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * Require admin access - throws error if user doesn't have admin role
   */
  async requireAdminAccess(userId?: string): Promise<UserRoleInfo> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      const roleInfo = await this.getUserRole(userId)
      
      if (!roleInfo || (roleInfo.role !== 'admin' && roleInfo.role !== 'super_admin')) {
        const error = new Error('Admin access required')
        
        logger.warn('Admin access denied', {
          userId,
          role: roleInfo?.role || 'user',
          requestId,
          duration: Date.now() - startTime
        })
        
        // Log security event
        await this.logAdminAction({
          user_id: userId || 'unknown',
          action: 'admin_access_denied',
          resource_type: 'admin_dashboard',
          success: false,
          error_message: 'Insufficient privileges'
        })
        
        throw error
      }

      logger.debug('Admin access granted', {
        userId,
        role: roleInfo.role,
        requestId,
        duration: Date.now() - startTime
      })

      return roleInfo
    } catch (error) {
      const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint
      } : { raw: String(error) }
      
      logger.error('Admin access check failed', {
        userId,
        requestId,
        duration: Date.now() - startTime,
        errorDetails
      }, error as Error)
      throw error
    }
  }

  /**
   * Get all permissions for a user's role
   */
  async getUserPermissions(userId?: string): Promise<AdminPermission[]> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      const roleInfo = await this.getUserRole(userId)
      if (!roleInfo) {
        logger.debug('No role found, returning empty permissions', { userId, requestId })
        return []
      }

      const supabase = await this.getSupabase()
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          admin_permissions (
            id,
            permission_name,
            description,
            category
          )
        `)
        .eq('role', roleInfo.role)

      if (error) {
        throw error
      }

      const permissions = data?.map((rp: any) => rp.admin_permissions).filter(Boolean) || []
      
      logger.debug('User permissions retrieved', {
        userId,
        role: roleInfo.role,
        permissionCount: permissions.length,
        requestId,
        duration: Date.now() - startTime
      })

      return permissions
    } catch (error) {
      logger.error('Failed to get user permissions', {
        userId,
        requestId,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      })
      return []
    }
  }

  /**
   * Log admin actions for audit trail
   */
  async logAdminAction(entry: AdminAuditLogEntry): Promise<void> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      const supabase = await this.getSupabase()
      
      const { error } = await supabase
        .from('admin_audit_log')
        .insert({
          ...entry,
          created_at: new Date().toISOString()
        })

      if (error) {
        throw error
      }

      logger.debug('Admin action logged', {
        userId: entry.user_id,
        action: entry.action,
        resourceType: entry.resource_type,
        success: entry.success !== false,
        requestId,
        duration: Date.now() - startTime
      })
    } catch (error) {
      const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint
      } : { raw: String(error) }
      
      logger.error('Failed to log admin action', {
        userId: entry.user_id,
        action: entry.action,
        requestId,
        duration: Date.now() - startTime,
        errorDetails
      }, error as Error)
      // Don't throw here - logging failures shouldn't break the main flow
    }
  }

  /**
   * Check if user is super admin
   */
  async isSuperAdmin(userId?: string): Promise<boolean> {
    const roleInfo = await this.getUserRole(userId)
    return roleInfo?.role === 'super_admin'
  }

  /**
   * Get admin audit logs (admin only)
   */
  async getAdminAuditLogs(
    limit: number = 100,
    offset: number = 0,
    userId?: string
  ): Promise<any[]> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      // Require admin access
      await this.requireAdminAccess(userId)
      
      const supabase = await this.getSupabase()
      
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      logger.debug('Admin audit logs retrieved', {
        userId,
        count: data?.length || 0,
        requestId,
        duration: Date.now() - startTime
      })

      return data || []
    } catch (error) {
      const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint
      } : { raw: String(error) }
      
      logger.error('Failed to get admin audit logs', {
        userId,
        requestId,
        duration: Date.now() - startTime,
        errorDetails
      }, error as Error)
      throw error
    }
  }
}

// Export singleton instance
export const adminAuthService = new AdminAuthService() 
