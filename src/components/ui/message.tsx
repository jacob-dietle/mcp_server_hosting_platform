import * as React from 'react'
import { useEffect, useRef, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import Markdown from 'react-markdown'
import mermaid from 'mermaid'

// Simple message type definition instead of importing from Letta
type MESSAGE_TYPE = 'user_message' | 'assistant_message' | 'system_message'

interface MessagePillProps {
  message: string
  sender: MESSAGE_TYPE | string
}

const MermaidComponent = ({ chart }: { chart: string }) => {
  const mermaidRef = useRef<HTMLDivElement>(null)
  const chartId = `mermaid-${Math.random().toString(36).substring(2, 11)}`

  useEffect(() => {
    // Initialize mermaid once
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose'
    })

    // Handle async rendering properly
    const renderChart = async () => {
      if (mermaidRef.current && chart) {
        try {
          mermaidRef.current.innerHTML = '' // Clear previous renders
          const { svg } = await mermaid.render(chartId, chart)
          mermaidRef.current.innerHTML = svg
        } catch (error) {
          console.error('Error rendering mermaid chart:', error)
          mermaidRef.current.innerHTML = `<div class="text-red-500">Error rendering diagram</div>`
        }
      }
    }

    renderChart()
  }, [chart, chartId])

  return <div ref={mermaidRef} />
}

const MessagePill: React.FC<MessagePillProps> = ({ message, sender }) => {
  // Add a render key state to force re-rendering when needed
  const [renderKey, setRenderKey] = useState(0);
  const sourceContext = sender === 'user_message' ? 'user' : 'agent';
  
  // Pre-process message to unescape any escaped newlines
  // This fixes issues with directory messages containing literal \n
  const processedMessage = useMemo(() => {
    if (!message) return '';
    
    // Replace literal \n with actual newlines
    // This is crucial for directory messages that come from localStorage
    let processed = message;
    
    // Only apply special processing for agent messages (not user messages)
    if (sender !== 'user_message') {
      // Replace literal \n with actual newlines
      processed = processed.replace(/\\n/g, '\n');
      
      // REMOVED: Don't wrap content in triple backticks as it prevents markdown rendering
      // Instead, just log if we detect markdown content for debugging
      const hasMarkdownIndicators = 
        (processed.includes('# ') || 
         processed.includes('- ') || 
         (processed.includes('[') && processed.includes('](')) ||
         processed.includes('| ') && processed.includes(' |'));
         
      if (hasMarkdownIndicators) {
        console.log('[MessagePill] Detected markdown content in message');
      }
    }
    
    console.log('Final message being sent to Markdown component:', 
      processed.length > 100 ? `${processed.substring(0, 100)}...` : processed);
    
    return processed;
  }, [message, sender]);
  
  // Debug log the message content when it changes
  useEffect(() => {
    if (message) {
      console.group(`[MessagePill Debug] ${sourceContext} - ${new Date().toISOString()}`);
      
      // Log basic info
      console.log('Sender:', sender);
      console.log('Message length:', message.length);
      
      // Check for markdown patterns
      const hasCodeBlocks = message.includes('```');
      const hasTables = message.includes('|') && message.includes('\n|');
      const hasLinks = message.includes('[') && message.includes('](');
      
      console.log('Contains markdown:', { 
        hasCodeBlocks, 
        hasTables, 
        hasLinks,
        hasHeadings: message.match(/^#+\s/m) !== null
      });
      
      // Log before and after processing
      if (message !== processedMessage) {
        console.log('Original message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
        console.log('Processed message:', processedMessage.substring(0, 100) + (processedMessage.length > 100 ? '...' : ''));
      }
      
      // For large messages, show chunks to help debug truncation
      if (message.length > 200) {
        console.log('Message start (200 chars):', message.substring(0, 200));
        
        // Detect if the middle looks like it contains markdown
        const middleChunk = message.substring(Math.floor(message.length/2) - 100, Math.floor(message.length/2) + 100);
        if (middleChunk.includes('```') || middleChunk.includes('|') || middleChunk.includes('##')) {
          console.log('Message middle chunk contains markdown:', middleChunk);
        }
        
        console.log('Message end (200 chars):', message.substring(message.length - 200));
      } else {
        // For smaller messages, just log the full content
        console.log('Full message:', message);
      }
      
      // Force a re-render after a short delay if the message might contain markdown
      if (hasCodeBlocks || hasTables || hasLinks) {
        setTimeout(() => {
          console.log('[MessagePill] Forcing re-render for markdown content');
          setRenderKey(prev => prev + 1);
        }, 100);
      }
      
      console.groupEnd();
    }
  }, [message, sender, sourceContext, processedMessage]);

  return (
    <div
      key={renderKey}
      className={cn(
        'flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm',
        sender === 'user_message'
          ? 'ml-auto bg-primary text-primary-foreground'
          : 'bg-muted markdown-container'
      )}
      data-source-context={sourceContext}
    >
      <Markdown
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            
            if (match && match[1] === 'mermaid') {
              try {
                return (
                  <MermaidComponent chart={String(children).replace(/\n$/, '')} />
                )
              } catch (error: unknown) {
                console.error('Error rendering mermaid component:', error);
                return (
                  <code className="text-red-500">
                    Error rendering mermaid diagram: {error instanceof Error ? error.message : String(error)}
                  </code>
                );
              }
            }
            
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          // Add support for tables to ensure they render properly
          table({ node, ...props }) {
            return <table className="border-collapse border border-gray-300 my-4 w-full text-sm" {...props} />
          },
          thead({ node, ...props }) {
            return <thead className="bg-gray-100" {...props} />
          },
          tbody({ node, ...props }) {
            return <tbody {...props} />
          },
          tr({ node, ...props }) {
            return <tr className="border-b border-gray-300 odd:bg-white even:bg-gray-50" {...props} />
          },
          th({ node, ...props }) {
            return <th className="border border-gray-300 p-2 text-left font-semibold bg-gray-100" {...props} />
          },
          td({ node, ...props }) {
            return <td className="border border-gray-300 p-2 align-top" {...props} />
          }
        }}
      >
        {processedMessage}
      </Markdown>
    </div>
  )
}

export { MessagePill }
