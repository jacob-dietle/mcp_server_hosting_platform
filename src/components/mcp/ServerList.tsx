'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { MCPJamAgent } from '@mcpgtm/mcp-core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Play, Square, AlertTriangle } from 'lucide-react';
import { AddServerDialog } from './AddServerDialog';
import { useMCPServersWithImpersonation } from '@/hooks/mcp';
import { useEffectiveUserId } from '@/contexts/ImpersonationContext';
import { useToast } from '@/hooks/core';
import { createClient } from '@/lib/supabase/client';
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

interface ServerListProps {
  agent: MCPJamAgent;
  reloadAgent: () => void;
}

export function ServerList({ agent, reloadAgent }: ServerListProps) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; serverName: string | null }>({
    isOpen: false,
    serverName: null
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const { toast } = useToast();

  // Get current user profile from auth_logic schema
  useEffect(() => {
    const getCurrentUserProfile = async () => {
      try {
        setIsLoadingUser(true);
        const supabase = createClient();
        
        // First get the authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          console.error('Failed to get authenticated user:', authError);
          return;
        }

        // Then get their profile from auth_logic.user_profiles
        const { data: userProfile, error: profileError } = await supabase
          .schema('auth_logic')
          .from('user_profiles')
          .select('id, email, created_at')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Failed to get user profile:', profileError);
          // Fallback to auth user ID if profile not found
          setCurrentUserId(user.id);
        } else if (userProfile) {
          setCurrentUserId(userProfile.id);
        }
      } catch (error) {
        console.error('Error getting user profile:', error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    getCurrentUserProfile();
  }, []);
  
  // Use impersonation-aware MCP servers hook with user profile ID
  const effectiveUserId = useEffectiveUserId(currentUserId);
  const { 
    servers: mcpServers, 
    isLoading: serversLoading, 
    deleteServer,
    refetch: refetchServers 
  } = useMCPServersWithImpersonation(effectiveUserId || '')
  
  // Get agent connection info and merge with MCP servers data
  const [agentServers, setAgentServers] = useState(agent.getAllConnectionInfo())
  
  // Merge agent connection status with MCP server data
  const servers = mcpServers.map(mcpServer => {
    const agentInfo = agentServers.find(as => as.name === mcpServer.name)
    return {
      ...mcpServer,
      connectionStatus: agentInfo?.connectionStatus || 'disconnected'
    }
  })

  // Refresh agent server connection info
  useEffect(() => {
    setAgentServers(agent.getAllConnectionInfo());
    // Reduced polling interval from 1s to 5s to prevent performance issues
    const interval = setInterval(() => {
      setAgentServers(agent.getAllConnectionInfo());
    }, 5000);
    return () => clearInterval(interval);
  }, [agent]);

  const handleConnect = async (serverName: string) => {
    setConnecting(serverName);
    try {
      await agent.connectToServer(serverName);
      toast({
        title: "Connected",
        description: `Successfully connected to ${serverName}`,
      });
    } catch (error) {
      console.error(`Failed to connect to ${serverName}:`, error);
      toast({
        title: "Connection Failed",
        description: `Could not connect to ${serverName}. Check server configuration.`,
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (serverName: string) => {
    try {
      await agent.disconnectFromServer(serverName);
      toast({
        title: "Disconnected",
        description: `Disconnected from ${serverName}`,
      });
    } catch (error) {
      console.error(`Failed to disconnect from ${serverName}:`, error);
      toast({
        title: "Disconnect Failed", 
        description: `Could not disconnect from ${serverName}`,
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteClick = (serverName: string) => {
    setDeleteConfirm({ isOpen: true, serverName });
  };
  
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.serverName) return;
    
    const serverToDelete = deleteConfirm.serverName;
    
    try {
      console.log('[ServerList] Deleting server:', serverToDelete);
      
      // Step 1: Disconnect if connected
      const server = servers.find(s => s.name === serverToDelete);
      if (server?.connectionStatus === 'connected') {
        await agent.disconnectFromServer(serverToDelete);
      }
      
      // Step 2: Remove from agent
      await agent.removeServer(serverToDelete);
      
      // Step 3: Delete from database using impersonation-aware hook
      await deleteServer(serverToDelete);
      
      console.log('[ServerList] Server deleted successfully');
      
      // Step 4: Show success toast
      toast({
        title: "Server Deleted",
        description: `Successfully removed "${serverToDelete}" from your servers.`,
      });
      
      // Step 5: Reload the agent and refetch servers
      reloadAgent();
      refetchServers();
      
    } catch (error) {
      console.error('[ServerList] Failed to delete server:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeleteConfirm({ isOpen: false, serverName: null });
    }
  };
  
  const handleServerAdded = () => {
    reloadAgent();
    refetchServers();
  };

  // Don't render until we have user profile
  if (isLoadingUser || !currentUserId) {
    return (
      <div className="w-64 border-r bg-muted/10 p-4 space-y-4 flex flex-col">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Image src="/orange_icon.svg" alt="MCPGTM Logo" width={24} height={24} />
          <span className="text-lg font-bold text-black dark:text-white font-vcr">MCPGTM</span>
        </div>
        
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold terminal-text text-black dark:text-white">SERVERS</h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground font-mono">
              {isLoadingUser ? 'Loading user profile...' : 'Authenticating...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 border-r bg-muted/10 p-4 space-y-4 flex flex-col">
        {/* Logo Section */}
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Image src="/orange_icon.svg" alt="MCPGTM Logo" width={24} height={24} />
          <span className="text-lg font-bold text-black dark:text-white font-vcr">MCPGTM</span>
        </div>
        
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold terminal-text text-black dark:text-white">SERVERS</h2>
          <Button size="sm" variant="ghost" className="btn-terminal-nested text-xs" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="ml-2">[NEW]</span>
          </Button>
        </div>

        {servers.length > 0 ? (
          <div className="space-y-2 overflow-y-auto">
            {servers.map((server) => (
              <Card key={server.name} className="card-terminal p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm font-mono uppercase">{server.name}</span>
                    <Badge
                      variant={
                        server.connectionStatus === 'connected'
                          ? 'default'
                          : server.connectionStatus === 'error'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {server.connectionStatus}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    {server.connectionStatus === 'disconnected' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConnect(server.name)}
                        disabled={connecting === server.name}
                      >
                        {connecting === server.name ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDisconnect(server.name)}
                      >
                        <Square className="h-3 w-3" />
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleDeleteClick(server.name)}
                      disabled={serversLoading}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div className="border-2 border-dashed border-muted rounded-lg p-6">
              <h3 className="text-sm font-medium text-muted-foreground">
                No Servers Configured
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Click "New" to add your first MCP server connection.
              </p>
            </div>
          </div>
        )}
      </div>
      <AddServerDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onServerAdded={handleServerAdded}
      />
      
      <AlertDialog 
        open={deleteConfirm.isOpen} 
        onOpenChange={(isOpen) => !serversLoading && setDeleteConfirm({ isOpen, serverName: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Server</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete the server "{deleteConfirm.serverName}"?</p>
              <p className="text-sm flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                <AlertTriangle className="h-4 w-4" />
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={serversLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={serversLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {serversLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Server'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 
