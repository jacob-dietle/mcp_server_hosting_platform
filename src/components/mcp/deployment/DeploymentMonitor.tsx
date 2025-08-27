'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Building, 
  Rocket,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Terminal,
  Globe,
  Activity
} from 'lucide-react';
import { useDeployment } from '../../../hooks/deployment';
import { DeploymentStatus } from '../../../../types/database';

interface DeploymentMonitorProps {
  deploymentId: string;
  onComplete: (deployment: any) => void;
  onError?: (error: string) => void;
}

const STATUS_CONFIG = {
  building: {
    icon: Building,
    color: 'bg-blue-500',
    progress: 25,
    title: 'Building',
    description: 'Cloud platform is building your MCP server...'
  },
  deploying: {
    icon: Rocket,
    color: 'bg-yellow-500',
    progress: 65,
    title: 'Deploying',
    description: 'Cloud platform is deploying your service...'
  },
  running: {
    icon: CheckCircle2,
    color: 'bg-green-500',
    progress: 100,
    title: 'Running',
    description: 'Your MCP server is live and ready!'
  },
  failed: {
    icon: AlertCircle,
    color: 'bg-red-500',
    progress: 0,
    title: 'Failed',
    description: 'Deployment failed. Check logs for details.'
  }
};

export function DeploymentMonitor({ 
  deploymentId, 
  onComplete,
  onError 
}: DeploymentMonitorProps) {
  const { deployment, isLoading, error } = useDeployment(deploymentId);
  const [timeElapsed, setTimeElapsed] = React.useState(0);

  // Timer for elapsed time
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle deployment completion
  React.useEffect(() => {
    if (deployment?.status === 'running') {
      setTimeout(() => {
        onComplete(deployment);
      }, 2000); // Give users a moment to see the success state
    } else if (deployment?.status === 'failed' && onError) {
      onError(deployment.error_message || 'Deployment failed');
    }
  }, [deployment?.status, onComplete, onError, deployment]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading || !deployment) {
    return (
      <Card className="card-terminal">
        <CardContent className="flex items-center gap-3 p-6">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="font-mono">Initializing deployment...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to monitor deployment: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const statusConfig = STATUS_CONFIG[deployment.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.building;
  const Icon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <Card className="card-terminal">
        <CardHeader>
          <CardTitle className="terminal-text flex items-center justify-between">
            DEPLOYMENT PROGRESS
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(timeElapsed)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Icon and Title */}
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${statusConfig.color}`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold terminal-text">
                {statusConfig.title}
              </h3>
              <p className="text-muted-foreground font-mono text-sm">
                {statusConfig.description}
              </p>
            </div>
            <Badge 
              variant={deployment.status === 'running' ? 'default' : 'secondary'}
              className="uppercase"
            >
              {deployment.status}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-mono">Progress</span>
              <span className="font-mono">{statusConfig.progress}%</span>
            </div>
            <Progress 
              value={statusConfig.progress} 
              className="h-2"
            />
          </div>

          {/* Service Details */}
          {deployment.service_url && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium terminal-text">Service URL</span>
                <div className="flex items-center gap-2">
                  {deployment.service_url.includes('/sse') ? (
                    <Badge variant="outline" className="gap-1">
                      <Globe className="h-3 w-3" />
                      SSE
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Terminal className="h-3 w-3" />
                      HTTP
                    </Badge>
                  )}
                </div>
              </div>
              <code className="block p-2 bg-background rounded text-xs font-mono break-all">
                {deployment.service_url}
              </code>
              {deployment.status === 'running' && (
                <div className="flex gap-2 mt-2">
                                     <button
                     onClick={() => deployment.service_url && window.open(deployment.service_url, '_blank')}
                     className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                   >
                     <ExternalLink className="h-3 w-3" />
                     Test Endpoint
                   </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Logs */}
      {deployment.logs && deployment.logs.length > 0 && (
        <Card className="card-terminal">
          <CardHeader>
            <CardTitle className="terminal-text flex items-center gap-2">
              <Activity className="h-4 w-4" />
              RECENT ACTIVITY
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {deployment.logs.slice(0, 5).map((log, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-2 bg-muted/30 rounded text-xs font-mono"
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  log.log_level === 'error' ? 'bg-red-500' :
                  log.log_level === 'warn' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-muted-foreground">
                    {log.created_at ? new Date(log.created_at).toLocaleTimeString() : '--:--:--'}
                  </div>
                  <div className="break-words">{log.message}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Status-specific messages */}
      {deployment.status === 'building' && (
        <Alert>
          <Building className="h-4 w-4" />
          <AlertDescription>
            Cloud platform is building your Docker container. This typically takes 1-2 minutes.
          </AlertDescription>
        </Alert>
      )}

      {deployment.status === 'deploying' && (
        <Alert>
          <Rocket className="h-4 w-4" />
          <AlertDescription>
            Cloud platform is deploying your service. Your MCP server will be available shortly.
          </AlertDescription>
        </Alert>
      )}

      {deployment.status === 'running' && (
        <Alert className="border-green-500/20 bg-green-50/50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ✅ Your MCP server is now live and ready to use!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
} 
