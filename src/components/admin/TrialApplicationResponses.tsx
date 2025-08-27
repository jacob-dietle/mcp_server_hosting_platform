'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  FileText, 
  User, 
  Calendar, 
  Star, 
  CheckCircle, 
  XCircle, 
  Clock,
  Eye,
  EyeOff,
  Download
} from 'lucide-react'
import type { AdminTrialSummary } from '@/contracts/api-contracts'
import type { FormConfiguration } from '@/lib/trial'

interface TrialApplicationResponsesProps {
  application: AdminTrialSummary
  formConfiguration?: FormConfiguration
  onApprove?: (applicationId: string) => void
  onReject?: (applicationId: string, reason: string) => void
  isLoading?: boolean
}

export default function TrialApplicationResponses({
  application,
  formConfiguration,
  onApprove,
  onReject,
  isLoading = false
}: TrialApplicationResponsesProps) {
  const [showRawData, setShowRawData] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-300'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).toUpperCase()
  }

  const renderQuestionResponse = (questionId: string, response: any) => {
    // Try to find the question in the form configuration
    const question = formConfiguration?.questions.find(q => q.id === questionId)
    const questionLabel = question?.label || questionId.replace(/_/g, ' ').toUpperCase()
    
    // Handle different response types
    let displayValue = response
    if (Array.isArray(response)) {
      displayValue = response.join(', ')
    } else if (typeof response === 'object') {
      displayValue = JSON.stringify(response)
    } else if (typeof response === 'boolean') {
      displayValue = response ? 'Yes' : 'No'
    }

    return (
      <div key={questionId} className="space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="font-mono text-sm font-medium terminal-text">
            {questionLabel}
            {question?.required && <span className="text-destructive ml-1">*</span>}
          </h4>
          {question?.type && (
            <Badge variant="outline" className="text-xs font-mono">
              {question.type.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="p-3 bg-muted/20 border-2 border-border font-mono text-sm">
          {displayValue || <span className="text-muted-foreground">No response</span>}
        </div>
        {question?.description && (
          <p className="text-xs text-muted-foreground font-mono">
            {question.description}
          </p>
        )}
      </div>
    )
  }

  const exportResponse = () => {
    const exportData = {
      application_id: application.id,
      user: application.user,
      status: application.status,
      applied_at: application.applied_at,
      qualification_score: application.auto_qualification_score,
      responses: application.qualification_answers,
      form_configuration: formConfiguration
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trial_application_${application.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="card-terminal">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center font-mono terminal-text">
              <FileText className="h-5 w-5 mr-2 text-primary" />
              TRIAL APPLICATION #{application.id.slice(-8).toUpperCase()}
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              SUBMITTED BY {application.user.email}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`font-mono border-2 ${getStatusColor(application.status)}`}>
              {application.status.toUpperCase()}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={exportResponse}
              className="font-mono"
            >
              <Download className="h-4 w-4 mr-2" />
              EXPORT
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Application Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-mono text-muted-foreground">USER</p>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm terminal-text">{application.user.email}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-mono text-muted-foreground">APPLIED</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm terminal-text">{formatDate(application.applied_at)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-mono text-muted-foreground">QUALIFICATION SCORE</p>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm terminal-text">{application.auto_qualification_score}/10</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Form Responses */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-mono font-semibold terminal-text">FORM RESPONSES</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRawData(!showRawData)}
              className="font-mono"
            >
              {showRawData ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showRawData ? 'HIDE RAW' : 'SHOW RAW'}
            </Button>
          </div>

          {showRawData ? (
            <div className="p-4 bg-muted/20 border-2 border-border">
              <pre className="text-xs font-mono overflow-auto">
                {JSON.stringify(application.qualification_answers, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(application.qualification_answers || {}).map(([questionId, response]) => 
                renderQuestionResponse(questionId, response)
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {application.status === 'pending' && (onApprove || onReject) && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-mono font-medium terminal-text">REVIEW ACTIONS</p>
                <p className="text-xs text-muted-foreground font-mono">
                  Approve or reject this trial application
                </p>
              </div>
              <div className="flex gap-2">
                {onReject && (
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={isLoading}
                    className="font-mono border-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    REJECT
                  </Button>
                )}
                {onApprove && (
                  <Button
                    onClick={() => onApprove(application.id)}
                    disabled={isLoading}
                    className="font-mono btn-terminal"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    APPROVE
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Rejection Status */}
        {application.status === 'rejected' && application.rejection_reason && (
          <>
            <Separator />
            <Alert className="border-2 border-destructive/20">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="font-mono">
                <strong>REJECTION REASON:</strong> {application.rejection_reason}
              </AlertDescription>
            </Alert>
          </>
        )}

        {/* Approval Status */}
        {application.status === 'approved' && (
          <>
            <Separator />
            <Alert className="border-2 border-success/20">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="font-mono">
                <strong>STATUS:</strong> Application approved and trial access granted
                {application.reviewed_at && (
                  <span className="block mt-1">
                    <strong>APPROVED ON:</strong> {formatDate(application.reviewed_at)}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="font-mono terminal-text">REJECT APPLICATION</CardTitle>
              <CardDescription className="font-mono">
                Provide a reason for rejecting this application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full p-3 border-2 border-border bg-background font-mono text-sm"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectDialog(false)
                    setRejectionReason('')
                  }}
                  className="font-mono"
                >
                  CANCEL
                </Button>
                <Button
                  onClick={() => {
                    if (onReject && rejectionReason.trim()) {
                      onReject(application.id, rejectionReason.trim())
                      setShowRejectDialog(false)
                      setRejectionReason('')
                    }
                  }}
                  disabled={!rejectionReason.trim() || isLoading}
                  className="font-mono btn-terminal"
                >
                  CONFIRM REJECT
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  )
} 
