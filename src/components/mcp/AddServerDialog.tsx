'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/core'
import { useMCPServersWithImpersonation } from '@/hooks/mcp'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { Eye, EyeOff } from 'lucide-react'

interface AddServerDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onServerAdded: () => void
}

export function AddServerDialog({
  isOpen,
  onOpenChange,
  onServerAdded,
}: AddServerDialogProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [showUrl, setShowUrl] = useState(false)
  const [transportType, setTransportType] = useState<'sse' | 'streamable-http'>(
    'sse'
  )
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  
  // Use impersonation-aware MCP servers hook
  const effectiveUserId = useEffectiveUserId(null) // We'll get user from auth
  const { createServer } = useMCPServersWithImpersonation(effectiveUserId || '')

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Server Name and URL are required.',
        variant: 'destructive',
      })
      return
    }

    try {
      new URL(url)
    } catch (error) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid, full URL (e.g., http://localhost:3001).',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      // Use the impersonation-aware hook to create server
      await createServer({
        name,
        config: {
          url,
          transportType,
        },
      })

      toast({
        title: 'Success',
        description: `Server "${name}" has been added.`,
      })
      onServerAdded()
      onOpenChange(false)
      setName('')
      setUrl('')
      setShowUrl(false)
    } catch (error: any) {
      console.error('Error adding server:', error)
      toast({
        title: 'Error Adding Server',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New MCP Server</DialogTitle>
          <DialogDescription>
            Enter the details for your new MCP server connection.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Local Memory Server"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="url" className="text-right">
              URL
            </Label>
            <div className="col-span-3 relative">
              <Input
                id="url"
                type={showUrl ? "text" : "password"}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pr-10"
                placeholder="http://localhost:3001"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowUrl(!showUrl)}
              >
                {showUrl ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="transportType" className="text-right">
              Transport
            </Label>
            <Select
              value={transportType}
              onValueChange={(value: 'sse' | 'streamable-http') =>
                setTransportType(value)
              }
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a transport type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                <SelectItem value="streamable-http">
                  Streamable HTTP
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Adding...' : 'Add Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 
