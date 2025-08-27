'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/50 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/orange_icon.svg" alt="MCPGTM Logo" width={28} height={28} />
            <span className="text-xl font-bold text-black dark:text-white font-vcr">MCPGTM</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden gap-6 md:flex">
            <Link href="/#everything-talks" className="text-sm font-medium transition-colors text-black dark:text-white hover:text-primary">
              What's Possible
            </Link>
            <Link href="/#gtm-stack" className="text-sm font-medium transition-colors text-black dark:text-white hover:text-primary">
              MCP Integrations
            </Link>
            <Link href="/#offerings" className="text-sm font-medium transition-colors text-black dark:text-white hover:text-primary">
              Offers
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/command-center">
              <Button className="text-sm">Command Center</Button>
            </Link>
            <Link href="https://calendly.com/jacobdietle/30-minute-call">
              <Button className="text-sm">Book Strategy Call</Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
