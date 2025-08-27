'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Server, AlertCircle } from 'lucide-react';
import { DeploymentCard } from './DeploymentCard';
import { DeploymentListProps } from '../../../contracts/component-contracts';

export function DeploymentList({
  deployments,
  isLoading = false,
  onRefresh,
  onDeploymentClick,
  onDeleteDeployment,
  className = ''
}: DeploymentListProps) {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold terminal-text">DEPLOYMENTS</h3>
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="card-terminal">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!deployments || deployments.length === 0) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold terminal-text">DEPLOYMENTS</h3>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              [REFRESH]
            </Button>
          )}
        </div>

        <Card className="card-terminal border-dashed border-2 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold terminal-text mb-2">
              NO DEPLOYMENTS FOUND
            </h3>
            <p className="text-muted-foreground text-center font-mono">
              {'>'} CREATE YOUR FIRST MCP SERVER DEPLOYMENT<br />
              {'>'} CLICK THE [NEW DEPLOYMENT] BUTTON ABOVE
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold terminal-text">
          DEPLOYMENTS ({deployments.length})
        </h3>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            [REFRESH]
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deployments.map((deployment) => (
          <DeploymentCard
            key={deployment.id}
            deployment={deployment}
            onClick={() => onDeploymentClick?.(deployment)}
            onDelete={onDeleteDeployment ? () => onDeleteDeployment(deployment.id) : undefined}
            showActions={true}
          />
        ))}
      </div>

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-terminal">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="status-led online"></div>
              <div>
                <p className="text-sm font-medium">Running</p>
                <p className="text-2xl font-bold text-green-500">
                  {deployments.filter(d => d.status === 'running').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="status-led warning"></div>
              <div>
                <p className="text-sm font-medium">Building</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {deployments.filter(d => 
                    ['pending', 'validating', 'deploying', 'building'].includes(d.status || '')
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="status-led offline"></div>
              <div>
                <p className="text-sm font-medium">Failed</p>
                <p className="text-2xl font-bold text-red-500">
                  {deployments.filter(d => d.status === 'failed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total</p>
                <p className="text-2xl font-bold terminal-text">
                  {deployments.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

