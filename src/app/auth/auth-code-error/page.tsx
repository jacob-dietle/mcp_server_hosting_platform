'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AuthCodeErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error_description')

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="max-w-md p-8 space-y-4 text-center">
        <h1 className="text-3xl font-bold text-destructive">
          Authentication Error
        </h1>
        <p className="text-lg">
          There was a problem signing you in.
        </p>
        {error && (
          <div className="p-4 border rounded-md bg-destructive/10 border-destructive/50">
            <p className="font-mono text-sm text-destructive-foreground">
              {error}
            </p>
          </div>
        )}
        <a
          href="/auth/login"
          className="inline-block px-6 py-2 text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Try Again
        </a>
      </div>
    </div>
  )
}

export default function AuthCodeError() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        <div className="max-w-md p-8 space-y-4 text-center">
          <h1 className="text-3xl font-bold text-destructive">
            Authentication Error
          </h1>
          <p className="text-lg">
            Loading error details...
          </p>
        </div>
      </div>
    }>
      <AuthCodeErrorContent />
    </Suspense>
  )
} 
