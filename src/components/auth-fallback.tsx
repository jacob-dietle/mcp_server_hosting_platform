'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function AuthFallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    // If we have an OAuth code or error on the root page, redirect to callback
    if (code || error) {
      console.log('[AuthFallback] OAuth response detected on root page, redirecting to callback');
      
      // Preserve all parameters and redirect to the proper callback route
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      searchParams.forEach((value, key) => {
        callbackUrl.searchParams.set(key, value);
      });
      
      // Replace the current history entry so user doesn't see the broken root URL
      window.location.replace(callbackUrl.toString());
    }
  }, [searchParams, router]);

  return null; // This component doesn't render anything
} 
