'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  FileText,
  Mail
} from 'lucide-react';
import type { TrialApplication } from '@/contracts/component-contracts';

interface TrialPendingApprovalProps {
  application: TrialApplication;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function TrialPendingApproval({ 
  application, 
  onRefresh,
  isRefreshing = false 
}: TrialPendingApprovalProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Clock className="h-6 w-6 text-amber-500" />
          <h2 className="text-2xl font-bold terminal-text">APPLICATION UNDER REVIEW</h2>
        </div>
        <p className="text-muted-foreground font-mono">
          {'>'} YOUR TRIAL APPLICATION IS BEING PROCESSED
        </p>
      </div>

      {/* Status Card */}
      <Card className="card-terminal">
        <CardHeader>
          <CardTitle className="terminal-text flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            APPLICATION STATUS
          </CardTitle>
          <CardDescription className="font-mono">
            SUBMITTED {application.applied_at ? formatDate(application.applied_at).toUpperCase() : 'RECENTLY'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border-2 border-border bg-muted/20">
            <div className="space-y-1">
              <p className="font-mono font-medium terminal-text">CURRENT STATUS</p>
              <p className="text-sm text-muted-foreground font-mono">
                Your application requires manual review
              </p>
            </div>
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              <Clock className="h-3 w-3 mr-1" />
              PENDING REVIEW
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border-2 border-border bg-muted/10">
              <p className="font-mono text-sm text-muted-foreground mb-1">APPLICATION ID</p>
              <p className="font-mono font-medium terminal-text">{application.id}</p>
            </div>
            <div className="p-4 border-2 border-border bg-muted/10">
              <p className="font-mono text-sm text-muted-foreground mb-1">ESTIMATED REVIEW TIME</p>
              <p className="font-mono font-medium terminal-text">1-2 BUSINESS DAYS</p>
            </div>
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <div className="pt-4 border-t border-border">
              <Button
                onClick={onRefresh}
                disabled={isRefreshing}
                variant="outline"
                className="w-full gap-2 font-mono"
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    [CHECKING STATUS...]
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    [CHECK STATUS]
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What Happens Next */}
      <Card className="card-terminal">
        <CardHeader>
          <CardTitle className="terminal-text flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            WHAT HAPPENS NEXT?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
              <div className="flex-1">
                <p className="font-mono font-medium terminal-text">EMAIL NOTIFICATION</p>
                <p className="text-sm text-muted-foreground font-mono">
                  You'll receive an email once your application has been reviewed
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
              <div className="flex-1">
                <p className="font-mono font-medium terminal-text">AUTOMATIC ACCESS</p>
                <p className="text-sm text-muted-foreground font-mono">
                  Upon approval, you'll automatically gain access to deploy your MCP server
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
              <div className="flex-1">
                <p className="font-mono font-medium terminal-text">7-DAY TRIAL PERIOD</p>
                <p className="text-sm text-muted-foreground font-mono">
                  Your trial will begin immediately upon approval
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="font-mono">
          {'>'} Manual review ensures we provide the best support for your specific use case
          <br />
          {'>'} Most applications are reviewed within 24 hours during business days
          <br />
          {'>'} Check your email for updates on your application status
        </AlertDescription>
      </Alert>
    </div>
  );
} 
