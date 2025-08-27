'use client';

import { useState, useEffect } from 'react';
import { MCPJamAgent } from '@mcpgtm/mcp-core';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Play, Copy, Heart } from 'lucide-react';
import { useToast } from '@/hooks/core';
import { ToolPlayground } from './ToolPlayground';

interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
  server: string;
}

interface ToolExplorerProps {
  agent: MCPJamAgent;
  onTryTool?: (tool: Tool) => void;
}

// Persistent state management
const getPersistedState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('mcp-tools-tab-state');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const setPersistedState = (state: {
  search: string;
  favorites: string[];
  selectedTool: {tool: any; server: string} | null;
}) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('mcp-tools-tab-state', JSON.stringify(state));
  } catch {
    // Ignore localStorage errors
  }
};

const getPersistedSearch = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('mcp-tools-search') || '';
  } catch {
    return '';
  }
};

const getPersistedFavorites = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const saved = localStorage.getItem('mcp-tools-favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
};

export function ToolExplorer({ agent, onTryTool }: ToolExplorerProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  
  // Initialize state with persisted values
  const persistedState = getPersistedState();
  const [search, setSearch] = useState(() => persistedState?.search || getPersistedSearch());
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(() => 
    persistedState?.favorites ? new Set(persistedState.favorites) : getPersistedFavorites()
  );
  const [selectedTool, setSelectedTool] = useState<{tool: any; server: string} | null>(
    persistedState?.selectedTool || null
  );
  const { toast } = useToast();

  // Persist state changes
  useEffect(() => {
    setPersistedState({
      search,
      favorites: Array.from(favorites),
      selectedTool
    });
    
    // Also persist individual items for backward compatibility
    if (typeof window !== 'undefined') {
      localStorage.setItem('mcp-tools-search', search);
      localStorage.setItem('mcp-tools-favorites', JSON.stringify(Array.from(favorites)));
    }
  }, [search, favorites, selectedTool]);

  // Enhanced search handler with persistence
  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  // Enhanced favorites handler with persistence
  const toggleFavorite = (toolKey: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(toolKey)) {
      newFavorites.delete(toolKey);
    } else {
      newFavorites.add(toolKey);
    }
    setFavorites(newFavorites);
  };

  // Enhanced selectedTool handler with persistence
  const handleSelectTool = (tool: Tool, server: string) => {
    setSelectedTool({ tool, server });
  };

  const handleCloseToolPlayground = () => {
    setSelectedTool(null);
  };

  // Clear all persisted state (useful for debugging or reset)
  const clearPersistedState = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mcp-tools-tab-state');
      localStorage.removeItem('mcp-tools-search');
      localStorage.removeItem('mcp-tools-favorites');
    }
    setSearch('');
    setFavorites(new Set());
    setSelectedTool(null);
  };

  useEffect(() => {
    loadTools();
  }, [agent]);

  const loadTools = async () => {
    try {
      setLoading(true);
      const serverTools = await agent.getAllTools();
      const flatTools: Tool[] = serverTools.flatMap(({ serverName, tools }) =>
        tools.map(tool => ({ ...tool, server: serverName }))
      );
      setTools(flatTools);
    } catch (error) {
      console.error('Failed to load tools:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tools from servers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(search.toLowerCase()) ||
    tool.description?.toLowerCase().includes(search.toLowerCase()) ||
    tool.server.toLowerCase().includes(search.toLowerCase())
  );

  const groupedTools = filteredTools.reduce((acc, tool) => {
    if (!acc[tool.server]) acc[tool.server] = [];
    acc[tool.server].push(tool);
    return acc;
  }, {} as Record<string, Tool[]>);

  const copyToolName = (toolName: string) => {
    navigator.clipboard.writeText(toolName);
    toast({
      title: 'Copied!',
      description: `Tool name "${toolName}" copied to clipboard`,
    });
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-black">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="SEARCH TOOLS BY NAME, DESCRIPTION, OR SERVER..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input-terminal pl-10 font-mono uppercase"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filteredTools.length} of {tools.length} tools
            {selectedTool && (
              <span className="ml-2 text-primary font-mono">
                | TESTING: {selectedTool.tool.name}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadTools}
              className="h-6 px-2"
            >
              Refresh
            </Button>
            {(search || favorites.size > 0 || selectedTool) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPersistedState}
                className="h-6 px-2 text-muted-foreground hover:text-foreground"
                title="Clear all filters and state"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {Object.entries(groupedTools).map(([serverName, serverTools]) => (
            <div key={serverName}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-sm terminal-text">{serverName}</h3>
                <Badge variant="outline" className="text-xs font-mono uppercase">
                  {serverTools.length} TOOLS
                </Badge>
              </div>
              
              <div className="space-y-2">
                {serverTools.map((tool) => {
                  const toolKey = `${tool.server}-${tool.name}`;
                  const isFavorite = favorites.has(toolKey);
                  const isSelected = selectedTool?.tool.name === tool.name && selectedTool?.server === tool.server;
                  
                  return (
                    <Card key={toolKey} className={`card-terminal p-3 hover:shadow-sm transition-shadow ${
                      isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <code className={`text-sm font-mono truncate ${
                              isSelected ? 'text-primary font-bold' : 'text-primary'
                            }`}>
                              {tool.name}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFavorite(toolKey)}
                              className={`h-6 w-6 p-1 ${isFavorite ? 'text-red-500' : 'text-muted-foreground'}`}
                            >
                              <Heart className={`h-3 w-3 ${isFavorite ? 'fill-current' : ''}`} />
                            </Button>
                            {isSelected && (
                              <Badge variant="secondary" className="text-xs font-mono">
                                ACTIVE
                              </Badge>
                            )}
                          </div>
                          
                          {tool.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {tool.description}
                            </p>
                          )}
                          
                          {tool.inputSchema && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Inputs:</span>
                              {' '}
                              {Object.keys(tool.inputSchema.properties || {}).join(', ') || 'None'}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToolName(tool.name)}
                            className="h-8 w-8 p-1"
                            title="Copy tool name"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelectTool(tool, tool.server)}
                            className={`h-8 w-8 p-1 ${isSelected ? 'bg-primary/10' : ''}`}
                            title={isSelected ? "Tool playground is open" : "Try this tool"}
                          >
                            <Play className={`h-3 w-3 ${isSelected ? 'fill-current' : ''}`} />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
          
          {filteredTools.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2" />
              <p>No tools found matching your search</p>
              <p className="text-xs">Try adjusting your search terms</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {selectedTool && (
        <ToolPlayground
          tool={selectedTool.tool}
          server={selectedTool.server}
          agent={agent}
          isOpen={!!selectedTool}
          onOpenChange={(open) => !open && handleCloseToolPlayground()}
        />
      )}
    </div>
  );
} 
