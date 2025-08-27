'use client'

import { usePostHogAuth } from '@/hooks/core/usePostHogAuth'

export function PostHogAuthSync() {
  // This hook handles all the auth synchronization logic
  usePostHogAuth()
  
  // This component doesn't render anything, it just runs the effect
  return null
} 