'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  FileText,
  Plus,
  MoreVertical,
  Edit,
  Eye,
  Power,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import logger from '@/lib/logger'
import type { FormConfiguration } from '@/lib/trial'

interface FormConfigurationListProps {
  onEdit: (config: FormConfiguration) => void
  onPreview: (config: FormConfiguration) => void
  refreshTrigger?: number
}

export default function FormConfigurationList({ 
  onEdit, 
  onPreview,
  refreshTrigger 
}: FormConfigurationListProps) {
  const [configurations, setConfigurations] = useState<FormConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [configToDelete, setConfigToDelete] = useState<FormConfiguration | null>(null)

  useEffect(() => {
    loadConfigurations()
  }, [refreshTrigger])

  const loadConfigurations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/form-configurations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load form configurations')
      }

      const result = await response.json()
      
      if (result.success) {
        setConfigurations(result.data.configurations)
      } else {
        throw new Error(result.error?.message || 'Failed to load configurations')
      }
    } catch (error) {
      logger.error('Failed to load form configurations', { error })
      toast.error('Failed to load form configurations')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async (configId: string) => {
    try {
      setActivating(configId)
      
      const response = await fetch(`/api/admin/form-configurations/${configId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to activate form configuration')
      }

      const result = await response.json()
      
      if (result.success) {
        toast.success('Form configuration activated')
        await loadConfigurations()
      } else {
        throw new Error(result.error?.message || 'Failed to activate configuration')
      }
    } catch (error) {
      logger.error('Failed to activate form configuration', { error })
      toast.error('Failed to activate form configuration')
    } finally {
      setActivating(null)
    }
  }

  const handleDelete = async () => {
    if (!configToDelete) return

    try {
      setDeleting(configToDelete.id)
      setDeleteDialogOpen(false)
      
      const response = await fetch(`/api/admin/form-configurations/${configToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete form configuration')
      }

      const result = await response.json()
      
      if (result.success) {
        toast.success('Form configuration deleted')
        await loadConfigurations()
      } else {
        throw new Error(result.error?.message || 'Failed to delete configuration')
      }
    } catch (error) {
      logger.error('Failed to delete form configuration', { error })
      toast.error('Failed to delete form configuration')
    } finally {
      setDeleting(null)
      setConfigToDelete(null)
    }
  }

  const openDeleteDialog = (config: FormConfiguration) => {
    setConfigToDelete(config)
    setDeleteDialogOpen(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground font-mono">LOADING FORM CONFIGURATIONS...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Card className="card-terminal">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center font-mono terminal-text">
                <FileText className="h-5 w-5 mr-2 text-primary" />
                FORM CONFIGURATIONS
              </CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                MANAGE TRIAL APPLICATION FORMS AND QUESTIONS
              </CardDescription>
            </div>
            <Button
              onClick={() => onEdit({} as FormConfiguration)}
              className="font-mono terminal-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              CREATE NEW FORM
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {configurations.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground font-mono">NO FORM CONFIGURATIONS FOUND</p>
              <Button
                onClick={() => onEdit({} as FormConfiguration)}
                variant="outline"
                className="mt-4 font-mono"
              >
                <Plus className="h-4 w-4 mr-2" />
                CREATE YOUR FIRST FORM
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-2 border-border">
                  <TableHead className="font-mono text-xs">NAME</TableHead>
                  <TableHead className="font-mono text-xs">VERSION</TableHead>
                  <TableHead className="font-mono text-xs">QUESTIONS</TableHead>
                  <TableHead className="font-mono text-xs">STATUS</TableHead>
                  <TableHead className="font-mono text-xs">LAST UPDATED</TableHead>
                  <TableHead className="font-mono text-xs text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configurations.map((config) => (
                  <TableRow key={config.id} className="border-2 border-border">
                    <TableCell className="font-mono">
                      <div>
                        <p className="font-medium terminal-text">{config.name}</p>
                        {config.description && (
                          <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">v{config.version}</TableCell>
                    <TableCell className="font-mono">{config.questions.length}</TableCell>
                    <TableCell>
                      {config.is_active ? (
                        <Badge className="font-mono border-2 bg-success/20 text-success border-success/50">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          ACTIVE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-mono border-2">
                          INACTIVE
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatDate(config.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="font-mono">
                          <DropdownMenuItem onClick={() => onPreview(config)}>
                            <Eye className="h-4 w-4 mr-2" />
                            PREVIEW
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(config)}>
                            <Edit className="h-4 w-4 mr-2" />
                            EDIT
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!config.is_active && (
                            <DropdownMenuItem
                              onClick={() => handleActivate(config.id)}
                              disabled={activating === config.id}
                            >
                              {activating === config.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Power className="h-4 w-4 mr-2" />
                              )}
                              ACTIVATE
                            </DropdownMenuItem>
                          )}
                          {!config.is_active && (
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(config)}
                              disabled={deleting === config.id}
                              className="text-destructive"
                            >
                              {deleting === config.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              DELETE
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
              DELETE FORM CONFIGURATION
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{configToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>CANCEL</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              DELETE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 
