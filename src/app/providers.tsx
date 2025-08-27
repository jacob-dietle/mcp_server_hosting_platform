'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { ImpersonationProvider } from '@/contexts/ImpersonationContext'
import { PostHogProvider } from '@/components/PostHogProvider'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <PostHogProvider>
      <QueryClientProvider client={queryClient}>
        <ImpersonationProvider>
          {children}
        </ImpersonationProvider>
      </QueryClientProvider>
    </PostHogProvider>
  )
}