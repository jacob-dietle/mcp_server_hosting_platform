import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Mail, 
  Calendar,
  Settings,
  FileText,
  BarChart3,
  Loader2,
  Save,
  RefreshCw,
  ArrowLeft,
  Eye
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import logger from '@/lib/logger'
import FormConfigurationList from './FormConfigurationList'
import FormConfigurationEditor from './FormConfigurationEditor'
import FormConfigurationPreview from './FormConfigurationPreview'
import TrialApplicationResponses from './TrialApplicationResponses'
import type { FormConfiguration } from '@/lib/trial'
import type { AdminTrialSummary } from '@/contracts/api-contracts'

interface TrialApplication {
  id: string
  user_id: string
  mcp_server_type: string
  qualification_answers: Record<string, any>
  status: 'pending' | 'approved' | 'rejected'
  applied_at: string
  reviewed_at?: string
  reviewed_by?: string
  rejection_reason?: string
  admin_score?: number
  admin_notes?: string
  auto_approved?: boolean
  user_profiles: {
    email: string
  }
}

interface ApprovalSettings {
  auto_approval: {
    enabled: boolean
    threshold: number
  }
  manual_review: {
    enabled: boolean
    require_admin_notes: boolean
  }
  scoring_rules: Record<string, any>
}

export default function TrialManagementPanel() {
  const [activeTab, setActiveTab] = useState('queue')
  const [applications, setApplications] = useState<TrialApplication[]>([])
  const [approvalSettings, setApprovalSettings] = useState<ApprovalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedApplication, setSelectedApplication] = useState<TrialApplication | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve')
  const [adminScore, setAdminScore] = useState<number>(5)
  const [adminNotes, setAdminNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // Form configuration states
  const [formMode, setFormMode] = useState<'list' | 'edit' | 'preview'>('list')
  const [editingFormConfig, setEditingFormConfig] = useState<FormConfiguration | undefined>()
  const [previewFormConfig, setPreviewFormConfig] = useState<FormConfiguration | undefined>()
  const [formRefreshTrigger, setFormRefreshTrigger] = useState(0)

  // Application viewing states
  const [viewingApplication, setViewingApplication] = useState<TrialApplication | null>(null)
  const [activeFormConfig, setActiveFormConfig] = useState<FormConfiguration | null>(null)

  useEffect(() => {
    loadTrialData()
    loadActiveFormConfig()
  }, [])

  const loadActiveFormConfig = async () => {
    try {
      const response = await fetch('/api/trials/form-configuration')
      if (response.ok) {
        const data = await response.json()
        setActiveFormConfig(data.configuration)
      }
    } catch (error) {
      logger.error('Failed to load active form configuration', { error })
    }
  }

  const loadTrialData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load applications and settings in parallel
      const [appsResponse, settingsResponse] = await Promise.all([
        fetch('/api/admin/trial-applications'),
        fetch('/api/admin/approval-settings')
      ])

      if (!appsResponse.ok || !settingsResponse.ok) {
        throw new Error('Failed to load trial data')
      }

      const appsData = await appsResponse.json()
      const settingsData = await settingsResponse.json()

      setApplications(appsData.applications || [])
      setApprovalSettings(settingsData.settings || null)

      logger.info('Trial data loaded successfully', {
        applicationCount: appsData.applications?.length || 0,
        hasSettings: !!settingsData.settings
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load trial data'
      logger.error('Failed to load trial data', { error: errorMessage })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleReviewApplication = async () => {
    if (!selectedApplication) return

    try {
      setSubmitting(true)

      const response = await fetch('/api/admin/trial-applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: reviewAction,
          applicationId: selectedApplication.id,
          adminScore: reviewAction === 'approve' ? adminScore : undefined,
          adminNotes: adminNotes || undefined,
          rejectionReason: reviewAction === 'reject' ? rejectionReason : undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update application')
      }

      const result = await response.json()
      
      // Update local state
      setApplications(prev => 
        prev.map(app => 
          app.id === selectedApplication.id 
            ? { ...app, ...result.application }
            : app
        )
      )

      setReviewModalOpen(false)
      setSelectedApplication(null)
      setAdminNotes('')
      setRejectionReason('')
      setAdminScore(5)

      logger.info('Application reviewed successfully', {
        applicationId: selectedApplication.id,
        action: reviewAction
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update application'
      logger.error('Failed to review application', { error: errorMessage })
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const updateApprovalSettings = async (newSettings: Partial<ApprovalSettings>) => {
    try {
      const response = await fetch('/api/admin/approval-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: { ...approvalSettings, ...newSettings }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update settings')
      }

      const result = await response.json()
      setApprovalSettings(result.settings)

      logger.info('Approval settings updated successfully')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update settings'
      logger.error('Failed to update approval settings', { error: errorMessage })
      setError(errorMessage)
    }
  }

  const getStatusBadge = (status: string, autoApproved?: boolean) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />PENDING</Badge>
      case 'approved':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            {autoApproved ? 'AUTO-APPROVED' : 'APPROVED'}
          </Badge>
        )
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="h-3 w-3 mr-1" />REJECTED</Badge>
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const openReviewModal = (application: TrialApplication, action: 'approve' | 'reject') => {
    setSelectedApplication(application)
    setReviewAction(action)
    setAdminScore(application.admin_score || 5)
    setAdminNotes(application.admin_notes || '')
    setRejectionReason(application.rejection_reason || '')
    setReviewModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground font-mono">LOADING TRIAL MANAGEMENT...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-2 border-destructive/20">
          <AlertDescription className="font-mono">
            {error}
            <Button 
              onClick={loadTrialData} 
              variant="outline" 
              size="sm" 
              className="ml-2 font-mono border-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              RETRY
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-muted border-2 border-border">
          <TabsTrigger 
            value="queue" 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
          >
            <User className="h-4 w-4 mr-2" />
            APPLICATION QUEUE
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
          >
            <Settings className="h-4 w-4 mr-2" />
            APPROVAL SETTINGS
          </TabsTrigger>
          <TabsTrigger 
            value="forms" 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
          >
            <FileText className="h-4 w-4 mr-2" />
            FORM CONFIG
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6">
          {viewingApplication ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setViewingApplication(null)}
                  className="font-mono border-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  BACK TO QUEUE
                </Button>
                <h2 className="text-lg font-mono font-semibold terminal-text">
                  APPLICATION DETAILS
                </h2>
              </div>
              
              <TrialApplicationResponses
                application={{
                  id: viewingApplication.id,
                  user: {
                    id: viewingApplication.user_id,
                    email: viewingApplication.user_profiles.email,
                    signup_date: ''
                  },
                  mcp_server_type: viewingApplication.mcp_server_type,
                  qualification_answers: viewingApplication.qualification_answers as any, // Dynamic form data
                  auto_qualification_score: viewingApplication.admin_score || 0,
                  status: viewingApplication.status,
                  applied_at: viewingApplication.applied_at,
                  reviewed_at: viewingApplication.reviewed_at,
                  reviewed_by: viewingApplication.reviewed_by,
                  rejection_reason: viewingApplication.rejection_reason,
                  trial_start: undefined,
                  trial_end: undefined,
                  conversion_value: undefined,
                  priority_score: 0
                }}
                formConfiguration={activeFormConfig || undefined}
                onApprove={async (applicationId) => {
                  setSelectedApplication(viewingApplication)
                  setReviewAction('approve')
                  setAdminScore(viewingApplication.admin_score || 5)
                  setAdminNotes(viewingApplication.admin_notes || '')
                  setReviewModalOpen(true)
                }}
                onReject={async (applicationId, reason) => {
                  setSelectedApplication(viewingApplication)
                  setReviewAction('reject')
                  setRejectionReason(reason)
                  setReviewModalOpen(true)
                }}
                isLoading={submitting}
              />
            </div>
          ) : (
            <Card className="card-terminal">
              <CardHeader>
                <CardTitle className="flex items-center font-mono terminal-text">
                  <User className="h-5 w-5 mr-2 text-primary" />
                  TRIAL APPLICATION QUEUE
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  REVIEW AND MANAGE TRIAL REQUESTS
                </CardDescription>
              </CardHeader>
              <CardContent>
                {applications.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground font-mono">NO APPLICATIONS FOUND</p>
                  </div>
                ) : (
                  <div className="border-2 border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono">USER</TableHead>
                          <TableHead className="font-mono">SERVER TYPE</TableHead>
                          <TableHead className="font-mono">STATUS</TableHead>
                          <TableHead className="font-mono">APPLIED</TableHead>
                          <TableHead className="font-mono">SCORE</TableHead>
                          <TableHead className="font-mono">ACTIONS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applications.map((app) => (
                          <TableRow key={app.id}>
                            <TableCell>
                              <div className="font-mono">
                                <div className="font-medium terminal-text">{app.user_profiles.email}</div>
                                <div className="text-xs text-muted-foreground">
                                  {(app.qualification_answers as any)?.company_name || 
                                   (app.qualification_answers as any)?.organization || 
                                   'N/A'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">{app.mcp_server_type}</TableCell>
                            <TableCell>{getStatusBadge(app.status, app.auto_approved)}</TableCell>
                            <TableCell className="font-mono text-xs">{formatDate(app.applied_at)}</TableCell>
                            <TableCell className="font-mono">
                              {app.admin_score !== undefined ? (
                                <Badge variant="outline" className="font-mono">
                                  {app.admin_score}/10
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="font-mono"
                                  onClick={() => setViewingApplication(app)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  VIEW
                                </Button>
                                {app.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="font-mono border-2"
                                      onClick={() => openReviewModal(app, 'approve')}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      APPROVE
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="font-mono border-2"
                                      onClick={() => openReviewModal(app, 'reject')}
                                    >
                                      <XCircle className="h-3 w-3 mr-1" />
                                      REJECT
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="card-terminal">
            <CardHeader>
              <CardTitle className="flex items-center font-mono terminal-text">
                <Settings className="h-5 w-5 mr-2 text-primary" />
                APPROVAL SETTINGS
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                CONFIGURE AUTOMATIC AND MANUAL APPROVAL RULES
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {approvalSettings && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-mono font-semibold terminal-text">AUTO-APPROVAL</h3>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="auto-approval"
                          checked={approvalSettings.auto_approval?.enabled || false}
                          onCheckedChange={(enabled) => 
                            updateApprovalSettings({
                              auto_approval: {
                                ...approvalSettings.auto_approval,
                                enabled
                              }
                            })
                          }
                        />
                        <Label htmlFor="auto-approval" className="font-mono">
                          ENABLE AUTO-APPROVAL
                        </Label>
                      </div>
                      {approvalSettings.auto_approval?.enabled && (
                        <div className="space-y-2">
                          <Label className="font-mono">SCORE THRESHOLD</Label>
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            value={approvalSettings.auto_approval.threshold}
                            onChange={(e) => 
                              updateApprovalSettings({
                                auto_approval: {
                                  ...approvalSettings.auto_approval,
                                  threshold: parseInt(e.target.value)
                                }
                              })
                            }
                            className="font-mono border-2"
                          />
                          <p className="text-xs text-muted-foreground font-mono">
                            Applications scoring {approvalSettings.auto_approval.threshold}/10 or higher will be auto-approved
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-mono font-semibold terminal-text">MANUAL REVIEW</h3>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="manual-review"
                          checked={approvalSettings.manual_review?.enabled || false}
                          onCheckedChange={(enabled) => 
                            updateApprovalSettings({
                              manual_review: {
                                ...approvalSettings.manual_review,
                                enabled
                              }
                            })
                          }
                        />
                        <Label htmlFor="manual-review" className="font-mono">
                          REQUIRE MANUAL REVIEW
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="require-notes"
                          checked={approvalSettings.manual_review?.require_admin_notes || false}
                          onCheckedChange={(require_admin_notes) => 
                            updateApprovalSettings({
                              manual_review: {
                                ...approvalSettings.manual_review,
                                require_admin_notes
                              }
                            })
                          }
                        />
                        <Label htmlFor="require-notes" className="font-mono">
                          REQUIRE ADMIN NOTES
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="border-t-2 border-border pt-4">
                    <h3 className="font-mono font-semibold terminal-text mb-4">CURRENT STATUS</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 border-2 border-border bg-muted/20">
                        <div className="font-mono text-sm">AUTO-APPROVAL</div>
                        <div className={`font-mono text-lg font-bold ${approvalSettings.auto_approval?.enabled ? 'text-green-600' : 'text-red-600'}`}>
                          {approvalSettings.auto_approval?.enabled ? 'ENABLED' : 'DISABLED'}
                        </div>
                      </div>
                      <div className="p-4 border-2 border-border bg-muted/20">
                        <div className="font-mono text-sm">THRESHOLD</div>
                        <div className="font-mono text-lg font-bold terminal-text">
                          {approvalSettings.auto_approval?.threshold || 0}/10
                        </div>
                      </div>
                      <div className="p-4 border-2 border-border bg-muted/20">
                        <div className="font-mono text-sm">MANUAL REVIEW</div>
                        <div className={`font-mono text-lg font-bold ${approvalSettings.manual_review?.enabled ? 'text-green-600' : 'text-red-600'}`}>
                          {approvalSettings.manual_review?.enabled ? 'REQUIRED' : 'OPTIONAL'}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms" className="space-y-6">
          {formMode === 'list' && (
            <FormConfigurationList
              onEdit={(config) => {
                setEditingFormConfig(config)
                setFormMode('edit')
              }}
              onPreview={(config) => {
                setPreviewFormConfig(config)
                setFormMode('preview')
              }}
              refreshTrigger={formRefreshTrigger}
            />
          )}
          
          {formMode === 'edit' && (
            <FormConfigurationEditor
              configuration={editingFormConfig}
              onSave={() => {
                setFormMode('list')
                setEditingFormConfig(undefined)
                setFormRefreshTrigger(prev => prev + 1)
              }}
              onCancel={() => {
                setFormMode('list')
                setEditingFormConfig(undefined)
              }}
            />
          )}
          
          {formMode === 'preview' && previewFormConfig && (
            <FormConfigurationPreview
              configuration={previewFormConfig}
              onClose={() => {
                setFormMode('list')
                setPreviewFormConfig(undefined)
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono terminal-text">
              {reviewAction === 'approve' ? 'APPROVE' : 'REJECT'} APPLICATION
            </DialogTitle>
            <DialogDescription className="font-mono">
              {selectedApplication?.user_profiles.email} - {selectedApplication?.mcp_server_type}
            </DialogDescription>
          </DialogHeader>
          
          {selectedApplication && (
            <div className="space-y-4">
              {/* Application Details */}
              <div className="p-4 border-2 border-border bg-muted/20 font-mono text-sm">
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(selectedApplication.qualification_answers).map(([key, value]) => (
                    <div key={key}>
                      <div className="font-semibold capitalize">
                        {key.replace(/_/g, ' ')}:
                      </div>
                      <div>{String(value) || 'N/A'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {reviewAction === 'approve' && (
                <div className="space-y-2">
                  <Label className="font-mono">ADMIN SCORE (0-10)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={adminScore}
                    onChange={(e) => setAdminScore(parseInt(e.target.value))}
                    className="font-mono border-2"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-mono">
                  {reviewAction === 'approve' ? 'ADMIN NOTES (OPTIONAL)' : 'REJECTION REASON'}
                </Label>
                <Textarea
                  value={reviewAction === 'approve' ? adminNotes : rejectionReason}
                  onChange={(e) => 
                    reviewAction === 'approve' 
                      ? setAdminNotes(e.target.value)
                      : setRejectionReason(e.target.value)
                  }
                  className="font-mono border-2"
                  placeholder={
                    reviewAction === 'approve' 
                      ? 'Optional notes about this approval...'
                      : 'Please provide a reason for rejection...'
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setReviewModalOpen(false)}
              className="font-mono border-2"
            >
              CANCEL
            </Button>
            <Button 
              onClick={handleReviewApplication}
              disabled={submitting || (reviewAction === 'reject' && !rejectionReason.trim())}
              className="font-mono border-2"
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : reviewAction === 'approve' ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              {reviewAction === 'approve' ? 'APPROVE' : 'REJECT'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 
