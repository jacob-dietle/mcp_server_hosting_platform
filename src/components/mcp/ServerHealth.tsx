'use client';

import { useState, useEffect } from 'react';
import { MCPJamAgent } from '@mcpgtm/mcp-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  RefreshCw, 
  Clock,
  Zap,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/core';

interface HealthMetrics {
  server: string;
  status: 'connected' | 'error' | 'disconnected';
  responseTime?: number;
  uptime: number;
  errorRate: number;
  lastError?: string;
  capabilities: string[];
  toolCount: number;
}

interface ServerHealthProps {
  agent: MCPJamAgent;
}

export function ServerHealth({ agent }: ServerHealthProps) {
  const [metrics, setMetrics] = useState<HealthMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    loadHealthMetrics();
    const interval = setInterval(loadHealthMetrics, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [agent]);

  const loadHealthMetrics = async () => {
    try {
      const connectionInfo = agent.getAllConnectionInfo();
      const serverTools = await agent.getAllTools();
      
      const healthData: HealthMetrics[] = connectionInfo.map(info => {
        const serverToolData = serverTools.find(st => st.serverName === info.name);
        
        return {
          server: info.name,
          status: info.connectionStatus as 'connected' | 'error' | 'disconnected',
          responseTime: undefined, // Will be calculated by ping
          uptime: info.client ? Date.now() - (info.client as any).connectedAt || 0 : 0,
          errorRate: 0, // TODO: Track error rate over time
          lastError: undefined, // TODO: Store last error
          capabilities: info.capabilities 
            ? Object.keys(info.capabilities).filter(key => (info.capabilities as any)[key])
            : [],
          toolCount: serverToolData?.tools.length || 0,
        };
      });

      // Ping servers to get response times
      const metricsWithPing = await Promise.all(
        healthData.map(async (metric) => {
          try {
            const start = Date.now();
            const client = agent.getClient(metric.server);
            if (client && metric.status === 'connected') {
              await client.tools(); // Simple ping
              metric.responseTime = Date.now() - start;
            }
          } catch (error) {
            metric.responseTime = undefined;
            metric.lastError = error instanceof Error ? error.message : 'Unknown error';
          }
          return metric;
        })
      );

      setMetrics(metricsWithPing);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load health metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load server health metrics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'error':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const reconnectServer = async (serverName: string) => {
    try {
      await agent.disconnectFromServer(serverName);
      await agent.connectToServer(serverName);
      toast({
        title: 'Success',
        description: `Reconnected to ${serverName}`,
      });
      loadHealthMetrics();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to reconnect to ${serverName}`,
        variant: 'destructive',
      });
    }
  };

  const connectedCount = metrics.filter(m => m.status === 'connected').length;
  const errorCount = metrics.filter(m => m.status === 'error').length;
  const disconnectedCount = metrics.filter(m => m.status === 'disconnected').length;

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-black">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold terminal-text">SERVER HEALTH</h2>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-black">
                <div className="status-led online mr-1" />
                <span className="font-mono uppercase">{connectedCount} Connected</span>
              </Badge>
              {errorCount > 0 && (
                <Badge variant="outline" className="border-black">
                  <div className="status-led warning mr-1" />
                  <span className="font-mono uppercase">{errorCount} Warning</span>
                </Badge>
              )}
              {disconnectedCount > 0 && (
                <Badge variant="outline" className="border-black">
                  <div className="status-led offline mr-1" />
                  <span className="font-mono uppercase">{disconnectedCount} Offline</span>
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadHealthMetrics}
              disabled={loading}
              className="h-8 w-8 p-1 btn-terminal-nested"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {metrics.map((metric) => (
            <Card key={metric.server} className="card-terminal relative">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusColor(metric.status)}`} />
              
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(metric.status)}
                    <CardTitle className="text-base terminal-text">{metric.server.toUpperCase()}</CardTitle>
                  </div>
                  
                  {metric.status !== 'connected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reconnectServer(metric.server)}
                      className="h-7 px-2 text-xs btn-terminal-nested"
                    >
                      <span className="font-mono uppercase">Reconnect</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground font-mono uppercase">Response</div>
                      <div className="text-sm font-medium font-mono">
                        {metric.responseTime !== undefined ? `${metric.responseTime}ms` : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground font-mono uppercase">Uptime</div>
                      <div className="text-sm font-medium font-mono">
                        {metric.uptime > 0 ? formatUptime(metric.uptime) : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground font-mono uppercase">Tools</div>
                      <div className="text-sm font-medium font-mono">{metric.toolCount}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground font-mono uppercase">Errors</div>
                      <div className="text-sm font-medium font-mono">{metric.errorRate}%</div>
                    </div>
                  </div>
                </div>
                
                {metric.capabilities.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground mb-1 font-mono uppercase">Capabilities:</div>
                    <div className="flex flex-wrap gap-1">
                      {metric.capabilities.map((cap) => (
                        <Badge key={cap} variant="secondary" className="text-xs border-black">
                          <span className="font-mono uppercase">{cap}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {metric.lastError && (
                  <div className="mt-3 p-2 bg-red-50 border border-black text-xs">
                    <div className="font-medium text-red-700 font-mono uppercase">Last Error:</div>
                    <div className="text-red-600 truncate font-mono">{metric.lastError}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          {metrics.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <p className="font-mono uppercase">No servers configured</p>
              <p className="text-xs font-mono">Add servers to monitor their health</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
} 
