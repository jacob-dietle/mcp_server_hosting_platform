'use client';

import { useState } from 'react';
import { MCPJamAgent } from '@mcpgtm/mcp-core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TestTube, 
  RefreshCw, 
  Download, 
  Power,
  Activity,
  Zap,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/core';

interface QuickActionsProps {
  agent: MCPJamAgent;
  onReloadAgent?: () => void;
}

export function QuickActions({ agent, onReloadAgent }: QuickActionsProps) {
  const [testingConnections, setTestingConnections] = useState(false);
  const [refreshingTools, setRefreshingTools] = useState(false);
  const [disconnectingAll, setDisconnectingAll] = useState(false);
  const { toast } = useToast();

  const testAllConnections = async () => {
    setTestingConnections(true);
    try {
      const connectionInfo = agent.getAllConnectionInfo();
      const results = await Promise.allSettled(
        connectionInfo.map(async (info) => {
          const client = agent.getClient(info.name);
          if (client) {
            await client.tools(); // Test with a simple call
            return { server: info.name, success: true };
          }
          throw new Error('Client not found');
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed === 0) {
        toast({
          title: 'All Connections Healthy',
          description: `${successful} servers responded successfully`,
        });
      } else {
        toast({
          title: 'Some Connections Failed',
          description: `${successful} successful, ${failed} failed`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: 'Failed to test server connections',
        variant: 'destructive',
      });
    } finally {
      setTestingConnections(false);
    }
  };

  const refreshAllTools = async () => {
    setRefreshingTools(true);
    try {
      await agent.disconnectFromAllServers();
      await agent.connectToAllServers();
      
      const tools = await agent.getAllTools();
      const totalTools = tools.reduce((sum, server) => sum + server.tools.length, 0);
      
      toast({
        title: 'Tools Refreshed',
        description: `Loaded ${totalTools} tools from ${tools.length} servers`,
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh tools',
        variant: 'destructive',
      });
    } finally {
      setRefreshingTools(false);
    }
  };

  const exportConfig = () => {
    try {
      const connectionInfo = agent.getAllConnectionInfo();
      const config = {
        servers: connectionInfo.map(info => ({
          name: info.name,
          config: info.config,
          capabilities: info.capabilities,
          status: info.connectionStatus
        })),
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-servers-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Config Exported',
        description: 'Server configuration downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export configuration',
        variant: 'destructive',
      });
    }
  };

  const disconnectAll = async () => {
    setDisconnectingAll(true);
    try {
      await agent.disconnectFromAllServers();
      toast({
        title: 'All Servers Disconnected',
        description: 'Successfully disconnected from all servers',
      });
    } catch (error) {
      toast({
        title: 'Disconnect Failed',
        description: 'Failed to disconnect from some servers',
        variant: 'destructive',
      });
    } finally {
      setDisconnectingAll(false);
    }
  };

  const getSystemStatus = () => {
    const connectionInfo = agent.getAllConnectionInfo();
    const connected = connectionInfo.filter(i => i.connectionStatus === 'connected').length;
    const total = connectionInfo.length;
    
    if (total === 0) return { status: 'no-servers', color: 'gray' };
    if (connected === total) return { status: 'all-connected', color: 'green' };
    if (connected === 0) return { status: 'all-disconnected', color: 'red' };
    return { status: 'partial', color: 'yellow' };
  };

  const systemStatus = getSystemStatus();

  return (
    <Card className="card-terminal-no-right p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h3 className="font-semibold terminal-text">QUICK ACTIONS</h3>
        </div>
        
        <Badge 
          variant="outline" 
          className="border-black"
        >
          <div className={`status-led mr-1 ${
            systemStatus.color === 'green' ? 'online' :
            systemStatus.color === 'yellow' ? 'warning' :
            systemStatus.color === 'red' ? 'offline' :
            'offline'
          }`}></div>
          <span className="font-mono uppercase">SYSTEM {systemStatus.status.replace('-', ' ')}</span>
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={testAllConnections}
          disabled={testingConnections}
          className="btn-terminal-nested h-auto py-3 flex flex-col gap-1"
        >
          <TestTube className={`h-4 w-4 ${testingConnections ? 'animate-pulse' : ''}`} />
          <span className="text-xs">Test All</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={refreshAllTools}
          disabled={refreshingTools}
          className="btn-terminal-nested h-auto py-3 flex flex-col gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${refreshingTools ? 'animate-spin' : ''}`} />
          <span className="text-xs">Refresh</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={exportConfig}
          className="btn-terminal-nested h-auto py-3 flex flex-col gap-1"
        >
          <Download className="h-4 w-4" />
          <span className="text-xs">Export</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={disconnectAll}
          disabled={disconnectingAll}
          className="btn-terminal-nested h-auto py-3 flex flex-col gap-1"
        >
          <Power className={`h-4 w-4 ${disconnectingAll ? 'animate-pulse' : ''}`} />
          <span className="text-xs">Disconnect</span>
        </Button>
      </div>

      {onReloadAgent && (
        <div className="mt-3 pt-3 border-t border-black">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReloadAgent}
            className="w-full h-auto py-2 flex items-center justify-center gap-2 btn-terminal-nested"
          >
            <Zap className="h-4 w-4" />
            <span className="text-xs font-mono uppercase">Reload MCP Agent</span>
          </Button>
        </div>
      )}
    </Card>
  );
} 
