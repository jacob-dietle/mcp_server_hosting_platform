// Client-safe impersonation service (no server-only imports)
import type { AdminUserDetail } from '@/contracts/api-contracts'

export interface ImpersonationSession {
  admin_user_id: string
  impersonated_user_id: string
  impersonated_user_email: string
  started_at: string
  expires_at: string
  session_token: string
}

export interface ImpersonationContext {
  isImpersonating: boolean
  adminUserId: string | null
  impersonatedUserId: string | null
  impersonatedUserEmail: string | null
  sessionToken: string | null
}

export class AdminImpersonationClient {
  private static readonly IMPERSONATION_DURATION_HOURS = 2
  private static readonly SESSION_STORAGE_KEY = 'admin_impersonation_session'

  /**
   * Get current impersonation context (client-side)
   */
  static getImpersonationContext(): ImpersonationContext {
    if (typeof window === 'undefined') {
      return {
        isImpersonating: false,
        adminUserId: null,
        impersonatedUserId: null,
        impersonatedUserEmail: null,
        sessionToken: null
      }
    }

    const session = this.getStoredSession()
    if (!session) {
      return {
        isImpersonating: false,
        adminUserId: null,
        impersonatedUserId: null,
        impersonatedUserEmail: null,
        sessionToken: null
      }
    }

    // Check if session is expired
    const now = new Date()
    const expiresAt = new Date(session.expires_at)
    if (now > expiresAt) {
      this.clearStoredSession()
      return {
        isImpersonating: false,
        adminUserId: null,
        impersonatedUserId: null,
        impersonatedUserEmail: null,
        sessionToken: null
      }
    }

    return {
      isImpersonating: true,
      adminUserId: session.admin_user_id,
      impersonatedUserId: session.impersonated_user_id,
      impersonatedUserEmail: session.impersonated_user_email,
      sessionToken: session.session_token
    }
  }

  /**
   * Validate impersonation session
   */
  static validateSession(sessionToken: string): boolean {
    const context = this.getImpersonationContext()
    return context.isImpersonating && context.sessionToken === sessionToken
  }

  /**
   * Store session in browser storage (client-side only)
   */
  static storeSession(session: ImpersonationSession): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(session))
    } catch (error) {
      console.warn('Failed to store impersonation session', { error })
    }
  }

  /**
   * Get stored session from browser storage
   */
  static getStoredSession(): ImpersonationSession | null {
    if (typeof window === 'undefined') return null

    try {
      const stored = localStorage.getItem(this.SESSION_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.warn('Failed to parse stored impersonation session', { error })
      return null
    }
  }

  /**
   * Clear stored session
   */
  static clearStoredSession(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(this.SESSION_STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear stored impersonation session', { error })
    }
  }
}

export const adminImpersonationClient = AdminImpersonationClient 
