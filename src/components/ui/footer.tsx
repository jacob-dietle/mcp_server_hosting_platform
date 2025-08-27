'use client'

import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="border-t border-dark-border backdrop-blur-md">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/orange_icon.svg" alt="MCPGTM Logo" width={24} height={24} />
            <span className="text-sm font-semibold text-black dark:text-white font-vcr">MCPGTM</span>
          </Link>
          <p className="text-center text-sm leading-loose text-black/70 dark:text-white/70 md:text-left">
            © 2025 MCPGTM. Built for agencies that outgrew their tools.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="text-sm text-black/70 dark:text-white/70 underline-offset-4 hover:text-primary hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="text-sm text-black/70 dark:text-white/70 underline-offset-4 hover:text-primary hover:underline">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  )
} 
