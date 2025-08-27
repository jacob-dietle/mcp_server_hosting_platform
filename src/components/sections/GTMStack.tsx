'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface ToolLogo {
  name: string
  category: 'email' | 'data' | 'workflow'
  className?: string
}

const tools: ToolLogo[] = [
  // Email Sequencers
  { name: 'Smartlead', category: 'email' },
  { name: 'Instantly', category: 'email' },
  { name: 'EmailBison', category: 'email' },
  
  // Data & Analytics
  { name: 'Snowflake', category: 'data' },
  { name: 'BigQuery', category: 'data' },
  { name: 'Postgres', category: 'data' },
  { name: 'Exa', category: 'data' },
  
  // Workflows
  { name: 'n8n', category: 'workflow' },
  { name: 'Supabase', category: 'workflow' },
]

const categoryIcons = {
  email: '📧',
  data: '📊',
  workflow: '🔄'
}

const categoryTitles = {
  email: 'Email Sequencers',
  data: 'Data & Analytics',
  workflow: 'Workflows'
}

export function GTMStack() {
  return (
    <section id="gtm-stack" className="py-12 md:py-20 bg-white">
      <div className="container mx-auto">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-6 text-center">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">YOUR GTM STACK COVERED</h2>
          <p className="max-w-[85%] text-muted-foreground md:text-xl">
            Connect all your tools. Control from one place.
          </p>
        </div>
        
        <div className="mx-auto max-w-5xl mt-12">
          {/* Category Headers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {Object.entries(categoryTitles).map(([key, title]) => (
              <div key={key} className="text-center">
                <div className="text-3xl mb-2">{categoryIcons[key as keyof typeof categoryIcons]}</div>
                <h3 className="font-semibold text-lg">{title}</h3>
              </div>
            ))}
          </div>
          
          {/* Tool Logos Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className={cn(
                  "group relative rounded-lg border-2 border-zinc-200 dark:border-zinc-800",
                  "bg-white dark:bg-zinc-900 p-6",
                  "transition-all duration-300",
                  "hover:border-primary/50 hover:shadow-lg hover:scale-105",
                  "grayscale hover:grayscale-0",
                  tool.className
                )}
              >
                <div className="flex items-center justify-center h-12">
                  <p className="font-semibold text-zinc-600 dark:text-zinc-400 group-hover:text-foreground transition-colors">
                    {tool.name}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Custom Tools Card */}
            <div className="group relative rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-lg">
              <div className="flex flex-col items-center justify-center h-12 text-center">
                <p className="text-2xl mb-1">+</p>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Your custom tools
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <p className="text-lg text-muted-foreground">
              Don't see your tool? We add new integrations weekly.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
} 
