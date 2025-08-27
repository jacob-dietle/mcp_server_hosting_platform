'use client';

import { useState } from 'react';
import { MCPJamAgent } from '@mcpgtm/mcp-core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Play, Save, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/core';

interface ToolPlaygroundProps {
  tool: any;
  server: string;
  agent: MCPJamAgent;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolPlayground({ 
  tool, 
  server, 
  agent, 
  isOpen, 
  onOpenChange 
}: ToolPlaygroundProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasExecuted, setHasExecuted] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const { toast } = useToast();

  const getFormFields = () => {
    if (!tool.inputSchema?.properties) return [];
    
    return Object.entries(tool.inputSchema.properties).map(([key, schema]: [string, any]) => ({
      name: key,
      type: schema.type,
      description: schema.description,
      required: tool.inputSchema.required?.includes(key),
      enum: schema.enum,
      default: schema.default,
    }));
  };

  const renderInput = (field: any) => {
    const value = formData[field.name] ?? field.default ?? '';
    
    switch (field.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={field.name}
              checked={value || false}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, [field.name]: checked }))
              }
            />
            <Label htmlFor={field.name} className="text-sm font-normal">
              {field.description || field.name}
            </Label>
          </div>
        );
      
      case 'number':
      case 'integer':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="number"
              value={value}
              onChange={(e) => 
                setFormData(prev => ({ 
                  ...prev, 
                  [field.name]: e.target.value ? Number(e.target.value) : undefined 
                }))
              }
              placeholder={field.description}
            />
          </div>
        );
      
      case 'array':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              {field.name} (JSON Array)
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.name}
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData(prev => ({ ...prev, [field.name]: parsed }));
                } catch {
                  setFormData(prev => ({ ...prev, [field.name]: e.target.value }));
                }
              }}
              placeholder={field.description || '["item1", "item2"]'}
              className="font-mono text-sm"
              rows={3}
            />
          </div>
        );
      
      case 'object':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              {field.name} (JSON Object)
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.name}
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData(prev => ({ ...prev, [field.name]: parsed }));
                } catch {
                  setFormData(prev => ({ ...prev, [field.name]: e.target.value }));
                }
              }}
              placeholder={field.description || '{"key": "value"}'}
              className="font-mono text-sm"
              rows={4}
            />
          </div>
        );
      
      default: // string
        if (field.enum) {
          return (
            <div className="space-y-2">
              <Label htmlFor={field.name}>
                {field.name}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <select
                id={field.name}
                value={value}
                onChange={(e) => 
                  setFormData(prev => ({ ...prev, [field.name]: e.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Select...</option>
                {field.enum.map((option: string) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          );
        }
        
        return (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              {field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              value={value}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, [field.name]: e.target.value }))
              }
              placeholder={field.description}
            />
          </div>
        );
    }
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setHasExecuted(true);

    try {
      const client = agent.getClient(server);
      if (!client) throw new Error(`Server ${server} not connected`);

      const response = await client.callTool({
        name: tool.name,
        arguments: formData,
      });

      setResult(response);
      
      // Auto-scroll to results after a brief delay
      setTimeout(() => {
        const resultElement = document.getElementById('tool-playground-results');
        resultElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string = 'Content') => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${label} copied!`,
        description: 'Successfully copied to clipboard',
        duration: 2000,
      });
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      toast({
        title: `${label} copied!`,
        description: 'Successfully copied to clipboard',
        duration: 2000,
      });
    }
  };

  const saveAsRecipe = () => {
    const recipe = {
      tool: tool.name,
      server,
      parameters: formData,
      timestamp: new Date().toISOString(),
    };
    
    // Save to localStorage for now (could be Supabase later)
    const recipes = JSON.parse(localStorage.getItem('mcp-tool-recipes') || '[]');
    recipes.push(recipe);
    localStorage.setItem('mcp-tool-recipes', JSON.stringify(recipes));
    
    toast({
      title: 'Recipe saved',
      description: 'You can access this from your saved recipes',
    });
  };

  const clearForm = () => {
    setFormData({});
    setResult(null);
    setError(null);
    setHasExecuted(false);
    setShowRequest(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col card-terminal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 terminal-text">
            <code className="text-lg font-mono">{tool.name.toUpperCase()}</code>
            <Badge variant="outline" className="border-black">
              <span className="font-mono uppercase">{server}</span>
            </Badge>
          </DialogTitle>
          <DialogDescription className="font-mono">
            {tool.description || 'TEST THIS TOOL WITH CUSTOM PARAMETERS'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 pr-4">
            {/* Parameters Section */}
            <div className="opacity-100">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide terminal-text">
                  PARAMETERS
                </h3>
                {getFormFields().length > 0 && (
                  <Badge variant="secondary" className="text-xs border-black">
                    <span className="font-mono">{getFormFields().length} FIELDS</span>
                  </Badge>
                )}
              </div>
              
              <div className="space-y-4">
                {getFormFields().length > 0 ? (
                  getFormFields().map((field) => (
                    <div key={field.name}>
                      {renderInput(field)}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 border-2 border-dashed border-black">
                    <p className="text-sm font-mono uppercase">This tool requires no input parameters</p>
                    <p className="text-xs mt-1 font-mono">Ready to execute immediately</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-between items-center py-4 border-y border-black bg-muted/20 -mx-6 px-6">
              <Button
                variant="outline"
                onClick={clearForm}
                disabled={isLoading}
                className="flex items-center gap-2 btn-terminal-nested"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
                <span className="font-mono uppercase">Clear</span>
              </Button>
              
              <div className="flex gap-2">
                {result && (
                  <Button
                    variant="outline"
                    onClick={saveAsRecipe}
                    disabled={isLoading}
                    className="flex items-center gap-2 btn-terminal-nested"
                    size="sm"
                  >
                    <Save className="h-4 w-4" />
                    <span className="font-mono uppercase">Save Recipe</span>
                  </Button>
                )}
                <Button
                  onClick={handleExecute}
                  disabled={isLoading}
                  className="flex items-center gap-2 btn-terminal"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="font-mono uppercase">Executing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span className="font-mono uppercase">Execute Tool</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Execution Section (Progressive Disclosure) */}
            {hasExecuted && (
              <div 
                id="tool-playground-results"
                className="space-y-4 animate-in slide-in-from-bottom-4 duration-500"
              >
                {/* Request Preview (Collapsible) */}
                <div className="border border-black">
                  <button
                    onClick={() => setShowRequest(!showRequest)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm terminal-text">REQUEST DETAILS</h4>
                      <Badge variant="outline" className="text-xs border-black">
                        <span className="font-mono">{Object.keys(formData).length} PARAMETERS</span>
                      </Badge>
                    </div>
                    {showRequest ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  
                  {showRequest && (
                    <div className="border-t border-black p-4 bg-muted/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-muted-foreground font-mono uppercase">JSON Payload</span>
                                                 <Button
                           size="sm"
                           variant="ghost"
                           onClick={() => copyToClipboard(JSON.stringify({
                             method: 'tools/call',
                             params: {
                               name: tool.name,
                               arguments: formData
                             }
                           }, null, 2), 'Request')}
                           className="h-6 px-2 btn-terminal-nested"
                           title="Copy request payload"
                         >
                           <Copy className="h-3 w-3" />
                         </Button>
                      </div>
                                             <ScrollArea className="h-40 w-full border border-black bg-background">
                         <pre className="text-xs font-mono p-3 whitespace-pre-wrap break-words">
                           {JSON.stringify({
                             method: 'tools/call',
                             params: {
                               name: tool.name,
                               arguments: formData
                             }
                           }, null, 2)}
                         </pre>
                       </ScrollArea>
                    </div>
                  )}
                </div>

                {/* Response Section (Prominent) */}
                <div className="border border-black">
                  <div className="px-4 py-3 border-b border-black bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold terminal-text">RESPONSE</h4>
                        {isLoading && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="font-mono uppercase">Executing...</span>
                          </div>
                        )}
                        {error && (
                          <Badge variant="destructive" className="text-xs border-black">
                            <span className="font-mono uppercase">Error</span>
                          </Badge>
                        )}
                        {result && !error && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-black">
                            <span className="font-mono uppercase">Success</span>
                          </Badge>
                        )}
                      </div>
                      
                                             {(result || error) && (
                         <Button
                           size="sm"
                           variant="ghost"
                           onClick={() => copyToClipboard(
                             error ? error : JSON.stringify(result, null, 2),
                             error ? 'Error' : 'Response'
                           )}
                           className="h-6 px-2 btn-terminal-nested"
                           title={error ? "Copy error message" : "Copy response data"}
                         >
                           <Copy className="h-3 w-3" />
                         </Button>
                       )}
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <div className="text-center space-y-2">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          <p className="text-sm font-mono uppercase">Calling {tool.name}...</p>
                        </div>
                      </div>
                    ) : error ? (
                      <div className="bg-red-50 border border-black p-3">
                        <div className="text-red-700 text-sm">
                          <strong className="block mb-1 font-mono uppercase">Execution Error:</strong>
                          <div className="font-mono text-xs">{error}</div>
                        </div>
                      </div>
                                         ) : result ? (
                       <div className="space-y-2">
                         <div className="relative">
                           <ScrollArea className="h-60 w-full border border-black bg-white shadow-inner">
                             <pre className="text-sm font-mono p-3 whitespace-pre-wrap break-words leading-relaxed text-black">
                               {JSON.stringify(result, null, 2)}
                             </pre>
                           </ScrollArea>
                           {/* Subtle scroll indicator - only show if content is long */}
                           {JSON.stringify(result, null, 2).length > 500 && (
                             <div className="absolute bottom-2 right-2 text-xs text-muted-foreground/60 bg-background/80 px-1 pointer-events-none font-mono">
                               SCROLL TO SEE MORE
                             </div>
                           )}
                         </div>
                       </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm font-mono uppercase">Execute the tool to see results</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 
