'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export type UserRole = 'user' | 'admin' | 'super_admin';

interface AdminStatusReturn {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  role: UserRole;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to check if current user has admin privileges
 * Used to exclude admins from trial flows and banners
 */
export function useAdminStatus(): AdminStatusReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-status'],
    queryFn: async () => {
      const supabase = createClient();
      
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { role: 'user' as UserRole, isAdmin: false, isSuperAdmin: false };
      }

      // Check user role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .schema('auth_logic')
        .from('user_roles')
        .select('role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      // If no role found or error, user has default 'user' role
      if (roleError || !roleData) {
        return { role: 'user' as UserRole, isAdmin: false, isSuperAdmin: false };
      }

      const role = roleData.role as UserRole;
      const isAdmin = role === 'admin' || role === 'super_admin';
      const isSuperAdmin = role === 'super_admin';

      return { role, isAdmin, isSuperAdmin };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    isAdmin: data?.isAdmin || false,
    isSuperAdmin: data?.isSuperAdmin || false,
    role: data?.role || 'user',
    isLoading,
    error: error as Error | null,
  };
} 
