'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Shield, ShieldX, Loader2, ArrowLeft } from 'lucide-react'
import logger from '@/lib/logger/client'

interface AdminRouteGuardProps {
  children: React.ReactNode
  requiredPermission?: string
  fallbackPath?: string
}

interface UserRole {
  id: string
  user_id: string
  role: 'user' | 'admin' | 'super_admin'
  is_active: boolean
}

interface AdminPermission {
  name: string
  description: string
  category: string
}

interface AdminGuardState {
  loading: boolean
  isAuthenticated: boolean
  hasAdminAccess: boolean
  hasRequiredPermission: boolean
  userRole: UserRole | null
  permissions: AdminPermission[]
  error: string | null
  user: any
}

export default function AdminRouteGuard({ 
  children, 
  requiredPermission,
  fallbackPath = '/' 
}: AdminRouteGuardProps) {
  const router = useRouter()
  const [state, setState] = useState<AdminGuardState>({
    loading: true,
    isAuthenticated: false,
    hasAdminAccess: false,
    hasRequiredPermission: false,
    userRole: null,
    permissions: [],
    error: null,
    user: null
  })

  useEffect(() => {
    checkAdminAccess()
  }, [requiredPermission])

  const checkAdminAccess = async () => {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      logger.debug('Admin route guard: Starting access check', { 
        requiredPermission, 
        requestId 
      })

      setState(prev => ({ ...prev, loading: true, error: null }))

      const supabase = createClient() // No await needed for client components
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        logger.warn('Admin route guard: User not authenticated', { 
          requestId,
          error: authError?.message 
        })
        
        setState(prev => ({
          ...prev,
          loading: false,
          isAuthenticated: false,
          hasAdminAccess: false,
          hasRequiredPermission: false,
          error: 'Authentication required'
        }))
        return
      }

      logger.debug('Admin route guard: User authenticated, checking admin access', {
        userId: user.id,
        email: user.email,
        requestId
      })

      // Call our admin dashboard API to check permissions
      const response = await fetch('/api/admin/dashboard', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        logger.warn('Admin route guard: Authentication failed', { 
          userId: user.id,
          requestId 
        })
        
        setState(prev => ({
          ...prev,
          loading: false,
          isAuthenticated: false,
          hasAdminAccess: false,
          hasRequiredPermission: false,
          error: 'Authentication required'
        }))
        return
      }

      if (response.status === 403) {
        logger.warn('Admin route guard: Admin access denied', { 
          userId: user.id,
          email: user.email,
          requestId 
        })
        
        setState(prev => ({
          ...prev,
          loading: false,
          isAuthenticated: true,
          hasAdminAccess: false,
          hasRequiredPermission: false,
          user,
          error: 'Admin access required'
        }))
        return
      }

      if (!response.ok) {
        throw new Error(`Admin check failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Admin access check failed')
      }

      const permissions = data.data.permissions || []
      const userRole = data.data.user.role
      const hasAdminAccess = ['admin', 'super_admin'].includes(userRole)
      
      // Check specific permission if required
      let hasRequiredPermission = true
      if (requiredPermission) {
        hasRequiredPermission = permissions.some((p: AdminPermission) => 
          p.name === requiredPermission
        )
      }

      logger.info('Admin route guard: Access check completed', {
        userId: user.id,
        email: user.email,
        role: userRole,
        hasAdminAccess,
        hasRequiredPermission,
        requiredPermission,
        permissionCount: permissions.length,
        requestId,
        duration: Date.now() - startTime
      })

      setState(prev => ({
        ...prev,
        loading: false,
        isAuthenticated: true,
        hasAdminAccess,
        hasRequiredPermission,
        userRole: { 
          id: data.data.user.id,
          user_id: data.data.user.id,
          role: userRole,
          is_active: true
        },
        permissions,
        user,
        error: null
      }))

    } catch (error) {
      logger.error('Admin route guard: Access check failed', {
        requiredPermission,
        requestId,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      })

      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Access check failed'
      }))
    }
  }

  const handleGoBack = () => {
    router.push(fallbackPath)
  }

  const handleRetry = () => {
    checkAdminAccess()
  }

  const handleSignIn = () => {
    router.push('/auth/signin')
  }

  // Loading state
  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
            </div>
            <CardTitle>Checking Access</CardTitle>
            <CardDescription>
              Verifying your admin permissions...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Error state
  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <ShieldX className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Access Check Failed</CardTitle>
            <CardDescription>
              Unable to verify your permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                {state.error}
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={handleRetry} variant="outline" className="flex-1">
                Try Again
              </Button>
              <Button onClick={handleGoBack} variant="outline" className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not authenticated
  if (!state.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Shield className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to access this area
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                You need to be signed in to view admin content.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={handleSignIn} className="flex-1">
                Sign In
              </Button>
              <Button onClick={handleGoBack} variant="outline" className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No admin access
  if (!state.hasAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <ShieldX className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Access Denied</CardTitle>
            <CardDescription>
              Admin privileges required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                You don't have the required admin permissions to access this area.
              </AlertDescription>
            </Alert>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Your Role:</strong> {state.userRole?.role || 'user'}</p>
              <p><strong>Email:</strong> {state.user?.email}</p>
            </div>
            <Button onClick={handleGoBack} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No required permission
  if (requiredPermission && !state.hasRequiredPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <ShieldX className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle className="text-yellow-600">Insufficient Permissions</CardTitle>
            <CardDescription>
              Additional permissions required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                You need the "{requiredPermission}" permission to access this area.
              </AlertDescription>
            </Alert>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Your Role:</strong> {state.userRole?.role}</p>
              <p><strong>Your Permissions:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                {state.permissions.map((perm, index) => (
                  <li key={index}>{perm.name}</li>
                ))}
              </ul>
            </div>
            <Button onClick={handleGoBack} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // All checks passed - render children
  return <>{children}</>
} 
