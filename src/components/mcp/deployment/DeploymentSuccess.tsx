'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  ArrowRight,
  Terminal,
  Globe,
  CheckCircle,
  Info,
  Clock,
  Star,
  Play,
  MessageCircle,
  Zap,
  Activity,
  RefreshCw,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useHealthChecks, useHealthCheckStats, useAutomatedHealthChecks } from '@/hooks/deployment/use-health-checks';
import { useDeployment } from '@/hooks/deployment/use-deployment';

interface DeploymentSuccessProps {
  deploymentId: string;
  deploymentName: string;
  serviceUrl: string;
  transportType: 'sse' | 'http';
  onContinue: () => void;
  onViewDetails?: () => void;
  trial?: import('@/contracts/component-contracts').TrialInfo;
}

export function DeploymentSuccess({
  deploymentId,
  deploymentName,
  serviceUrl,
  transportType,
  onContinue,
  onViewDetails,
  trial
}: DeploymentSuccessProps) {
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [copiedConfig, setCopiedConfig] = React.useState(false);
  const [showHealthDetails, setShowHealthDetails] = React.useState(false);

  // Health monitoring hooks
  const { deployment, refetch: refetchDeployment } = useDeployment(deploymentId);
  const { checks, latestCheck, performCheck, refetch: refetchHealthChecks } = useHealthChecks(deploymentId);
  const { stats } = useHealthCheckStats(deploymentId, '1h');
  
  // Start automated health checks every 2 minutes
  useAutomatedHealthChecks(deploymentId, 2);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(serviceUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handlePerformHealthCheck = async () => {
    try {
      await performCheck();
      await refetchDeployment();
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  const getMcpConfig = () => {
    if (transportType === 'http') {
      return `{
  "mcpServers": {
    "${deploymentName}": {
      "url": "${serviceUrl}",
      "transport": {
        "type": "http"
      }
    }
  }
}`
    } else { // SSE
      return `{
  "mcpServers": {
    "${deploymentName}": {
      "url": "${serviceUrl}",
      "transport": {
        "type": "sse"
      }
    }
  }
}`
    }
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(getMcpConfig());
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const getHealthStatusIcon = (status: string | null | undefined) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'unhealthy': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default: return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getHealthStatusColor = (status: string | null) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'unhealthy': return 'text-red-500';
      case 'degraded': return 'text-yellow-500';
      default: return 'text-gray-400';
    }
  };

  const getHealthStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'healthy': return 'default';
      case 'unhealthy': return 'destructive';
      case 'degraded': return 'secondary';
      default: return 'outline';
    }
  };

  const formatResponseTime = (ms: number | null) => {
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center space-y-2">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto animate-in zoom-in-50 duration-500" />
        <h2 className="text-2xl font-bold terminal-text">DEPLOYMENT SUCCESSFUL!</h2>
        <p className="text-muted-foreground font-mono">
          {'>'} YOUR MCP SERVER IS LIVE AND BEING MONITORED
        </p>
      </div>

      {/* Health Status Card */}
      <Card className="card-terminal border-green-500/20">
        <CardHeader>
          <CardTitle className="terminal-text flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-500" />
              HEALTH STATUS
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePerformHealthCheck}
                className="gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Check Now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHealthDetails(!showHealthDetails)}
                className="gap-1"
              >
                {showHealthDetails ? 'Hide' : 'Show'} Details
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Health Status */}
          <div className="flex items-center gap-3">
            {getHealthStatusIcon(deployment?.health_status)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={getHealthStatusBadge(deployment?.health_status) as any}
                  className="font-mono"
                >
                  {deployment?.health_status?.toUpperCase() || 'UNKNOWN'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Last checked: {formatTimestamp(deployment?.last_health_check)}
                </span>
              </div>
              {latestCheck?.response_time_ms && (
                <p className="text-sm text-muted-foreground mt-1">
                  Response time: {formatResponseTime(latestCheck.response_time_ms)}
                </p>
              )}
            </div>
          </div>

          {/* Health Statistics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-sm font-medium">Uptime</span>
              </div>
              <p className="text-lg font-bold text-green-500">
                {stats.uptime}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Activity className="h-3 w-3 text-blue-500" />
                <span className="text-sm font-medium">Checks</span>
              </div>
              <p className="text-lg font-bold text-blue-500">
                {stats.total}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span className="text-sm font-medium">Avg Response</span>
              </div>
              <p className="text-lg font-bold text-yellow-500">
                {formatResponseTime(stats.averageResponseTime)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span className="text-sm font-medium">Healthy</span>
              </div>
              <p className="text-lg font-bold text-green-500">
                {stats.healthy}
              </p>
            </div>
          </div>

          {/* Health Check Details */}
          {showHealthDetails && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-2 border-t">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recent Health Checks</span>
              </div>
              
              {checks.length > 0 ? (
                <ScrollArea className="h-48 w-full rounded-md border p-2">
                  <div className="space-y-2">
                    {checks.slice(0, 10).map((check, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {getHealthStatusIcon(check.status)}
                          <Badge
                            variant={getHealthStatusBadge(check.status) as any}
                            className="text-xs"
                          >
                            {check.status.toUpperCase()}
                          </Badge>
                          {check.status_code && (
                            <Badge variant="outline" className="text-xs font-mono">
                              {check.status_code}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-mono">
                            {formatResponseTime(check.response_time_ms)}
                          </p>
                          <p className="text-muted-foreground">
                            {formatTimestamp(check.checked_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No health checks available yet</p>
                  <p className="text-xs">Health checks will appear here automatically</p>
                </div>
              )}
            </div>
          )}

          {/* Health Status Alert */}
          {deployment?.health_status === 'unhealthy' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Your service is currently unhealthy. Check the logs for more details.
              </AlertDescription>
            </Alert>
          )}

          {deployment?.health_status === 'degraded' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your service is experiencing degraded performance. Response times may be slower than usual.
              </AlertDescription>
            </Alert>
          )}

          {deployment?.health_status === 'healthy' && (
            <Alert className="border-green-500/20 bg-green-50/50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                ✅ Your service is healthy and responding normally!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Service URL Card */}
      <Card className="card-terminal border-green-500/20">
        <CardHeader>
          <CardTitle className="terminal-text flex items-center justify-between">
            SERVICE URL
            <Badge variant="outline" className="gap-1">
              {transportType === 'http' ? (
                <>
                  <Terminal className="h-3 w-3" />
                  HTTP
                </>
              ) : (
                <>
                  <Globe className="h-3 w-3" />
                  SSE
                </>
              )}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded font-mono text-sm break-all">
              {serviceUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyUrl}
              className="shrink-0"
            >
              {copiedUrl ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onViewDetails || onContinue}
            >
              <ExternalLink className="h-4 w-4" />
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Instructions */}
      <Card className="card-terminal">
        <CardHeader>
          <CardTitle className="terminal-text">CONFIGURATION</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertDescription>
              {transportType === 'http' ? (
                <>Add this configuration to your HTTP-compatible MCP client</>
              ) : (
                <>Add this configuration to your SSE-compatible MCP client</>
              )}
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">MCP Configuration</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyConfig}
                className="gap-2"
              >
                {copiedConfig ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="p-4 bg-muted rounded-lg overflow-auto">
              <code className="font-mono text-sm">{getMcpConfig()}</code>
            </pre>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground font-mono">
            <p>{'>'} Service is being monitored automatically every 2 minutes</p>
            <p>{'>'} Health status will update in real-time</p>
            <p>{'>'} View detailed monitoring in the deployments dashboard</p>
          </div>
        </CardContent>
      </Card>

      {/* Trial-Specific Content */}
      {trial && trial.status === 'active' && (
        <>
          {/* Trial Status Card */}
          <Card className="card-terminal border-green-500/20">
            <CardHeader>
              <CardTitle className="terminal-text flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  TRIAL ACTIVE
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="font-mono text-amber-500">
                    {trial.days_remaining} days remaining
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-green-500/20 bg-green-500/5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="font-mono">
                  {'>'} Your deployment is now live and ready for testing!
                  <br />
                  {'>'} Full trial access includes all premium features
                  <br />
                  {'>'} No limitations during your trial period
                </AlertDescription>
              </Alert>

              {/* Trial Benefits */}
              <div className="space-y-2">
                <h4 className="font-medium terminal-text">TRIAL BENEFITS INCLUDED:</h4>
                <div className="grid gap-2">
                  {trial.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Star className="h-3 w-3 text-amber-500" />
                      <span className="font-mono">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trial Onboarding Video */}
          <Card className="card-terminal">
            <CardHeader>
              <CardTitle className="terminal-text flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                GETTING STARTED VIDEO
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                <div className="text-center space-y-2">
                  <Play className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground font-mono">
                    {'>'} ONBOARDING VIDEO PLACEHOLDER
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Learn how to maximize your MCP trial
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium terminal-text">QUICK START CHECKLIST:</h4>
                <div className="space-y-1 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span>✓ Deployment successful</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span>✓ Health monitoring active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    <span>Configure your MCP client with the URL above</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    <span>Test your first automation workflow</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    <span>Explore advanced features and integrations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    <span>Schedule a demo call with our team</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trial Support */}
          <Card className="card-terminal border-blue-500/20">
            <CardHeader>
              <CardTitle className="terminal-text flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-500" />
                TRIAL SUPPORT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert className="border-blue-500/20 bg-blue-500/5">
                <Info className="h-4 w-4 text-blue-500" />
                <AlertDescription className="font-mono">
                  {'>'} Priority support included with your trial
                  <br />
                  {'>'} Get help with setup, configuration, and best practices
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(`mailto:${trial.support_contact}`, '_blank')}
                >
                  <MessageCircle className="h-3 w-3" />
                  Contact Support
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open('/docs', '_blank')}
                >
                  <ExternalLink className="h-3 w-3" />
                  View Documentation
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Continue Button */}
      <div className="flex justify-center">
        <Button 
          onClick={onContinue}
          size="lg"
          className="gap-2 btn-terminal"
        >
          [VIEW DEPLOYMENTS]
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
