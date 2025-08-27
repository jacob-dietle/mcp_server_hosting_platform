'use client'

import { useState, useMemo } from 'react'
import { useAdminUsers, useExportUsers, type AdminUsersQueryParams } from '@/hooks/admin/use-admin-users'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  Search,
  Filter,
  Download,
  ChevronUp,
  ChevronDown,
  Eye,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Calendar,
  Shield,
  Server,
  Activity
} from 'lucide-react'

interface UserActivityTableProps {
  onUserSelect?: (userId: string) => void
}

type SortField = 'email' | 'role' | 'signup_date' | 'last_login' | 'mcp_servers' | 'deployments'
type SortOrder = 'asc' | 'desc'

export default function UserActivityTable({ onUserSelect }: UserActivityTableProps) {
  // Query parameters state
  const [queryParams, setQueryParams] = useState<AdminUsersQueryParams>({
    limit: 25,
    offset: 0,
    sort_by: 'signup_date',
    sort_order: 'desc'
  })

  // Local UI state
  const [searchInput, setSearchInput] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Data fetching
  const { data, isLoading, error, refetch, isFetching } = useAdminUsers(queryParams)
  const exportMutation = useExportUsers()

  // Computed values
  const users = data?.users || []
  const pagination = data?.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 }
  // Calculate stats from user data since API doesn't return separate filters
  const stats = useMemo(() => {
    if (!data?.users) {
      return { totalUsers: 0, activeUsers: 0, newUsers: 0, adminUsers: 0 }
    }
    
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    return {
      totalUsers: data.users.length,
      activeUsers: data.users.filter(user => {
        const lastActivity = user.last_activity ? new Date(user.last_activity) : new Date(user.signup_date)
        return lastActivity >= sevenDaysAgo
      }).length,
      newUsers: data.users.filter(user => new Date(user.signup_date) >= sevenDaysAgo).length,
      adminUsers: data.users.filter(user => user.role === 'admin' || user.role === 'super_admin').length
    }
  }, [data?.users])

  // Handlers
  const handleSort = (field: SortField) => {
    const newOrder: SortOrder = 
      queryParams.sort_by === field && queryParams.sort_order === 'asc' ? 'desc' : 'asc'
    
    setQueryParams(prev => ({
      ...prev,
      sort_by: field,
      sort_order: newOrder,
      offset: 0 // Reset to first page when sorting
    }))
  }

  const handleSearch = () => {
    setQueryParams(prev => ({
      ...prev,
      search: searchInput.trim() || undefined,
      offset: 0
    }))
  }

  const handleFilterChange = (key: keyof AdminUsersQueryParams, value: any) => {
    setQueryParams(prev => ({
      ...prev,
      [key]: value || undefined,
      offset: 0
    }))
  }

  const handlePageChange = (newOffset: number) => {
    setQueryParams(prev => ({
      ...prev,
      offset: newOffset
    }))
  }

  const handleExport = () => {
    exportMutation.mutate(queryParams)
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-600'
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-600'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getActivityLevelColor = (lastLogin: string | null) => {
    if (!lastLogin) return 'bg-destructive/20 text-destructive border-destructive/50 dark:bg-destructive/10 dark:text-destructive dark:border-destructive/30'
    
    const daysSinceLogin = Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceLogin <= 7) return 'bg-success/20 text-success border-success/50 dark:bg-success/10 dark:text-success dark:border-success/30'
    if (daysSinceLogin <= 30) return 'bg-warning/20 text-warning border-warning/50 dark:bg-warning/10 dark:text-warning dark:border-warning/30'
    return 'bg-destructive/20 text-destructive border-destructive/50 dark:bg-destructive/10 dark:text-destructive dark:border-destructive/30'
  }

  const getActivityLevelText = (lastLogin: string | null) => {
    if (!lastLogin) return 'NEVER'
    
    const daysSinceLogin = Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceLogin === 0) return 'TODAY'
    if (daysSinceLogin === 1) return '1 DAY AGO'
    if (daysSinceLogin <= 7) return `${daysSinceLogin} DAYS AGO`
    if (daysSinceLogin <= 30) return `${daysSinceLogin} DAYS AGO`
    return `${daysSinceLogin} DAYS AGO`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).toUpperCase()
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (queryParams.sort_by !== field) return null
    return queryParams.sort_order === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />
  }

  if (error) {
    return (
      <Card className="card-terminal border-destructive/20">
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-terminal">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-muted-foreground">TOTAL USERS</p>
                <p className="text-2xl font-bold font-mono terminal-text">{stats.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-muted-foreground">ACTIVE USERS</p>
                <p className="text-2xl font-bold font-mono text-success">{stats.activeUsers}</p>
              </div>
              <Activity className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-muted-foreground">NEW USERS</p>
                <p className="text-2xl font-bold font-mono text-info">{stats.newUsers}</p>
              </div>
              <Calendar className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-muted-foreground">ADMIN USERS</p>
                <p className="text-2xl font-bold font-mono text-warning">{stats.adminUsers}</p>
              </div>
              <Shield className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="card-terminal">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-mono terminal-text">USER ACTIVITY TABLE</CardTitle>
              <CardDescription className="font-mono text-xs">
                MANAGE AND MONITOR ALL SYSTEM USERS
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => refetch()}
                variant="outline"
                size="sm"
                disabled={isFetching}
                className="font-mono border-2"
              >
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                REFRESH
              </Button>
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                disabled={exportMutation.isPending}
                className="font-mono border-2"
              >
                {exportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                EXPORT CSV
              </Button>
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                size="sm"
                className="font-mono border-2"
              >
                <Filter className="h-4 w-4 mr-2" />
                FILTERS
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="SEARCH USERS BY EMAIL..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 font-mono border-2"
              />
            </div>
            <Button onClick={handleSearch} className="font-mono">
              SEARCH
            </Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border-2 border-border bg-muted/20">
              <div>
                <label className="text-sm font-mono font-medium text-foreground">ROLE</label>
                <Select
                  value={queryParams.role || ''}
                  onValueChange={(value) => handleFilterChange('role', value)}
                >
                  <SelectTrigger className="font-mono border-2">
                    <SelectValue placeholder="ALL ROLES" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ALL ROLES</SelectItem>
                    <SelectItem value="user">USER</SelectItem>
                    <SelectItem value="admin">ADMIN</SelectItem>
                    <SelectItem value="super_admin">SUPER ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-mono font-medium text-foreground">ACTIVITY</label>
                <Select
                  value={queryParams.activity_level || ''}
                  onValueChange={(value) => handleFilterChange('activity_level', value)}
                >
                  <SelectTrigger className="font-mono border-2">
                    <SelectValue placeholder="ALL ACTIVITY" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ALL ACTIVITY</SelectItem>
                    <SelectItem value="active">ACTIVE</SelectItem>
                    <SelectItem value="inactive">INACTIVE</SelectItem>
                    <SelectItem value="new">NEW</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-mono font-medium text-foreground">FUNNEL STAGE</label>
                <Select
                  value={queryParams.funnel_stage || ''}
                  onValueChange={(value) => handleFilterChange('funnel_stage', value)}
                >
                  <SelectTrigger className="font-mono border-2">
                    <SelectValue placeholder="ALL STAGES" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ALL STAGES</SelectItem>
                    <SelectItem value="signup">SIGNUP</SelectItem>
                    <SelectItem value="trial_applied">TRIAL APPLIED</SelectItem>
                    <SelectItem value="trial_active">TRIAL ACTIVE</SelectItem>
                    <SelectItem value="deployed">DEPLOYED</SelectItem>
                    <SelectItem value="converted">CONVERTED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-mono font-medium text-foreground">PAGE SIZE</label>
                <Select
                  value={String(queryParams.limit)}
                  onValueChange={(value) => handleFilterChange('limit', parseInt(value))}
                >
                  <SelectTrigger className="font-mono border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 ROWS</SelectItem>
                    <SelectItem value="25">25 ROWS</SelectItem>
                    <SelectItem value="50">50 ROWS</SelectItem>
                    <SelectItem value="100">100 ROWS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="border-2 border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead 
                    className="font-mono font-bold cursor-pointer hover:bg-muted/80 border-r-2 border-border"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center">
                      EMAIL
                      <SortIcon field="email" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-mono font-bold cursor-pointer hover:bg-muted/80 border-r-2 border-border"
                    onClick={() => handleSort('role')}
                  >
                    <div className="flex items-center">
                      ROLE
                      <SortIcon field="role" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-mono font-bold cursor-pointer hover:bg-muted/80 border-r-2 border-border"
                    onClick={() => handleSort('signup_date')}
                  >
                    <div className="flex items-center">
                      SIGNUP DATE
                      <SortIcon field="signup_date" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-mono font-bold cursor-pointer hover:bg-muted/80 border-r-2 border-border"
                    onClick={() => handleSort('last_login')}
                  >
                    <div className="flex items-center">
                      LAST LOGIN
                      <SortIcon field="last_login" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-mono font-bold cursor-pointer hover:bg-muted/80 border-r-2 border-border"
                    onClick={() => handleSort('mcp_servers')}
                  >
                    <div className="flex items-center">
                      MCP SERVERS
                      <SortIcon field="mcp_servers" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-mono font-bold cursor-pointer hover:bg-muted/80 border-r-2 border-border"
                    onClick={() => handleSort('deployments')}
                  >
                    <div className="flex items-center">
                      DEPLOYMENTS
                      <SortIcon field="deployments" />
                    </div>
                  </TableHead>
                  <TableHead className="font-mono font-bold border-r-2 border-border">
                    TRIAL STATUS
                  </TableHead>
                  <TableHead className="font-mono font-bold">
                    ACTIONS
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="text-muted-foreground font-mono">
                        NO USERS FOUND
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow 
                      key={user.id} 
                      className="hover:bg-muted/20 cursor-pointer border-b-2 border-border"
                      onClick={() => onUserSelect?.(user.id)}
                    >
                      <TableCell className="font-mono border-r-2 border-border">
                        {user.email}
                      </TableCell>
                      <TableCell className="border-r-2 border-border">
                        <Badge className={`font-mono border-2 ${getRoleBadgeColor(user.role)}`}>
                          {user.role.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono border-r-2 border-border">
                        {formatDate(user.signup_date)}
                      </TableCell>
                      <TableCell className="border-r-2 border-border">
                        <Badge className={`font-mono border-2 ${getActivityLevelColor(user.last_login)}`}>
                          {getActivityLevelText(user.last_login)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono border-r-2 border-border text-center">
                        <div className="flex items-center justify-center">
                          <Server className="h-4 w-4 mr-1 text-primary" />
                          {user.mcp_server_count}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono border-r-2 border-border text-center">
                        <div className="flex items-center justify-center">
                          <Activity className="h-4 w-4 mr-1 text-info" />
                          {user.deployment_count}
                        </div>
                      </TableCell>
                      <TableCell className="border-r-2 border-border">
                        {user.trial_status ? (
                          <Badge 
                            className={`font-mono border-2 ${
                              user.trial_status === 'active' ? 'bg-success/20 text-success border-success/50' :
                              user.trial_status === 'applied' ? 'bg-warning/20 text-warning border-warning/50' :
                              user.trial_status === 'expired' ? 'bg-destructive/20 text-destructive border-destructive/50' :
                              'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {user.trial_status.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">NO TRIAL</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onUserSelect?.(user.id)
                          }}
                          className="font-mono border-2"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          VIEW
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && users.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm font-mono text-muted-foreground">
                SHOWING {((pagination.page - 1) * pagination.limit) + 1} TO {Math.min(pagination.page * pagination.limit, pagination.total)} OF {pagination.total} USERS
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                                      disabled={pagination.page === 1}
                  className="font-mono border-2"
                >
                  PREVIOUS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="font-mono border-2"
                >
                  NEXT
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

