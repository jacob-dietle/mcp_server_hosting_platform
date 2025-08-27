'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  RefreshCw, 
  Clock, 
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { HealthCheckHistoryProps } from '../../../contracts/component-contracts';

export function HealthCheckHistory({
  deploymentId,
  checks,
  isLoading = false,
  onRefresh,
  className = ''
}: HealthCheckHistoryProps) {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'unhealthy': return 'text-red-500';
      case 'degraded': return 'text-yellow-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case 'healthy': return 'default';
      case 'unhealthy': return 'destructive';
      case 'degraded': return 'secondary';
      default: return 'outline';
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatResponseTime = (ms: number | null) => {
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getResponseTimeColor = (ms: number | null) => {
    if (ms === null) return 'text-gray-400';
    if (ms < 200) return 'text-green-500';
    if (ms < 1000) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Calculate health statistics
  const stats = React.useMemo(() => {
    if (checks.length === 0) {
      return { healthy: 0, unhealthy: 0, degraded: 0, avgResponseTime: null };
    }

    const healthy = checks.filter(c => c.status === 'healthy').length;
    const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
    const degraded = checks.filter(c => c.status === 'degraded').length;
    
    const responseTimes = checks
      .filter(c => c.response_time_ms !== null)
      .map(c => c.response_time_ms!);
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : null;

    return { healthy, unhealthy, degraded, avgResponseTime };
  }, [checks]);

  const latestCheck = checks[0]; // Assuming checks are sorted by most recent first

  return (
    <Card className={`card-terminal ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5" />
            <CardTitle className="terminal-text">HEALTH CHECKS</CardTitle>
            <Badge variant="outline" className="font-mono">
              {checks.length} checks
            </Badge>
          </div>

          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              [REFRESH]
            </Button>
          )}
        </div>

        {/* Current Status */}
        {latestCheck && (
          <div className="flex items-center gap-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              {getStatusIcon(latestCheck.status)}
              <span className={`font-medium ${getStatusColor(latestCheck.status)}`}>
                {latestCheck.status?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last check: {formatTimestamp(latestCheck.checked_at)}</span>
            </div>

            {latestCheck.response_time_ms !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-3 w-3" />
                <span className={getResponseTimeColor(latestCheck.response_time_ms)}>
                  {formatResponseTime(latestCheck.response_time_ms)}
                </span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-2">
            <div className="status-led online"></div>
            <div>
              <p className="text-sm font-medium">Healthy</p>
              <p className="text-lg font-bold text-green-500">{stats.healthy}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="status-led warning"></div>
            <div>
              <p className="text-sm font-medium">Degraded</p>
              <p className="text-lg font-bold text-yellow-500">{stats.degraded}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="status-led offline"></div>
            <div>
              <p className="text-sm font-medium">Unhealthy</p>
              <p className="text-lg font-bold text-red-500">{stats.unhealthy}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Avg Response</p>
              <p className={`text-lg font-bold ${getResponseTimeColor(stats.avgResponseTime)}`}>
                {formatResponseTime(stats.avgResponseTime)}
              </p>
            </div>
          </div>
        </div>

        {/* Health Check History */}
        <div>
          <h4 className="text-sm font-medium mb-3 terminal-text">RECENT CHECKS</h4>
          
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm p-4">
              <div className="status-led warning animate-pulse"></div>
              Loading health checks...
            </div>
          ) : checks.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm p-4">
              <Activity className="h-4 w-4" />
              No health checks available
            </div>
          ) : (
            <ScrollArea className="h-[300px] w-full border border-border rounded">
              <div className="p-3 space-y-2">
                {checks.map((check, index) => (
                  <div
                    key={check.id || index}
                    className="flex items-center justify-between p-3 rounded border border-border/50 hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(check.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={getStatusBadgeVariant(check.status) as any}
                            className="text-xs"
                          >
                            {check.status?.toUpperCase() || 'UNKNOWN'}
                          </Badge>
                          {check.status_code && (
                            <Badge variant="outline" className="text-xs font-mono">
                              {check.status_code}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {formatTimestamp(check.checked_at)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {check.response_time_ms !== null && (
                        <p className={`text-sm font-mono ${getResponseTimeColor(check.response_time_ms)}`}>
                          {formatResponseTime(check.response_time_ms)}
                        </p>
                      )}
                      {check.error_message && (
                        <p className="text-xs text-red-400 font-mono max-w-[200px] truncate">
                          {check.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

