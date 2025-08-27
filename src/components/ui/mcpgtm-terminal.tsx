"use client"

import React, { useState, useEffect, useRef } from 'react';
import Typed from 'typed.js';
import { Card, CardContent } from '@/components/ui/card';
import { MCPGTM_CONVERSATIONS, MCPGTMConversationItem } from './mcpgtm-conversation-data';

export function MCPGTMTerminal() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResponse, setShowResponse] = useState(false);
  const commandRef = useRef<HTMLSpanElement>(null);
  const responseRef = useRef<HTMLPreElement>(null);
  const [typedInstances, setTypedInstances] = useState<Typed[]>([]);

  const currentConversation = MCPGTM_CONVERSATIONS[currentIndex];

  // Clean up typed instances
  const cleanupTyped = () => {
    typedInstances.forEach(instance => instance.destroy());
    setTypedInstances([]);
  };

  // Cycle through conversations
  useEffect(() => {
    const cycleTime = 12000; // 12 seconds per conversation
    const timer = setTimeout(() => {
      cleanupTyped();
      setShowResponse(false);
      setCurrentIndex((prev) => (prev + 1) % MCPGTM_CONVERSATIONS.length);
    }, cycleTime);

    return () => {
      clearTimeout(timer);
      cleanupTyped();
    };
  }, [currentIndex]);

  // Type the command
  useEffect(() => {
    if (!commandRef.current) return;

    const typed = new Typed(commandRef.current, {
      strings: [currentConversation.command],
      typeSpeed: 40,
      startDelay: 500,
      showCursor: true,
      cursorChar: '_',
      onComplete: () => {
        setTimeout(() => {
          setShowResponse(true);
        }, 800);
      }
    });

    setTypedInstances(prev => [...prev, typed]);

    return () => {
      typed.destroy();
    };
  }, [currentConversation]);

  // Type the response
  useEffect(() => {
    if (!showResponse || !responseRef.current) return;

    const typed = new Typed(responseRef.current, {
      strings: [currentConversation.response],
      typeSpeed: 15,
      startDelay: 300,
      showCursor: false,
    });

    setTypedInstances(prev => [...prev, typed]);

    return () => {
      typed.destroy();
    };
  }, [showResponse, currentConversation]);

  return (
    <Card className="bg-black dark:bg-zinc-900 border-zinc-800 overflow-hidden">
      <div className="bg-zinc-900 dark:bg-black border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="text-xs font-mono text-zinc-400">MCPGTM Terminal</div>
      </div>
      
      <CardContent className="p-6 font-mono text-sm min-h-[400px]">
        {/* Command */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-green-400">$</span>
            <p className="text-zinc-100 break-words">
              "<span ref={commandRef}></span>"
            </p>
          </div>
          
          {/* Processing indicator */}
          {showResponse && !responseRef.current?.textContent && (
            <div className="pl-5 text-zinc-500 text-xs">
              Processing{currentConversation.processingTime && ` (${currentConversation.processingTime})`}...
            </div>
          )}
          
          {/* Response */}
          {showResponse && (
            <div className="pl-5 text-zinc-400">
              <pre className="whitespace-pre-wrap font-mono" ref={responseRef}></pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 
