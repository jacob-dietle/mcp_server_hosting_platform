'use client';

import { useState, useEffect } from 'react';
import { MCPJamAgent } from '@mcpgtm/mcp-core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings, Clock, Zap, Timer } from 'lucide-react';
import { useToast } from '@/hooks/core';
import { createClient } from '@/lib/supabase/client';
import { type User } from '@supabase/supabase-js';

interface TimeoutSettings {
  mcpServerRequestTimeout: number;
  mcpRequestTimeoutResetOnProgress: boolean;
  mcpRequestMaxTotalTimeout: number;
}

interface SettingsTabProps {
  agent: MCPJamAgent;
  user: User;
}

// Persistent state management for unsaved changes
const getPersistedSettings = (userId: string): TimeoutSettings | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(`mcp-settings-draft-${userId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const setPersistedSettings = (userId: string, settings: TimeoutSettings) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`mcp-settings-draft-${userId}`, JSON.stringify(settings));
  } catch {
    // Ignore localStorage errors
  }
};

const clearPersistedSettings = (userId: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`mcp-settings-draft-${userId}`);
  } catch {
    // Ignore localStorage errors
  }
};

export function SettingsTab({ agent, user }: SettingsTabProps) {
  const [settings, setSettings] = useState<TimeoutSettings>({
    mcpServerRequestTimeout: 10000,
    mcpRequestTimeoutResetOnProgress: true,
    mcpRequestMaxTotalTimeout: 60000,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const supabase = createClient(); // No await needed for client components

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [agent, user]);

  // Track changes to detect unsaved modifications
  const [originalSettings, setOriginalSettings] = useState<TimeoutSettings | null>(null);

  useEffect(() => {
    if (originalSettings) {
      const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
      setHasUnsavedChanges(hasChanges);
      
      // Persist draft changes
      if (hasChanges) {
        setPersistedSettings(user.id, settings);
      } else {
        clearPersistedSettings(user.id);
      }
    }
  }, [settings, originalSettings, user.id]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Get current config from agent
      const currentConfig = agent.getConfig();
      
      // Try to load saved settings from database first
      const { data, error } = await supabase
        .schema('auth_logic')
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .eq('setting_type', 'timeout_config')
        .single();

      let loadedSettings = currentConfig;
      if (data && !error) {
        loadedSettings = data.settings as TimeoutSettings;
        // Apply to agent immediately
        agent.updateConfig(loadedSettings);
      }

      // Check for persisted draft changes
      const draftSettings = getPersistedSettings(user.id);
      if (draftSettings) {
        setSettings(draftSettings);
        setOriginalSettings(loadedSettings);
        setHasUnsavedChanges(true);
      } else {
        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Update agent config
      agent.updateConfig(settings);

      // Save to database
      const { error } = await supabase
        .schema('auth_logic')
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setting_type: 'timeout_config',
          settings: settings,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }

      // Update original settings and clear draft
      setOriginalSettings(settings);
      setHasUnsavedChanges(false);
      clearPersistedSettings(user.id);

      toast({
        title: 'Settings Saved',
        description: 'Timeout configuration has been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error Saving Settings',
        description: 'Failed to save timeout configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    const defaults = {
      mcpServerRequestTimeout: 10000,
      mcpRequestTimeoutResetOnProgress: true,
      mcpRequestMaxTotalTimeout: 60000,
    };
    setSettings(defaults);
  };

  const discardChanges = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      setHasUnsavedChanges(false);
      clearPersistedSettings(user.id);
    }
  };

  const handleTimeoutChange = (field: keyof TimeoutSettings, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h2 className="text-lg font-semibold terminal-text">SETTINGS</h2>
        {hasUnsavedChanges && (
          <span className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded font-mono">
            UNSAVED CHANGES
          </span>
        )}
      </div>

      <Card className="card-terminal">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 terminal-text">
            <Clock className="h-4 w-4" />
            TIMEOUT CONFIGURATION
          </CardTitle>
          <CardDescription className="font-mono">
            CONFIGURE TIMEOUT SETTINGS FOR MCP SERVER REQUESTS. THESE SETTINGS AFFECT HOW LONG THE SYSTEM WAITS FOR RESPONSES FROM YOUR CONNECTED SERVERS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="request-timeout" className="flex items-center gap-2 font-mono uppercase">
                <Timer className="h-3 w-3" />
                Request Timeout (ms)
              </Label>
              <Input
                id="request-timeout"
                type="number"
                min="1000"
                max="300000"
                step="1000"
                value={settings.mcpServerRequestTimeout}
                onChange={(e) => handleTimeoutChange('mcpServerRequestTimeout', parseInt(e.target.value))}
                disabled={loading}
                className="input-terminal"
              />
              <p className="text-xs text-muted-foreground font-mono">
                HOW LONG TO WAIT FOR INDIVIDUAL REQUESTS BEFORE TIMING OUT (1-300 SECONDS)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-timeout" className="flex items-center gap-2 font-mono uppercase">
                <Zap className="h-3 w-3" />
                Maximum Total Timeout (ms)
              </Label>
              <Input
                id="max-timeout"
                type="number"
                min="10000"
                max="600000"
                step="5000"
                value={settings.mcpRequestMaxTotalTimeout}
                onChange={(e) => handleTimeoutChange('mcpRequestMaxTotalTimeout', parseInt(e.target.value))}
                disabled={loading}
                className="input-terminal"
              />
              <p className="text-xs text-muted-foreground font-mono">
                MAXIMUM TOTAL TIME TO WAIT ACROSS ALL RETRIES (10-600 SECONDS)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="reset-on-progress" className="font-mono uppercase">Reset Timeout on Progress</Label>
                <p className="text-xs text-muted-foreground font-mono">
                  RESET THE TIMEOUT WHEN THE SERVER SENDS PROGRESS UPDATES
                </p>
              </div>
              <Switch
                id="reset-on-progress"
                checked={settings.mcpRequestTimeoutResetOnProgress}
                onCheckedChange={(checked) => handleTimeoutChange('mcpRequestTimeoutResetOnProgress', checked)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-black">
            <Button 
              onClick={saveSettings} 
              disabled={saving || loading || !hasUnsavedChanges}
              className="flex-1 btn-terminal"
            >
              <span className="font-mono uppercase">{saving ? 'Saving...' : 'Save Settings'}</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={resetToDefaults}
              disabled={loading}
              className="btn-terminal-nested"
            >
              <span className="font-mono uppercase">Reset to Defaults</span>
            </Button>
            {hasUnsavedChanges && (
              <Button 
                variant="outline" 
                onClick={discardChanges}
                disabled={loading}
                className="btn-terminal-nested"
              >
                <span className="font-mono uppercase">Discard Changes</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="card-terminal">
        <CardHeader>
          <CardTitle className="terminal-text">CONFIGURATION INFO</CardTitle>
          <CardDescription className="font-mono">
            CURRENT TIMEOUT SETTINGS BEING USED BY YOUR MCP AGENT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground uppercase">Request Timeout:</span>
              <span>{settings.mcpServerRequestTimeout}ms ({(settings.mcpServerRequestTimeout / 1000).toFixed(1)}s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground uppercase">Max Total Timeout:</span>
              <span>{settings.mcpRequestMaxTotalTimeout}ms ({(settings.mcpRequestMaxTotalTimeout / 1000).toFixed(1)}s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground uppercase">Reset on Progress:</span>
              <span className="uppercase">{settings.mcpRequestTimeoutResetOnProgress ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
