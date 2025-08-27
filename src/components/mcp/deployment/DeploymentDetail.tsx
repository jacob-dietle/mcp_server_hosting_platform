'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  ExternalLink, 
  RefreshCw, 
  Settings, 
  Trash2,
  Square,
  RotateCcw,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Server,
  Loader2
} from 'lucide-react';
import { useDeployment } from '../../../hooks/deployment';
import { useDeployments } from '../../../hooks/deployment';
import { useHealthChecks } from '../../../hooks/deployment';
import { HealthCheckHistory } from './HealthCheckHistory';
import { DeploymentDetailProps } from '../../../contracts/component-contracts';
import { useToast } from '@/hooks/core';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeploymentDetailComponentProps extends DeploymentDetailProps {
  onBack: () => void;
}

export function DeploymentDetail({
  deploymentId,
  onBack,
  className = ''
}: DeploymentDetailComponentProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [stopDialogOpen, setStopDialogOpen] = React.useState(false);
  const [isPerformingAction, setIsPerformingAction] = React.useState(false);
  
  const { toast } = useToast();
  
  const { 
    deployment, 
    isLoading: deploymentLoading, 
    error: deploymentError,
    refetch: refetchDeployment,
    updateStatus
  } = useDeployment(deploymentId);
  
  const { deleteDeployment } = useDeployments();

  const {
    checks,
    isLoading: checksLoading,
    refetch: refetchHealthChecks,
    performCheck,
    isPerformingCheck
  } = useHealthChecks(deploymentId);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'pending': 
      case 'validating':
      case 'deploying':
      case 'building': return 'text-yellow-500';
      case 'stopped':
      case 'cancelled': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'running': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
      case 'validating':
      case 'deploying':
      case 'building': return <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />;
      default: return <Server className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  const handleRestartDeployment = async () => {
    setIsPerformingAction(true);
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false })
      });
      
      if (!response.ok) {
        throw new Error('Failed to restart deployment');
      }
      
      toast({
        title: "Deployment Restarting",
        description: "Your deployment is being restarted. This may take a few minutes.",
      });
      
      await refetchDeployment();
    } catch (error) {
      console.error('Failed to restart deployment:', error);
      toast({
        title: "Restart Failed",
        description: "Failed to restart the deployment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPerformingAction(false);
    }
  };
  
  const handleStopDeployment = async () => {
    setIsPerformingAction(true);
    try {
      await updateStatus('stopped');
      
      toast({
        title: "Deployment Stopped",
        description: "Your deployment has been stopped successfully.",
      });
      
      setStopDialogOpen(false);
      await refetchDeployment();
    } catch (error) {
      console.error('Failed to stop deployment:', error);
      toast({
        title: "Stop Failed",
        description: "Failed to stop the deployment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPerformingAction(false);
    }
  };
  
  const handleDeleteDeployment = async () => {
    setIsPerformingAction(true);
    try {
      await deleteDeployment(deploymentId);
      
      toast({
        title: "Deployment Deleted",
        description: "Your deployment has been deleted successfully.",
      });
      
      // Navigate back after deletion
      onBack();
    } catch (error) {
      console.error('Failed to delete deployment:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the deployment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPerformingAction(false);
      setDeleteDialogOpen(false);
    }
  };
  
  const handleUpdateConfig = () => {
    // TODO: Implement config update modal
    toast({
      title: "Coming Soon",
      description: "Configuration update feature is coming soon.",
    });
  };

  if (deploymentLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            [BACK]
          </Button>
          <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 bg-muted animate-pulse rounded"></div>
          <div className="h-48 bg-muted animate-pulse rounded"></div>
        </div>
      </div>
    );
  }

  if (deploymentError || !deployment) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            [BACK]
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {deploymentError?.message || 'Deployment not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            [BACK]
          </Button>
          <div className="flex items-center gap-3">
            {getStatusIcon(deployment.status)}
            <div>
              <h2 className="text-2xl font-bold terminal-text">{deployment.deployment_name}</h2>
              <p className="text-muted-foreground font-mono">
                {'>'} DEPLOYMENT DETAILS AND MONITORING
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              // Trigger new health check AND refresh deployment data
              try {
                await performCheck()
                await refetchDeployment()
              } catch (error) {
                console.error('Health check failed:', error)
                // Still refresh deployment data even if health check fails
                await refetchDeployment()
              }
            }}
            disabled={isPerformingCheck}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isPerformingCheck ? 'animate-spin' : ''}`} />
            {isPerformingCheck ? '[CHECKING...]' : '[REFRESH]'}
          </Button>
          
          {deployment.service_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(deployment.service_url!, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              [OPEN]
            </Button>
          )}
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-terminal">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {getStatusIcon(deployment.status)}
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className={`text-lg font-bold ${getStatusColor(deployment.status)}`}>
                  {deployment.status?.toUpperCase() || 'UNKNOWN'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={
                deployment.health_status === 'healthy' ? 'status-led online' :
                deployment.health_status === 'degraded' ? 'status-led warning' :
                'status-led offline'
              }></div>
              <div>
                <p className="text-sm font-medium">Health</p>
                <p className={`text-lg font-bold ${
                  deployment.health_status === 'healthy' ? 'text-green-500' :
                  deployment.health_status === 'degraded' ? 'text-yellow-500' :
                  'text-red-500'
                }`}>
                  {deployment.health_status?.toUpperCase() || 'UNKNOWN'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Deployed</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {formatDate(deployment.deployed_at || deployment.created_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Message */}
      {deployment.error_message && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-mono">
            {deployment.error_message}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Deployment Info */}
            <Card className="card-terminal">
              <CardHeader>
                <CardTitle className="terminal-text">DEPLOYMENT INFO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {deployment.service_url && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Service URL</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded font-mono text-sm">
                        {deployment.service_url}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(deployment.service_url!, 'service_url')}
                        className="h-8 w-8 p-0"
                      >
                        {copiedField === 'service_url' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {deployment.connection_string && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Connection String</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded font-mono text-sm">
                        {deployment.connection_string}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(deployment.connection_string!, 'connection_string')}
                        className="h-8 w-8 p-0"
                      >
                        {copiedField === 'connection_string' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Project ID</Label>
                  <Badge variant="outline" className="font-mono text-xs">
                    {deployment.railway_project_id}
                  </Badge>
                </div>

                {deployment.railway_service_id && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Service ID</Label>
                    <Badge variant="outline" className="font-mono text-xs">
                      {deployment.railway_service_id}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuration */}
            <Card className="card-terminal">
              <CardHeader>
                <CardTitle className="terminal-text">CONFIGURATION</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">EmailBison Config</Label>
                  <div className="p-3 bg-muted rounded">
                    <pre className="text-xs font-mono text-muted-foreground">
                      {JSON.stringify(deployment.emailbison_config, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Health Check</Label>
                  <p className="text-sm text-muted-foreground font-mono">
                    {formatDate(deployment.last_health_check)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health">
          <HealthCheckHistory
            deploymentId={deploymentId}
            checks={checks}
            isLoading={checksLoading}
            onRefresh={refetchHealthChecks}
          />
        </TabsContent>

        <TabsContent value="settings">
          <Card className="card-terminal">
            <CardHeader>
              <CardTitle className="terminal-text">DEPLOYMENT ACTIONS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={handleRestartDeployment}
                  disabled={isPerformingAction || deployment?.status === 'stopped'}
                >
                  {isPerformingAction ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  [RESTART DEPLOYMENT]
                </Button>
                
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => setStopDialogOpen(true)}
                  disabled={isPerformingAction || deployment?.status === 'stopped'}
                >
                  <Square className="h-4 w-4" />
                  [STOP DEPLOYMENT]
                </Button>
                
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={handleUpdateConfig}
                  disabled={isPerformingAction}
                >
                  <Settings className="h-4 w-4" />
                  [UPDATE CONFIG]
                </Button>
                
                <Button 
                  variant="destructive" 
                  className="gap-2"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isPerformingAction}
                >
                  <Trash2 className="h-4 w-4" />
                  [DELETE DEPLOYMENT]
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Confirmation Dialogs */}
      <AlertDialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Deployment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop this deployment? You can restart it later from the settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPerformingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleStopDeployment}
              disabled={isPerformingAction}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isPerformingAction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                'Stop Deployment'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deployment</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete "{deployment?.deployment_name}"?</p>
              <p className="text-sm text-red-500">
                This action cannot be undone. All deployment data and logs will be permanently deleted.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPerformingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteDeployment}
              disabled={isPerformingAction}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPerformingAction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Deployment'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper component for labels
function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium ${className}`}>{children}</label>;
}

