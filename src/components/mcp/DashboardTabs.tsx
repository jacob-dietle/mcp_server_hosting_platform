'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeployTab } from './DeployTab';
import { AgentTab } from './AgentTab';
import { TrialCountdownBanner } from './TrialCountdownBanner';
import { useTrialStatusWithImpersonation } from '@/hooks/trial';
import { useEffectiveUserId } from '@/contexts/ImpersonationContext';
import { useAdminStatus } from '@/hooks/admin';
import { 
  Wrench, 
  Activity, 
  Settings,
  BarChart3,
  Rocket,
  Bot
} from 'lucide-react';
import { type User } from '@supabase/supabase-js';
import { usePostHog } from 'posthog-js/react';

interface DashboardTabsProps {
  user: User;
}

export function DashboardTabs({ user }: DashboardTabsProps) {
  const posthog = usePostHog();

  // Load initial tab from localStorage or default to 'agents'
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('mcp-active-tab');
      // If saved tab was 'chat', redirect to 'agents'
      return savedTab === 'chat' ? 'agents' : (savedTab || 'agents');
    }
    return 'agents';
  });

  // Persist tab changes to localStorage and track
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mcp-active-tab', value);
    }
    
    // Track tab navigation
    posthog?.capture('command_center_tab_changed', {
      from_tab: activeTab,
      to_tab: value,
      user_id: user?.id
    });
  };

  // Get trial status for current user and admin status
  const effectiveUserId = useEffectiveUserId(user?.id || '');
  const trialStatus = useTrialStatusWithImpersonation(effectiveUserId || '');
  const adminStatus = useAdminStatus();

  return (
    <div className="flex h-screen">
      {/* Main Content Area - Full width, no sidebar dependency */}
      <div className="flex-1 flex flex-col">
        {/* Trial Countdown Banner - ONLY for NON-ADMIN users with actual active trials */}
        {!adminStatus.isAdmin && 
         trialStatus.trial && 
         trialStatus.trial.status === 'active' && 
         trialStatus.trial.days_remaining > 0 && (
          <div className="p-4 border-b border-border">
            <TrialCountdownBanner
              trial={trialStatus.trial}
              onUpgrade={() => {
                // Handle upgrade flow
                if (trialStatus.trial?.conversion_url) {
                  window.open(trialStatus.trial.conversion_url, '_blank');
                }
              }}
              onExtend={() => {
                // Handle trial extension (admin feature)
                console.log('Trial extension requested');
              }}
            />
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-6 border-b border-black h-12">
            <TabsTrigger value="agents" className="terminal-tab flex items-center gap-2 font-mono uppercase">
              <Bot className="h-4 w-4" />
              AGENTS
            </TabsTrigger>
            <TabsTrigger value="tools" className="terminal-tab flex items-center gap-2 font-mono uppercase">
              <Wrench className="h-4 w-4" />
              TOOLS
            </TabsTrigger>
            <TabsTrigger value="analytics" className="terminal-tab flex items-center gap-2 font-mono uppercase">
              <BarChart3 className="h-4 w-4" />
              ANALYTICS
            </TabsTrigger>
            <TabsTrigger value="deploy" className="terminal-tab flex items-center gap-2 font-mono uppercase">
              <Rocket className="h-4 w-4" />
              DEPLOY
            </TabsTrigger>
            <TabsTrigger value="health" className="terminal-tab flex items-center gap-2 font-mono uppercase">
              <Activity className="h-4 w-4" />
              HEALTH
            </TabsTrigger>
            <TabsTrigger value="settings" className="terminal-tab flex items-center gap-2 font-mono uppercase">
              <Settings className="h-4 w-4" />
              SETTINGS
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 flex flex-col">
            <TabsContent value="agents" className="flex-1 flex flex-col m-0" forceMount>
              <div className={activeTab === 'agents' ? '' : 'hidden'}>
                <AgentTab />
              </div>
            </TabsContent>

            <TabsContent value="tools" className="flex-1 flex flex-col m-0" forceMount>
              <div className={activeTab === 'tools' ? 'p-4 flex-1 overflow-auto' : 'hidden'}>
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <Wrench className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="text-lg font-semibold">MCP Tools</h3>
                    <p className="text-muted-foreground">
                      This feature will be available once you have configured MCP servers.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Go to the Deploy tab to set up your first MCP server.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="flex-1 flex flex-col m-0" forceMount>
              <div className={activeTab === 'analytics' ? 'p-4 flex-1 overflow-auto' : 'hidden'}>
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Analytics</h3>
                    <p className="text-muted-foreground">
                      Analytics will be available once you have active MCP servers.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Deploy MCP servers and use them to generate analytics data.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="deploy" className="flex-1 flex flex-col m-0" forceMount>
              <div className={activeTab === 'deploy' ? 'p-4 flex-1 overflow-auto' : 'hidden'}>
                <DeployTab userId={user?.id || ''} />
              </div>
            </TabsContent>

            <TabsContent value="health" className="flex-1 flex flex-col m-0" forceMount>
              <div className={activeTab === 'health' ? 'p-4 flex-1 overflow-auto' : 'hidden'}>
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Server Health</h3>
                    <p className="text-muted-foreground">
                      Health monitoring will be available once you have deployed MCP servers.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Monitor the status and performance of your deployed servers.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 flex flex-col m-0" forceMount>
              <div className={activeTab === 'settings' ? 'p-4 flex-1 overflow-auto' : 'hidden'}>
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <Settings className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Settings</h3> 
                    <p className="text-muted-foreground">
                      MCP settings will be available once you have configured MCP servers.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Configure your MCP servers and agent preferences.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
} 
