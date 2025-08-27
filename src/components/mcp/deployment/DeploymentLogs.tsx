'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Terminal, 
  Play, 
  Pause, 
  Trash2, 
  Download,
  Filter,
  ChevronDown
} from 'lucide-react';
import { LogViewerProps } from '../../../contracts/component-contracts';

export function DeploymentLogs({
  logs,
  isLoading = false,
  isStreaming = false,
  onToggleStreaming,
  maxHeight = '400px',
  className = ''
}: LogViewerProps) {
  const [logLevel, setLogLevel] = React.useState<string>('all');
  const [showFilters, setShowFilters] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  React.useEffect(() => {
    if (scrollAreaRef.current && isStreaming) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [logs, isStreaming]);

  const filteredLogs = React.useMemo(() => {
    if (logLevel === 'all') return logs;
    return logs.filter(log => log.log_level === logLevel);
  }, [logs, logLevel]);

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-400';
      case 'warn': 
      case 'warning': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'debug': return 'text-gray-400';
      case 'success': return 'text-green-400';
      default: return 'text-gray-300';
    }
  };

  const getLogLevelBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'destructive';
      case 'warn':
      case 'warning': return 'secondary';
      case 'info': return 'default';
      case 'debug': return 'outline';
      case 'success': return 'default';
      default: return 'outline';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const downloadLogs = () => {
    const logText = filteredLogs
      .map(log => `[${formatTimestamp(log.created_at || '')}] ${log.log_level.toUpperCase()}: ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    // This would typically call a prop function to clear logs
    console.log('Clear logs requested');
  };

  const logLevels = ['all', 'error', 'warn', 'info', 'debug', 'success'];
  const uniqueLevels = ['all', ...Array.from(new Set(logs.map(log => log.log_level)))];

  return (
    <Card className={`card-terminal ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5" />
            <CardTitle className="terminal-text">DEPLOYMENT LOGS</CardTitle>
            <Badge variant="outline" className="font-mono">
              {filteredLogs.length} entries
            </Badge>
            {isStreaming && (
              <div className="flex items-center gap-2">
                <div className="status-led online animate-pulse"></div>
                <span className="text-xs text-green-400 font-mono">LIVE</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            
            {onToggleStreaming && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleStreaming}
                className="gap-2"
              >
                {isStreaming ? (
                  <>
                    <Pause className="h-4 w-4" />
                    [PAUSE]
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    [STREAM]
                  </>
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={downloadLogs}
              className="gap-2"
              disabled={filteredLogs.length === 0}
            >
              <Download className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              className="gap-2 text-red-400 hover:text-red-300"
              disabled={filteredLogs.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-2 pt-3 border-t border-border">
            <span className="text-sm font-medium">Level:</span>
            <div className="flex gap-1">
              {uniqueLevels.map((level) => (
                <Badge
                  key={level}
                  variant={logLevel === level ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setLogLevel(level)}
                >
                  {level.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea 
          ref={scrollAreaRef}
          className="w-full border-t border-border"
          style={{ height: maxHeight }}
        >
          <div className="p-4 space-y-1">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
                <div className="status-led warning animate-pulse"></div>
                Loading logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
                <Terminal className="h-4 w-4" />
                No logs available
                {logLevel !== 'all' && ` for level: ${logLevel}`}
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div
                  key={log.id || index}
                  className="deployment-log-entry flex items-start gap-3 py-1 hover:bg-muted/20 rounded px-2 -mx-2"
                >
                  <span className="text-xs text-muted-foreground font-mono min-w-[80px]">
                    {log.created_at ? formatTimestamp(log.created_at) : '--:--:--'}
                  </span>
                  
                  <Badge
                    variant={getLogLevelBadge(log.log_level) as any}
                    className="text-xs min-w-[60px] justify-center"
                  >
                    {log.log_level.toUpperCase()}
                  </Badge>
                  
                  <span className={`text-sm font-mono flex-1 ${getLogLevelColor(log.log_level)}`}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
            
            {/* Auto-scroll anchor */}
            {isStreaming && <div id="logs-bottom" />}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

