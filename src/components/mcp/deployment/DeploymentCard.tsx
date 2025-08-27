'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Server, 
  Activity, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { Deployment } from '../../../../types/database';
import { DeploymentCardProps } from '../../../contracts/component-contracts';

export function DeploymentCard({ 
  deployment, 
  onClick, 
  onDelete, 
  showActions = true, 
  className = '' 
}: DeploymentCardProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'pending': 
      case 'validating':
      case 'deploying':
      case 'building': return 'text-yellow-500';
      case 'stopped':
      case 'cancelled': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'running': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
      case 'validating':
      case 'deploying':
      case 'building': return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      default: return <Server className="h-4 w-4 text-gray-400" />;
    }
  };

  const getHealthStatusLED = (healthStatus: string | null) => {
    switch (healthStatus) {
      case 'healthy': return 'status-led online';
      case 'unhealthy': return 'status-led offline';
      case 'degraded': return 'status-led warning';
      default: return 'status-led offline';
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      console.error('Failed to delete deployment:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card 
      className={`card-terminal cursor-pointer hover:border-primary/50 transition-colors ${className}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(deployment.status)}
            <div>
              <CardTitle className="text-lg terminal-text">
                {deployment.deployment_name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline" 
                  className={`deployment-status-badge ${getStatusColor(deployment.status)}`}
                >
                  {deployment.status?.toUpperCase() || 'UNKNOWN'}
                </Badge>
                <div className={getHealthStatusLED(deployment.health_status)}></div>
              </div>
            </div>
          </div>
          
          {showActions && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {deployment.service_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => window.open(deployment.service_url!, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Service URL */}
          {deployment.service_url && (
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground truncate">
                {deployment.service_url}
              </span>
            </div>
          )}

          {/* Deployment Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {formatDate(deployment.deployed_at || deployment.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {deployment.health_status?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {deployment.error_message && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded">
              <p className="text-xs text-red-400 font-mono">
                {deployment.error_message}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

