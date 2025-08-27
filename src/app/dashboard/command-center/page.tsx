'use client';

import { DashboardTabs } from '@/components/mcp/DashboardTabs';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { type User } from '@supabase/supabase-js';

export default function CommandCenterPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg">Please log in to access the dashboard</p>
        </div>
      </div>
    );
  }

  // Dashboard works without agents - agents are loaded lazily when needed
  // For now, we'll use the wrapper to include MCP functionality when ready
  return <DashboardTabs user={user} />;
} 
