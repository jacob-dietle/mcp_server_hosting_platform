'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { 
  UserCheck,
  Users, 
  Clock, 
  Zap, 
  Eye, 
  EyeOff,
  AlertTriangle,
  Search,
  Loader2,
  LogOut,
  UserX
} from 'lucide-react'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import type { AdminUserDetail } from '@/contracts/api-contracts'

interface UserCard {
  user: AdminUserDetail
  onImpersonate: (userId: string) => void
  isLoading: boolean
}

function UserCard({ user, onImpersonate, isLoading }: UserCard) {
  const getTrialStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">PENDING</Badge>
      case 'active':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">ACTIVE TRIAL</Badge>
      case 'expired':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">EXPIRED</Badge>
      case 'converted':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">CONVERTED</Badge>
      default:
        return <Badge variant="outline" className="bg-muted text-muted-foreground">NO TRIAL</Badge>
    }
  }

  return (
    <Card className="card-terminal hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-mono terminal-text">{user.email}</CardTitle>
          </div>
          {getTrialStatusBadge(user.trial_status || 'none')}
        </div>
        <CardDescription className="font-mono text-xs">
          JOINED {new Date(user.signup_date).toLocaleDateString().toUpperCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => onImpersonate(user.id)}
          disabled={isLoading}
          className="w-full font-mono btn-terminal"
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              STARTING...
            </>
          ) : (
            <>
              <Eye className="h-3 w-3 mr-2" />
              [IMPERSONATE USER]
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function UserImpersonationPanel() {
  const {
    isImpersonating,
    impersonatedUserEmail,
    candidates,
    isLoading,
    error,
    startImpersonation,
    endImpersonation,
    refreshCandidates,
    clearError
  } = useImpersonation()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Load candidates on mount
  useEffect(() => {
    refreshCandidates()
  }, [refreshCandidates])

  const handleImpersonate = async (userId: string) => {
    setSelectedUserId(userId)
    try {
      await startImpersonation(userId)
      setSelectedUserId(null)
    } catch (error) {
      setSelectedUserId(null)
      // Error is handled by context
    }
  }

  const handleEndImpersonation = async () => {
    try {
      await endImpersonation()
    } catch (error) {
      // Error is handled by context
    }
  }

  const filterUsers = (users: AdminUserDetail[]) => {
    if (!searchTerm) return users
    return users.filter(user => 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  if (isImpersonating) {
    return (
      <Card className="card-terminal border-amber-500">
        <CardHeader>
          <CardTitle className="flex items-center font-mono terminal-text">
            <Eye className="h-5 w-5 mr-2 text-amber-500" />
            ACTIVE IMPERSONATION SESSION
          </CardTitle>
          <CardDescription className="font-mono">
            YOU ARE CURRENTLY VIEWING AS ANOTHER USER
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4 text-amber-600" />
              <span className="font-mono text-sm font-medium text-amber-800 dark:text-amber-200">
                IMPERSONATING: {impersonatedUserEmail}
              </span>
            </div>
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-mono">
              SESSION ACTIVE
            </Badge>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-mono text-sm">
              {'>'} You are seeing the trial flow as this user would see it
              <br />
              {'>'} All trial statuses and deployment options reflect their account
              <br />
              {'>'} Changes made will affect their actual account
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button
              onClick={handleEndImpersonation}
              disabled={isLoading}
              className="flex-1 gap-2 btn-terminal bg-red-600 hover:bg-red-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              [END IMPERSONATION]
            </Button>
            <Button
              onClick={refreshCandidates}
              disabled={isLoading}
              variant="outline"
              className="gap-2 font-mono border-2"
            >
              <Users className="h-4 w-4" />
              [SWITCH USER]
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-terminal">
      <CardHeader>
        <CardTitle className="flex items-center font-mono terminal-text">
          <Users className="h-5 w-5 mr-2 text-primary" />
          USER IMPERSONATION PANEL
        </CardTitle>
        <CardDescription className="font-mono">
          TEST TRIAL FLOWS AS DIFFERENT USER TYPES
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-mono">
              {error}
              <Button 
                onClick={clearError} 
                variant="outline" 
                size="sm" 
                className="ml-2 font-mono border-2"
              >
                DISMISS
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 font-mono"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={refreshCandidates}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="gap-2 font-mono border-2"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Users className="h-3 w-3" />
              )}
              REFRESH
            </Button>
          </div>
        </div>

        {candidates && (
          <Tabs defaultValue="no_trial" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 bg-muted border-2 border-border">
              <TabsTrigger 
                value="no_trial" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-xs"
              >
                NO TRIAL ({candidates.no_trial.length})
              </TabsTrigger>
              <TabsTrigger 
                value="pending_trial" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-xs"
              >
                PENDING ({candidates.pending_trial.length})
              </TabsTrigger>
              <TabsTrigger 
                value="active_trial" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-xs"
              >
                ACTIVE ({candidates.active_trial.length})
              </TabsTrigger>
              <TabsTrigger 
                value="expired_trial" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-xs"
              >
                EXPIRED ({candidates.expired_trial.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="no_trial" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filterUsers(candidates.no_trial).map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onImpersonate={handleImpersonate}
                    isLoading={isLoading && selectedUserId === user.id}
                  />
                ))}
                {filterUsers(candidates.no_trial).length === 0 && (
                  <div className="col-span-2 text-center py-8">
                    <UserX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground font-mono">NO USERS FOUND</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="pending_trial" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filterUsers(candidates.pending_trial).map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onImpersonate={handleImpersonate}
                    isLoading={isLoading && selectedUserId === user.id}
                  />
                ))}
                {filterUsers(candidates.pending_trial).length === 0 && (
                  <div className="col-span-2 text-center py-8">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground font-mono">NO PENDING TRIALS</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="active_trial" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filterUsers(candidates.active_trial).map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onImpersonate={handleImpersonate}
                    isLoading={isLoading && selectedUserId === user.id}
                  />
                ))}
                {filterUsers(candidates.active_trial).length === 0 && (
                  <div className="col-span-2 text-center py-8">
                    <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground font-mono">NO ACTIVE TRIALS</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="expired_trial" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filterUsers(candidates.expired_trial).map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onImpersonate={handleImpersonate}
                    isLoading={isLoading && selectedUserId === user.id}
                  />
                ))}
                {filterUsers(candidates.expired_trial).length === 0 && (
                  <div className="col-span-2 text-center py-8">
                    <UserX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground font-mono">NO EXPIRED TRIALS</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {!candidates && !isLoading && (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground font-mono mb-2">NO CANDIDATES LOADED</p>
            <Button
              onClick={refreshCandidates}
              variant="outline"
              className="gap-2 font-mono border-2"
            >
              <Users className="h-4 w-4" />
              LOAD USERS
            </Button>
          </div>
        )}

        {isLoading && !candidates && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground font-mono">LOADING USERS...</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 
