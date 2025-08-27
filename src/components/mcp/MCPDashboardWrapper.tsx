'use client';

import { useState, useEffect } from 'react';
import { MCPJamAgent } from '@mcpgtm/mcp-core';
import { DashboardTabs } from './DashboardTabs';
import { ServerList } from './ServerList';
import { QuickActions } from './QuickActions';
import { type User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

// Helper function to get MCP servers config (mock for now)
async function getMCPServersConfig(userId: string) {
  // This would normally fetch from API
  return {};
}

interface MCPDashboardWrapperProps {
  user: User;
}

export function MCPDashboardWrapper({ user }: MCPDashboardWrapperProps) {
  const [agent, setAgent] = useState<MCPJamAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize MCP agent
  const initializeAgent = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get user's MCP servers config
      const servers = await getMCPServersConfig(user.id);
      
      // Create a new MCPJamAgent instance with empty servers initially
      const newAgent = new MCPJamAgent({
        servers: servers || {},
        onStdErrNotification: (notification) => {
          console.error('MCP Error:', notification.params.content);
        }
      });
      
      setAgent(newAgent);
    } catch (err) {
      console.error('Failed to initialize MCP agent:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize MCP agent');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize on mount
  useEffect(() => {
    initializeAgent();
    
    // Cleanup on unmount
    return () => {
      if (agent) {
        agent.disconnectFromAllServers?.();
      }
    };
  }, [user.id]);

  const reloadAgent = () => {
    initializeAgent();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-lg">Initializing MCP Command Center...</p>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <p className="text-lg text-red-500">Failed to initialize MCP agent</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button 
            onClick={reloadAgent}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* MCP Server Sidebar */}
      <div className="w-80 border-r border-black flex flex-col fixed left-0 top-0 h-screen z-10 bg-background">
        <div className="flex-1 overflow-hidden">
          <ServerList agent={agent} reloadAgent={reloadAgent} />
        </div>
        <div className="border-t border-border p-4">
          <QuickActions agent={agent} />
        </div>
      </div>

      {/* Main Content Area with margin for sidebar */}
      <div className="flex-1 ml-80">
        <DashboardTabs user={user} />
      </div>
    </div>
  );
}