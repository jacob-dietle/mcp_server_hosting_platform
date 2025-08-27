'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import Image from 'next/image'

interface SocialProofItem {
  id: number
  message: string
  author?: string
  role?: string
  imageUrl?: string
}

const socialProofItems: SocialProofItem[] = [
  {
    id: 1,
    message: "The removal of friction was an aha moment",
    author: "Agency Founder",
    role: "$5M ARR"
  },
  {
    id: 2,
    message: "One sentence → deployed sequence in 60 seconds 🤯",
    author: "Head of Growth",
    role: "15 clients"
  },
  {
    id: 3,
    message: "40 min reports now take 4 min",
    author: "Operations Lead",
    role: "B2B SaaS Agency"
  }
]

export function SocialProof() {
  return (
    <section className="py-12 md:py-20 bg-muted/20">
      <div className="container mx-auto">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-6 text-center">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">REAL RESULTS FROM REAL AGENCIES</h2>
          <p className="max-w-[85%] text-muted-foreground md:text-xl">
            Direct messages from agencies already using MCPGTM
          </p>
        </div>
        
        <div className="mx-auto max-w-5xl mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {socialProofItems.map((item) => (
              <Card key={item.id} className="relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                {/* Screenshot placeholder with blur effect */}
                <div className="relative h-48 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                  <div className="absolute inset-0 backdrop-blur-sm bg-white/30 dark:bg-black/30"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-6">
                      <p className="text-lg font-semibold italic text-foreground">
                        "{item.message}"
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Author info */}
                <div className="p-4 border-t">
                  <p className="font-medium text-sm">{item.author}</p>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <p className="text-lg text-muted-foreground">
              Join agencies who've already transformed their operations
            </p>
          </div>
        </div>
      </div>
    </section>
  )
} 
