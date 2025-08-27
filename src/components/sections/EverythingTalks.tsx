'use client'

import React from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MessageSquare, BarChart3, Database, Users, Workflow, Check, X } from 'lucide-react'

export function EverythingTalks() {
  return (
    <section id="everything-talks" className="py-10 md:py-16 bg-card relative overflow-hidden transition-colors">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/20 to-transparent"></div>
      </div>
      
      <div className="container mx-auto relative z-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl font-mono-vcr">
              EVERYTHING TALKS TO <span className="text-primary">EVERYTHING</span>
            </h2>
          </div>
          
          {/* Network Visualization (Moved Up) */}
          <div className="relative mb-16">
            <div className="text-center mb-12">
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                MCP (Model Context Protocol) makes everything talk to everything. 
                Why click through 47 screens when you can just say what you want?
              </p>
            </div>
            
            {/* Agentic Leverage SVG */}
            <div className="relative aspect-video">
              <Image
                src="/what_mcp_does.png"
                alt="Diagram showing how MCP connects various GTM tools"
                fill
                className="object-contain"
              />
            </div>
            
            <p className="text-center text-2xl font-bold text-primary mt-8">
              No more context switching - just one conversation
            </p>
          </div>

          {/* "What's Possible Now" section with Problem/Solution cards */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold mb-8">What's Possible Now</h3>
          </div>
          
          {/* Problem/Solution Flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <Card className="bg-destructive/5 dark:bg-destructive/10 border-destructive/20 backdrop-blur transition-all">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <X className="h-6 w-6 text-destructive" />
                  <h3 className="text-xl font-bold">The Problem: Success Trapped</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">Your intuition doesn't scale</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">Your team can't replicate your thinking</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">You're the bottleneck on every decision</p>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-primary/5 dark:bg-primary/10 border-primary/20 backdrop-blur transition-all">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Check className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-bold">The Solution: Full Connection</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">Your expertise talks to your tools</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">Your patterns talk to your team</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">Your intuition talks to every system</p>
                  </li>
                </ul>
                <p className="mt-4 font-semibold text-primary">
                  No more bottleneck - pure orchestration
                </p>
              </CardContent>
            </Card>
          </div>
          
          <Separator className="my-12" />
          
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold mb-8">But Infinite Possibilities Need Intelligent Constraints</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="flex gap-3">
                <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">We understand GTM workflows</p>
                  <p className="text-sm text-muted-foreground">(we ran our own agency)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">We design systems that match how YOU actually work</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Every implementation drives real business VALUE (VALUE VALUE VALUE!!!)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Network Node Component
interface NetworkNodeProps {
  icon: React.ElementType
  label: string
  isHub?: boolean
}

function NetworkNode({ icon: Icon, label, isHub = false }: NetworkNodeProps) {
  const baseClasses = "rounded-lg shadow-lg backdrop-blur transition-all hover:scale-105 w-32"
  const sizeClasses = "p-4"
  const colorClasses = isHub 
    ? 'bg-primary/20 border-2 border-primary' 
    : 'bg-card border border-border'
  
  return (
    <div className={`${baseClasses} ${sizeClasses} ${colorClasses}`}>
      <Icon className={`h-8 w-8 ${isHub ? 'text-primary' : 'text-primary/70'} mb-2 mx-auto`} />
      <p className={`text-xs ${isHub ? 'font-semibold' : ''} text-center`}>{label}</p>
    </div>
  )
} 
