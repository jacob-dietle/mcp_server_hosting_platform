'use client'

import { useState, useEffect } from 'react'
import { useAdminUserDetail, useUpdateUserRole } from '@/hooks/admin/use-admin-users'
import type { AdminUserDetail } from '@/contracts/api-contracts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  User,
  Mail,
  Calendar,
  Shield,
  Server,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings,
  Eye,
  Database,
  Zap
} from 'lucide-react'

interface UserDetailModalProps {
  userId: string | null
  isOpen: boolean
  onClose: () => void
  onNavigate?: (direction: 'prev' | 'next') => void
  canNavigate?: { prev: boolean; next: boolean }
}

export default function UserDetailModal({ 
  userId, 
  isOpen, 
  onClose, 
  onNavigate,
  canNavigate = { prev: false, next: false }
}: UserDetailModalProps) {
  const [selectedRole, setSelectedRole] = useState<string>('')
  
  // Data fetching
  const { data: userDetail, isLoading, error, refetch } = useAdminUserDetail(userId)
  const updateRoleMutation = useUpdateUserRole()

  // Update selected role when user data loads
  useEffect(() => {
    if (userDetail?.user?.role) {
      setSelectedRole(userDetail.user.role)
    }
  }, [userDetail?.user?.role])

  const handleRoleUpdate = async () => {
    if (!userId || !selectedRole || selectedRole === userDetail?.user?.role) return
    
    try {
      await updateRoleMutation.mutateAsync({
        userId,
        role: selectedRole as 'user' | 'admin' | 'super_admin'
      })
      refetch()
    } catch (error) {
      console.error('Failed to update user role:', error)
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-600'
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-600'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'healthy':
      case 'success':
        return 'text-success'
      case 'pending':
      case 'warning':
        return 'text-warning'
      case 'failed':
      case 'error':
      case 'unhealthy':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'healthy':
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />
      case 'pending':
      case 'warning':
        return <Clock className="h-4 w-4 text-warning" />
      case 'failed':
      case 'error':
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-mono text-lg terminal-text">USER DETAILS</DialogTitle>
              <DialogDescription className="font-mono text-xs">
                COMPREHENSIVE USER PROFILE AND ACTIVITY
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              {onNavigate && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate('prev')}
                    disabled={!canNavigate.prev}
                    className="font-mono border-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    PREV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate('next')}
                    disabled={!canNavigate.next}
                    className="font-mono border-2"
                  >
                    NEXT
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert className="border-2 border-destructive/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-mono">
              {error.message}
              <Button 
                onClick={() => refetch()} 
                variant="outline" 
                size="sm" 
                className="ml-2 font-mono border-2"
              >
                RETRY
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="card-terminal">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </CardContent>
              </Card>
              <Card className="card-terminal">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-36" />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : userDetail ? (
          <div className="space-y-6">
            {/* User Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="card-terminal">
                <CardHeader>
                  <CardTitle className="flex items-center font-mono terminal-text">
                    <User className="h-5 w-5 mr-2 text-primary" />
                    USER INFORMATION
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{userDetail.user.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <Badge className={`font-mono border-2 ${getRoleBadgeColor(userDetail.user.role)}`}>
                      {userDetail.user.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">
                      JOINED {formatDate(userDetail.user.signup_date)}
                    </span>
                  </div>
                  {userDetail.user.last_login && (
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">
                        LAST LOGIN {formatDate(userDetail.user.last_login)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="card-terminal">
                <CardHeader>
                  <CardTitle className="flex items-center font-mono terminal-text">
                    <Settings className="h-5 w-5 mr-2 text-primary" />
                    ADMIN ACTIONS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-mono font-medium text-foreground">CHANGE ROLE</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger className="font-mono border-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">USER</SelectItem>
                          <SelectItem value="admin">ADMIN</SelectItem>
                          <SelectItem value="super_admin">SUPER ADMIN</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleRoleUpdate}
                        disabled={selectedRole === userDetail.user.role || updateRoleMutation.isPending}
                        className="font-mono"
                        size="sm"
                      >
                        {updateRoleMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'UPDATE'
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="font-mono border-2 w-full">
                      <Eye className="h-4 w-4 mr-2" />
                      VIEW AUDIT LOGS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="card-terminal">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono text-muted-foreground">MCP SERVERS</p>
                      <p className="text-2xl font-bold font-mono terminal-text">
                        {userDetail.user.mcp_servers?.length || 0}
                      </p>
                    </div>
                    <Server className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-terminal">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono text-muted-foreground">DEPLOYMENTS</p>
                      <p className="text-2xl font-bold font-mono text-info">
                        {userDetail.user.deployments?.length || 0}
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-info" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-terminal">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono text-muted-foreground">SUCCESS RATE</p>
                      <p className="text-2xl font-bold font-mono text-success">
                        {userDetail.user.deployments?.filter(d => d.status === 'deployed').length || 0}/{userDetail.user.deployments?.length || 0}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-terminal">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono text-muted-foreground">TRIAL STATUS</p>
                      <p className="text-lg font-bold font-mono text-warning">
                        {userDetail.user.trial_status?.toUpperCase() || 'NO TRIAL'}
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-warning" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Information Tabs */}
            <Tabs defaultValue="servers" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 bg-muted border-2 border-border">
                <TabsTrigger 
                  value="servers" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
                >
                  <Server className="h-4 w-4 mr-2" />
                  MCP SERVERS
                </TabsTrigger>
                <TabsTrigger 
                  value="deployments" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  DEPLOYMENTS
                </TabsTrigger>
                <TabsTrigger 
                  value="activity" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
                >
                  <Database className="h-4 w-4 mr-2" />
                  ACTIVITY LOG
                </TabsTrigger>
              </TabsList>

              <TabsContent value="servers" className="space-y-4">
                {(userDetail.user.mcp_servers?.length || 0) === 0 ? (
                  <Card className="card-terminal">
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="font-mono text-muted-foreground">NO MCP SERVERS CONFIGURED</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userDetail.user.mcp_servers?.map((server: NonNullable<AdminUserDetail['mcp_servers']>[0]) => (
                      <Card key={server.id} className="card-terminal">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="font-mono text-sm terminal-text">{server.name}</CardTitle>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon('active')}
                              <span className={`font-mono text-xs ${getStatusColor('active')}`}>
                                ACTIVE
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-mono text-muted-foreground">TYPE:</span>
                              <span className="font-mono">{server.config.transportType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-mono text-muted-foreground">CREATED:</span>
                              <span className="font-mono">{formatDate(server.created_at)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-mono text-muted-foreground">CREATED:</span>
                              <span className="font-mono">{formatDate(server.created_at)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="deployments" className="space-y-4">
                {(userDetail.user.deployments?.length || 0) === 0 ? (
                  <Card className="card-terminal">
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="font-mono text-muted-foreground">NO DEPLOYMENTS FOUND</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {userDetail.user.deployments?.map((deployment: NonNullable<AdminUserDetail['deployments']>[0]) => (
                      <Card key={deployment.id} className="card-terminal">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="font-mono text-sm terminal-text">{deployment.deployment_name}</CardTitle>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(deployment.status)}
                              <span className={`font-mono text-xs ${getStatusColor(deployment.status)}`}>
                                {deployment.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-mono text-muted-foreground">SERVICE URL:</span>
                              <p className="font-mono">{deployment.service_url || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-mono text-muted-foreground">HEALTH:</span>
                              <p className="font-mono">{deployment.health_status || 'Unknown'}</p>
                            </div>
                            <div>
                              <span className="font-mono text-muted-foreground">CREATED:</span>
                              <p className="font-mono">{formatDate(deployment.created_at)}</p>
                            </div>
                            <div>
                              <span className="font-mono text-muted-foreground">DEPLOYED:</span>
                              <p className="font-mono">{deployment.deployed_at ? formatDate(deployment.deployed_at) : 'N/A'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                {true ? (
                  <Card className="card-terminal">
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="font-mono text-muted-foreground">NO ACTIVITY RECORDED</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-2 border-gray-300">
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="font-mono text-gray-500">ACTIVITY LOG FEATURE COMING SOON</p>
                        <p className="font-mono text-xs text-gray-400 mt-2">This will show user actions and system events</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

