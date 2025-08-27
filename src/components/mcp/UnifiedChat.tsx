'use client';

import { useState } from 'react';
import { MCPJamAgent } from '@mcpgtm/mcp-core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Loader2, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/core';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function UnifiedChat({ agent }: { agent: MCPJamAgent }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    if (!claudeApiKey.trim()) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your Claude API key to send a message.',
        variant: 'destructive',
      });
      return;
    }

    // Set the API key on the agent before processing
    agent.setClaudeApiKey(claudeApiKey);

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Get all tools from all connected servers
      const allTools = await agent.getAllTools();
      const tools = allTools.flatMap(({ tools }) => tools);

      let assistantMessage = '';
      
      // Process with streaming
      await agent.processQuery(
        userMessage,
        tools,
        (chunk) => {
          assistantMessage += chunk;
          // Update the last message in real-time
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages[newMessages.length - 1]?.role === 'assistant') {
              newMessages[newMessages.length - 1].content = assistantMessage;
            } else {
              newMessages.push({ role: 'assistant', content: assistantMessage });
            }
            return newMessages;
          });
        }
      );
    } catch (error) {
        let message = 'An unknown error occurred';
        if (error instanceof Error) {
            message = error.message;
        }
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full flex-1">
      <div className="border-b p-4">
        <div className="flex items-center gap-4">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <Label htmlFor="claude-api-key" className="text-xs font-semibold text-muted-foreground">
              Claude API Key
            </Label>
            <Input
              id="claude-api-key"
              type="password"
              value={claudeApiKey}
              onChange={(e) => setClaudeApiKey(e.target.value)}
              placeholder="Enter your Claude API key here..."
              className="mt-1 h-8"
            />
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask anything across all your connected MCP servers..."
            className="flex-1"
            rows={3}
          />
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !input.trim()}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 
