'use client'

import React from 'react'
import { BarChart3, MessageSquare, Shield, Users, ArrowRight } from 'lucide-react'

const loopItems = [
  {
    title: 'Marketing Intuition',
    description: '"This positioning feels off" → System pivots using YOUR patterns',
    icon: MessageSquare,
  },
  {
    title: 'Sales Wisdom',
    description: '"This prospect needs a different angle" → Dynamic playbooks execute',
    icon: Users,
  },
  {
    title: 'Service Insights',
    description: '"These accounts show churn signals" → Proactive saves triggered',
    icon: Shield,
  },
  {
    title: 'Operations Intelligence',
    description: '"These metrics predict success" → Preventive workflows deployed',
    icon: BarChart3,
  },
  {
    title: 'Back to Marketing',
    description: '"Service insights reveal new angles" → Campaign strategies evolved',
    icon: ArrowRight,
  },
] as const

const NODE_WIDTH = 180; // Approximate width of the node item with text
const X_STEP = 40;     // Horizontal indentation for each step
const Y_STEP = 80;     // Vertical distance between steps
const RIGHT_VERTICAL_AXIS = 450; // X-position of the main vertical line

function GtmIntelligenceLoop() {
  return (
    <div className="relative">
      {/* Desktop Stepped Flow */}
      <div className="hidden md:block relative">
        <div className="relative w-full max-w-[500px] mx-auto h-[420px]">

          {/* SVG Layer for all lines and arrows */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ overflow: 'visible' }}
          >
            {/* The main vertical axis line has been removed. */}
            
            {/* Horizontal lines and arrows for each step */}
            {loopItems.slice(0, -1).map((_, index) => {
              const startX = (index * X_STEP) + NODE_WIDTH;
              const y = (index * Y_STEP) + (Y_STEP / 2);
              return (
                <g key={index}>
                  {/* Dashed horizontal line (skipping the first item as it's part of the main loop) */}
                  {index > 0 && (
                    <line
                      x1={startX}
                      y1={y}
                      x2={RIGHT_VERTICAL_AXIS}
                      y2={y}
                      stroke="hsl(var(--primary))"
                      strokeWidth="1.5"
                      strokeOpacity="0.4"
                      strokeDasharray="4,4"
                    />
                  )}
                </g>
              )
            })}
            
            {/* The final loop-back line */}
            <path
              d={`M ${((loopItems.length - 1) * X_STEP) + NODE_WIDTH / 2} ${Y_STEP * (loopItems.length - 0.5)} L ${((loopItems.length - 1) * X_STEP) + NODE_WIDTH / 2} ${Y_STEP * (loopItems.length)} L ${RIGHT_VERTICAL_AXIS + 20} ${Y_STEP * (loopItems.length)} L ${RIGHT_VERTICAL_AXIS + 20} ${Y_STEP / 2} L ${NODE_WIDTH} ${Y_STEP / 2}`}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1.5"
              strokeOpacity="0.4"
              strokeDasharray="4,4"
            />
          </svg>
          
          {/* Absolutely Positioned Nodes */}
          {loopItems.map((item, index) => (
            <div
              key={item.title}
              className="absolute"
              style={{
                top: `${index * Y_STEP}px`,
                left: `${index * X_STEP}px`,
              }}
            >
              <NodeItem item={item} />
            </div>
          ))}

          {/* Center label */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            
          </div>
        </div>
      </div>
      
      {/* Mobile Vertical Stack */}
      <div className="md:hidden space-y-8">
        {loopItems.map((item, index) => (
          <div key={item.title} className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto border-2 border-primary/20">
              <item.icon className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-bold text-lg">{item.title}</h4>
            <p className="text-sm text-muted-foreground px-4">{item.description}</p>
            {index < loopItems.length - 1 && (
              <div className="flex justify-center">
                <ArrowRight className="h-6 w-6 text-primary/50 rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function NodeItem({ item }: { item: typeof loopItems[number] }) {
  return (
    <div className="group relative w-48">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-card flex items-center justify-center group-hover:scale-110 transition-all duration-300 border-2 border-primary/20 group-hover:border-primary/40 backdrop-blur-sm group-hover:bg-primary/20 flex-shrink-0">
          <item.icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm leading-tight">{item.title}</h4>
        </div>
      </div>
      <div className="absolute top-full mt-2 left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 w-full">
        <div className="bg-card border border-primary/20 rounded-lg p-2 shadow-lg">
          <p className="text-xs text-muted-foreground">{item.description}</p>
        </div>
      </div>
    </div>
  );
}

export default GtmIntelligenceLoop

