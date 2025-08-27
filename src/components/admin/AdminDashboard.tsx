'use client'

import { useEffect, useState } from 'react'
import AdminRouteGuard from '@/components/admin-route-guard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  Users, 
  Server, 
  Activity, 
  Settings,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  BarChart3,
  UserCheck
} from 'lucide-react'
import logger from '@/lib/logger'
import UserActivityTable from '@/components/admin/UserActivityTable'
import UserDetailModal from '@/components/admin/UserDetailModal'
import UserImpersonationPanel from '@/components/admin/UserImpersonationPanel'
import TrialManagementPanel from '@/components/admin/TrialManagementPanel'

interface DashboardData {
  user: {
    id: string
    email: string
    role: string
  }
  permissions: Array<{
    name: string
    description: string
    category: string
  }>
  stats: {
    deployments?: {
      total: number
      active: number
      healthy: number
      recent: any[]
    }
    users?: {
      totalUsers: number
      adminUsers: number
      superAdminUsers: number
      recentSignups: number
    }
  }
  recentActivities: Array<{
    id: string
    action: string
    resource_type: string
    success: boolean
    created_at: string
    user_email: string
  }>
  systemInfo: {
    timestamp: string
    requestId: string
    version: string
  }
}

export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      logger.debug('Loading admin dashboard data', { requestId })
      
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/dashboard', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to load dashboard: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load dashboard data')
      }

      logger.info('Admin dashboard data loaded successfully', {
        requestId,
        duration: Date.now() - startTime,
        permissionCount: result.data.permissions?.length || 0,
        hasDeploymentStats: !!result.data.stats?.deployments,
        hasUserStats: !!result.data.stats?.users
      })

      setDashboardData(result.data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard'
      
      logger.error('Failed to load admin dashboard data', {
        requestId,
        duration: Date.now() - startTime,
        error: errorMessage
      })
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-600'
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-600'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getPermissionCategoryIcon = (category: string) => {
    switch (category) {
      case 'dashboard': return Shield
      case 'deployments': return Server
      case 'users': return Users
      case 'system': return Settings
      case 'analytics': return Activity
      default: return Eye
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).toUpperCase()
  }

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId)
    setIsUserModalOpen(true)
  }

  const handleCloseUserModal = () => {
    setIsUserModalOpen(false)
    setSelectedUserId(null)
  }

  return (
    <AdminRouteGuard requiredPermission="admin_dashboard_access">
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card shadow-sm border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold terminal-text">ADMIN COMMAND CENTER</h1>
                <p className="text-muted-foreground font-mono">{'>'} MCP GTM DEPLOYMENT MANAGEMENT SYSTEM</p>
              </div>
              <div className="flex items-center space-x-4">
                {dashboardData && (
                  <>
                    <Badge className={`font-mono border-2 ${getRoleColor(dashboardData.user.role)}`}>
                      {dashboardData.user.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground font-mono">
                      {dashboardData.user.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-muted-foreground font-mono">LOADING DASHBOARD...</p>
              </div>
            </div>
          )}

          {error && (
            <Alert className="mb-6 border-2 border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-mono">
                {error}
                <Button 
                  onClick={loadDashboardData} 
                  variant="outline" 
                  size="sm" 
                  className="ml-2 font-mono border-2"
                >
                  RETRY
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {dashboardData && (
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5 bg-muted border-2 border-border">
                <TabsTrigger 
                  value="overview" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  OVERVIEW
                </TabsTrigger>
                <TabsTrigger 
                  value="users" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
                >
                  <Users className="h-4 w-4 mr-2" />
                  USERS
                </TabsTrigger>
                <TabsTrigger 
                  value="trials" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  TRIALS
                </TabsTrigger>
                <TabsTrigger 
                  value="funnel" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  FUNNEL
                </TabsTrigger>
                <TabsTrigger 
                  value="impersonation" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  TESTING
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {dashboardData.stats.deployments && (
                    <>
                      <Card className="card-terminal">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium font-mono">TOTAL DEPLOYMENTS</CardTitle>
                          <Server className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold font-mono terminal-text">{dashboardData.stats.deployments.total}</div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {dashboardData.stats.deployments.active} ACTIVE
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card className="card-terminal">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium font-mono">HEALTHY SERVICES</CardTitle>
                          <CheckCircle className="h-4 w-4 text-success" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold font-mono text-success">
                            {dashboardData.stats.deployments.healthy}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {Math.round((dashboardData.stats.deployments.healthy / dashboardData.stats.deployments.total) * 100)}% HEALTHY
                          </p>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {dashboardData.stats.users && (
                    <>
                      <Card className="card-terminal">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium font-mono">TOTAL USERS</CardTitle>
                          <Users className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold font-mono terminal-text">{dashboardData.stats.users.totalUsers}</div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {dashboardData.stats.users.recentSignups} THIS WEEK
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card className="card-terminal">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium font-mono">ADMIN USERS</CardTitle>
                          <Shield className="h-4 w-4 text-warning" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold font-mono text-warning">
                            {dashboardData.stats.users.adminUsers + dashboardData.stats.users.superAdminUsers}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {dashboardData.stats.users.superAdminUsers} SUPER ADMINS
                          </p>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Permissions */}
                  <Card className="card-terminal">
                    <CardHeader>
                      <CardTitle className="flex items-center font-mono terminal-text">
                        <Shield className="h-5 w-5 mr-2 text-primary" />
                        YOUR PERMISSIONS
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        ACCESS LEVELS GRANTED TO YOUR ACCOUNT
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {dashboardData.permissions.map((permission, index) => {
                          const IconComponent = getPermissionCategoryIcon(permission.category)
                          return (
                            <div key={index} className="flex items-start space-x-3 p-3 border-2 border-border bg-muted/20">
                              <IconComponent className="h-4 w-4 mt-0.5 text-primary" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium font-mono terminal-text">
                                  {permission.name.replace(/_/g, ' ').toUpperCase()}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">{permission.description}</p>
                              </div>
                              <Badge variant="outline" className="text-xs font-mono border-2">
                                {permission.category.toUpperCase()}
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Activities */}
                  <Card className="card-terminal">
                    <CardHeader>
                      <CardTitle className="flex items-center font-mono terminal-text">
                        <Activity className="h-5 w-5 mr-2 text-primary" />
                        RECENT ADMIN ACTIVITIES
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        LATEST ADMINISTRATIVE ACTIONS IN THE SYSTEM
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {dashboardData.recentActivities.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4 font-mono">
                            NO RECENT ACTIVITIES
                          </p>
                        ) : (
                          dashboardData.recentActivities.map((activity) => (
                            <div key={activity.id} className="flex items-start space-x-3 p-3 border-2 border-border bg-muted/20">
                              <div className={`p-1 border-2 ${activity.success ? 'bg-success/20 border-success/50' : 'bg-destructive/20 border-destructive/50'}`}>
                                {activity.success ? (
                                  <CheckCircle className="h-3 w-3 text-success" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3 text-destructive" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium font-mono terminal-text">
                                  {activity.action.replace(/_/g, ' ').toUpperCase()}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  BY {activity.user_email} • {formatDate(activity.created_at)}
                                </p>
                                {activity.resource_type && (
                                  <Badge variant="outline" className="text-xs mt-1 font-mono border-2">
                                    {activity.resource_type.toUpperCase()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* System Info */}
                <Card className="card-terminal">
                  <CardHeader>
                    <CardTitle className="flex items-center font-mono terminal-text">
                      <Settings className="h-5 w-5 mr-2 text-primary" />
                      SYSTEM INFORMATION
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="font-medium font-mono terminal-text">VERSION</p>
                        <p className="text-muted-foreground font-mono">{dashboardData.systemInfo.version}</p>
                      </div>
                      <div>
                        <p className="font-medium font-mono terminal-text">LAST UPDATED</p>
                        <p className="text-muted-foreground font-mono">{formatDate(dashboardData.systemInfo.timestamp)}</p>
                      </div>
                      <div>
                        <p className="font-medium font-mono terminal-text">REQUEST ID</p>
                        <p className="text-muted-foreground font-mono text-xs">{dashboardData.systemInfo.requestId}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="space-y-6">
                <UserActivityTable onUserSelect={handleUserSelect} />
              </TabsContent>

              <TabsContent value="trials" className="space-y-6">
                <TrialManagementPanel />
              </TabsContent>

              <TabsContent value="funnel" className="space-y-6">
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-lg font-mono font-semibold terminal-text mb-2">CONVERSION FUNNEL CHART</h3>
                  <p className="text-muted-foreground font-mono text-sm">Component will be implemented in upcoming steps</p>
                </div>
              </TabsContent>

              <TabsContent value="impersonation" className="space-y-6">
                <UserImpersonationPanel />
              </TabsContent>
            </Tabs>
          )}

          {/* User Detail Modal */}
          <UserDetailModal
            userId={selectedUserId}
            isOpen={isUserModalOpen}
            onClose={handleCloseUserModal}
          />
        </div>
      </div>
    </AdminRouteGuard>
  )
} 
