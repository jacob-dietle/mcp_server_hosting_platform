'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricResult<T> {
  value: T;
  dataSource: string;
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  lastUpdated: Date;
}

interface MetricCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  metric: MetricResult<any> | null;
  formatter?: (value: any) => string;
  noDataMessage?: string;
  className?: string;
}

export function MetricCard({
  title,
  description,
  icon,
  metric,
  formatter = (value) => String(value),
  noDataMessage = "No data available - analytics tracking required",
  className
}: MetricCardProps) {
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-orange-600';
      case 'insufficient': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <CheckCircle className="h-3 w-3" />;
      case 'medium': return <Info className="h-3 w-3" />;
      case 'low': return <AlertTriangle className="h-3 w-3" />;
      case 'insufficient': return <XCircle className="h-3 w-3" />;
      default: return <Info className="h-3 w-3" />;
    }
  };

  const getConfidenceBadgeVariant = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      case 'insufficient': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Card className={cn("card-terminal", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 terminal-text">
          {icon}
          {title}
        </CardTitle>
        {metric && (
          <Badge variant={getConfidenceBadgeVariant(metric.confidence)} className="text-xs">
            <span className={cn("flex items-center gap-1", getConfidenceColor(metric.confidence))}>
              {getConfidenceIcon(metric.confidence)}
              {metric.confidence}
            </span>
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {metric ? (
          <>
            <div className="text-2xl font-bold font-mono">
              {formatter(metric.value)}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 font-mono uppercase">
                {description}
              </p>
            )}
            
            {/* Data Attribution */}
            <div className="mt-3 p-2 bg-muted/30 rounded-sm border">
              <div className="text-xs">
                <div className="font-medium text-muted-foreground mb-1">Data Source:</div>
                <div className="text-muted-foreground">{metric.dataSource}</div>
                <div className="flex justify-between mt-1 text-xs">
                  <span>{metric.dataPoints} data points</span>
                  <span>Updated: {metric.lastUpdated.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="text-2xl font-bold text-muted-foreground">
              No Data
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/20 rounded-sm border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" />
                {noDataMessage}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
