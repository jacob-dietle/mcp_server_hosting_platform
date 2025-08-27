'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { createClient } from '@/lib/supabase/client'

export function usePostHogAuth() {
  const posthog = usePostHog()
  const supabase = createClient()

  useEffect(() => {
    // Delay auth sync to avoid interfering with OAuth flows
    const timer = setTimeout(() => {
      // Initial user check
      const checkUser = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          
          if (user) {
            // Identify the user in PostHog
            posthog?.identify(user.id, {
              email: user.email,
              created_at: user.created_at,
              // Add any other user properties you want to track
            })
            
            // Track login event (only if not already tracked recently)
            const lastTracked = sessionStorage.getItem('ph_login_tracked')
            const now = Date.now()
            if (!lastTracked || (now - parseInt(lastTracked)) > 60000) { // 1 minute debounce
              posthog?.capture('user_logged_in', {
                method: user.app_metadata?.provider || 'password',
                timestamp: new Date().toISOString()
              })
              sessionStorage.setItem('ph_login_tracked', now.toString())
            }
          }
        } catch (error) {
          console.error('[PostHogAuth] Error checking user:', error)
        }
      }
      
      checkUser()

      // Listen for auth state changes with reduced frequency
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        try {
          if (event === 'SIGNED_IN' && session?.user) {
            // User signed in
            posthog?.identify(session.user.id, {
              email: session.user.email,
              created_at: session.user.created_at,
            })
            
            // Debounced login tracking
            const lastTracked = sessionStorage.getItem('ph_login_tracked')
            const now = Date.now()
            if (!lastTracked || (now - parseInt(lastTracked)) > 60000) {
              posthog?.capture('user_logged_in', {
                method: session.user.app_metadata?.provider || 'password',
                timestamp: new Date().toISOString()
              })
              sessionStorage.setItem('ph_login_tracked', now.toString())
            }
          } else if (event === 'SIGNED_OUT') {
            // User signed out - reset PostHog
            posthog?.reset()
            posthog?.capture('user_logged_out', {
              timestamp: new Date().toISOString()
            })
            sessionStorage.removeItem('ph_login_tracked')
          } else if (event === 'USER_UPDATED' && session?.user) {
            // Update user properties if user data changes
            posthog?.identify(session.user.id, {
              email: session.user.email,
            })
          }
        } catch (error) {
          console.error('[PostHogAuth] Error handling auth state change:', error)
        }
      })

      return () => {
        subscription.unsubscribe()
      }
    }, 2000) // 2 second delay to avoid OAuth interference

    return () => {
      clearTimeout(timer)
    }
  }, [posthog, supabase])
} 