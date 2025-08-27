'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { useTheme } from 'next-themes'
import { containerClasses, headingClasses, cardClasses, alertClasses } from '@/lib/style-utils'
import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'

export default function ThemeTestPage() {
  const { theme, setTheme } = useTheme()
  const [inputValue, setInputValue] = useState('')
  
  return (
    <div className={`${containerClasses} py-12`}>
      <div className="mb-12 space-y-4">
        <h1 className={headingClasses.h1}>Tactical Intelligence Theme</h1>
        <p className="text-xl text-muted-foreground">
          A comprehensive design system using the Tactical Intelligence color palette
        </p>
        
        <div className="flex items-center gap-4 pt-4">
          <Button 
            variant="outline" 
            onClick={() => setTheme('light')} 
            className={theme === 'light' ? 'border-primary' : ''}
          >
            Light
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setTheme('dark')} 
            className={theme === 'dark' ? 'border-primary' : ''}
          >
            Dark
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setTheme('system')} 
            className={theme === 'system' ? 'border-primary' : ''}
          >
            System
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div>
          <h2 className={headingClasses.h2}>Brand Colors</h2>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-6 rounded-md bg-primary flex items-center justify-center h-24 text-primary-foreground font-semibold">
              <div className="text-center">
                <div>Primary</div>
                <div className="text-xs opacity-80 mt-1">#D35400</div>
              </div>
            </div>
            <div className="p-6 rounded-md bg-secondary flex items-center justify-center h-24 text-secondary-foreground font-semibold">
              <div className="text-center">
                <div>Secondary</div>
                <div className="text-xs opacity-80 mt-1">#FF5C00</div>
              </div>
            </div>
            <div className="p-6 rounded-md bg-accent flex items-center justify-center h-24 text-accent-foreground font-semibold">
              <div className="text-center">
                <div>Accent</div>
                <div className="text-xs opacity-80 mt-1">#4A5240</div>
              </div>
            </div>
            <div className="p-6 rounded-md bg-metal-brown flex items-center justify-center h-24 text-white font-semibold">
              <div className="text-center">
                <div>Tertiary</div>
                <div className="text-xs opacity-80 mt-1">#9D6B53</div>
              </div>
            </div>
          </div>
          
          <h3 className={`${headingClasses.h3} mt-8 mb-4`}>Theme Colors</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-md bg-light-bg flex items-center justify-center h-24 text-light-text font-semibold border border-light-border">
              <div className="text-center">
                <div>Light Background</div>
                <div className="text-xs opacity-80 mt-1">#F2F2F0</div>
              </div>
            </div>
            <div className="p-6 rounded-md bg-light-surface flex items-center justify-center h-24 text-light-text font-semibold border border-light-border">
              <div className="text-center">
                <div>Light Surface</div>
                <div className="text-xs opacity-80 mt-1">#FFFFFF</div>
              </div>
            </div>
            <div className="p-6 rounded-md bg-dark-bg flex items-center justify-center h-24 text-dark-text font-semibold">
              <div className="text-center">
                <div>Dark Background</div>
                <div className="text-xs opacity-80 mt-1">#131A1F</div>
              </div>
            </div>
            <div className="p-6 rounded-md bg-dark-surface flex items-center justify-center h-24 text-dark-text font-semibold border border-dark-border">
              <div className="text-center">
                <div>Dark Surface</div>
                <div className="text-xs opacity-80 mt-1">#1A222A</div>
              </div>
            </div>
          </div>
          
          <h3 className={`${headingClasses.h3} mt-8 mb-4`}>Status Colors</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-md bg-success flex items-center justify-center h-18 text-white font-semibold">
              <div className="text-center">
                <div>Success</div>
                <div className="text-xs opacity-80 mt-1">#22C55E</div>
              </div>
            </div>
            <div className="p-6 rounded-md bg-warning flex items-center justify-center h-18 text-white font-semibold">
              <div className="text-center">
                <div>Warning</div>
                <div className="text-xs opacity-80 mt-1">#F59E0B</div>
              </div>
            </div>
            <div className="p-6 rounded-md bg-destructive flex items-center justify-center h-18 text-white font-semibold">
              <div className="text-center">
                <div>Error</div>
                <div className="text-xs opacity-80 mt-1">#EF4444</div>
              </div>
            </div>
            <div className="p-6 rounded-md bg-info flex items-center justify-center h-18 text-white font-semibold">
              <div className="text-center">
                <div>Info</div>
                <div className="text-xs opacity-80 mt-1">#3B82F6</div>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className={headingClasses.h2}>Typography</h2>
          <div className="space-y-4 mt-4">
            <div>
              <h1 className={headingClasses.h1}>Heading 1</h1>
              <p className="text-sm text-muted-foreground mt-1">headingClasses.h1</p>
            </div>
            <div>
              <h2 className={headingClasses.h2}>Heading 2</h2>
              <p className="text-sm text-muted-foreground mt-1">headingClasses.h2</p>
            </div>
            <div>
              <h3 className={headingClasses.h3}>Heading 3</h3>
              <p className="text-sm text-muted-foreground mt-1">headingClasses.h3</p>
            </div>
            <div>
              <h4 className={headingClasses.h4}>Heading 4</h4>
              <p className="text-sm text-muted-foreground mt-1">headingClasses.h4</p>
            </div>
            <div>
              <p className="text-lg">Regular paragraph text</p>
              <p className="text-sm text-muted-foreground mt-1">text-lg</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Muted text for supporting content</p>
              <p className="text-xs text-muted-foreground mt-1">text-sm text-muted-foreground</p>
            </div>
          </div>
          
          <h3 className={`${headingClasses.h3} mt-8 mb-4`}>Status Alerts</h3>
          <div className="space-y-4">
            <div className={`${alertClasses.success} p-4 rounded-md flex items-center gap-3`}>
              <CheckCircle className="h-5 w-5 text-success-green flex-shrink-0" />
              <div>
                <p className="font-medium text-success-green">Success Alert</p>
                <p className="text-sm">Operation completed successfully</p>
              </div>
            </div>
            <div className={`${alertClasses.warning} p-4 rounded-md flex items-center gap-3`}>
              <AlertTriangle className="h-5 w-5 text-warning-amber flex-shrink-0" />
              <div>
                <p className="font-medium text-warning-amber">Warning Alert</p>
                <p className="text-sm">Attention required: action needed</p>
              </div>
            </div>
            <div className={`${alertClasses.error} p-4 rounded-md flex items-center gap-3`}>
              <XCircle className="h-5 w-5 text-error-red flex-shrink-0" />
              <div>
                <p className="font-medium text-error-red">Error Alert</p>
                <p className="text-sm">Something went wrong. Please try again.</p>
              </div>
            </div>
            <div className={`${alertClasses.info} p-4 rounded-md flex items-center gap-3`}>
              <Info className="h-5 w-5 text-info-blue flex-shrink-0" />
              <div>
                <p className="font-medium text-info-blue">Info Alert</p>
                <p className="text-sm">Here's something you should know.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-12">
        <h2 className={headingClasses.h2}>Button Variants</h2>
        <div className="flex flex-wrap gap-4 mt-4">
          <Button variant="default">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="terminal">Terminal</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="outline-primary">Outline Primary</Button>
          <Button variant="outline-secondary">Outline Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        
        <h3 className={`${headingClasses.h3} mt-8 mb-4`}>Status Buttons</h3>
        <div className="flex flex-wrap gap-4">
          <Button variant="success">Success</Button>
          <Button variant="warning">Warning</Button>
          <Button variant="destructive">Error</Button>
          <Button variant="info">Info</Button>
        </div>
        
        <h3 className={`${headingClasses.h3} mt-8 mb-4`}>Button Sizes</h3>
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="default" size="lg">Large</Button>
          <Button variant="default">Default</Button>
          <Button variant="default" size="sm">Small</Button>
          <Button variant="outline" size="icon">
            <CheckCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div>
          <h2 className={headingClasses.h2}>Form Elements</h2>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Text Input</label>
              <Input 
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)} 
                placeholder="Enter some text..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setInputValue('')}>Clear</Button>
              <Button variant="outline">Cancel</Button>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className={headingClasses.h2}>Cards</h2>
          <div className="space-y-4 mt-4">
            <div className={cardClasses.default}>
              <h3 className="text-lg font-medium mb-2">Default Card</h3>
              <p className="text-muted-foreground">Standard card component with consistent styling</p>
            </div>
            <div className={cardClasses.highlighted}>
              <h3 className="text-lg font-medium mb-2">Highlighted Card</h3>
              <p className="text-muted-foreground">Card with primary border to draw attention</p>
            </div>
            <div className={cardClasses.accent}>
              <h3 className="text-lg font-medium mb-2">Accent Card</h3>
              <p className="text-muted-foreground">Card with accent background styling</p>
            </div>
            <div className={cardClasses.status.info}>
              <h3 className="text-lg font-medium mb-2">Status Card - Info</h3>
              <p className="text-muted-foreground">Card with status color styling</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className={headingClasses.h2}>Gradients</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-gradient-to-r from-primary-orange to-bright-orange p-6 rounded-md h-32 flex items-center justify-center text-white font-semibold">
            Primary Gradient
          </div>
          <div className="bg-gradient-to-r from-terminal-green to-terminal-green/80 p-6 rounded-md h-32 flex items-center justify-center text-white font-semibold">
            Accent Gradient
          </div>
          <div className="bg-gradient-to-r from-dark-bg to-dark-surface p-6 rounded-md h-32 flex items-center justify-center text-white font-semibold">
            Dark Gradient
          </div>
        </div>
      </div>
      
      <footer className="border-t pt-8 mt-12 text-center text-sm text-muted-foreground">
        <p>Tactical Intelligence Theme System • Speed to Insight</p>
      </footer>
    </div>
  )
} 
