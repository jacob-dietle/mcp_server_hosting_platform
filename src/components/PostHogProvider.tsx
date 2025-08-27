"use client"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { PostHogAuthSync } from "./PostHogAuthSync"

function PostHogPageView() {
  const pathname = usePathname()

  useEffect(() => {
    // Use window.location.search instead of useSearchParams to avoid Suspense issues
    const searchParams = typeof window !== 'undefined' ? window.location.search : ''
    
    posthog.capture('$pageview', {
      path: pathname + searchParams,
    })
  }, [pathname])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      capture_pageview: false, // Disable automatic pageview since we're handling it manually
      capture_pageleave: true, // Enable pageleave capture
      capture_exceptions: true, // This enables capturing exceptions using Error Tracking
      autocapture: {
        dom_event_allowlist: ['click'], // Capture all click events
        css_selector_allowlist: [
          'a[href*="calendly.com"]', // Track all Calendly links
          'button', // Track all button clicks
          'a[href^="#"]', // Track internal navigation
          '[data-track]', // Track elements with data-track attribute
        ],
      },
      debug: process.env.NODE_ENV === "development",
    })
  }, [])

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      <PostHogAuthSync />
      {children}
    </PHProvider>
  )
}