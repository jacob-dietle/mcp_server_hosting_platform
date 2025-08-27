"use client"

import React, { useEffect, useRef, useState } from 'react';
import Typed from 'typed.js';
import { MessageSquare, Info, Terminal, User } from 'lucide-react';
import { ConversationItem } from './conversation-data';

interface ConversationExchangeProps {
  conversation: ConversationItem;
  isMobile?: boolean;
  onComplete?: () => void;
  displayDuration?: number;
}

export function ConversationExchange({ 
  conversation, 
  isMobile = false,
  onComplete,
  displayDuration = 12000 // Default to 12 seconds per exchange
}: ConversationExchangeProps) {
  // References for typing elements
  const questionRef = useRef<HTMLSpanElement>(null);
  const answerIntroRef = useRef<HTMLParagraphElement>(null);
  const answerListRef = useRef<HTMLUListElement>(null);
  const answerFooterRef = useRef<HTMLParagraphElement>(null);
  const citationsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Animation state tracking
  const [questionTyped, setQuestionTyped] = useState(false);
  const [answerIntroTyped, setAnswerIntroTyped] = useState(false);
  const [answerListVisible, setAnswerListVisible] = useState(false);
  const [footerTyped, setFooterTyped] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showAnalyzing, setShowAnalyzing] = useState(false);
  
  // Track Typed instances for cleanup
  const [typedInstances, setTypedInstances] = useState<Typed[]>([]);
  
  // Track the last scroll timeout to prevent multiple calls
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Helper function to scroll to the bottom with smooth behavior
  const scrollToBottom = (immediate = false) => {
    // Clear any pending scroll operation
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Defer the scroll operation slightly to allow content to render
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      
      // Start looking from document root
      const scrollContainers = document.querySelectorAll('.conversation-scrollbar');
      
      // Find the scrollable container that contains our element
      for (let i = 0; i < scrollContainers.length; i++) {
        const container = scrollContainers[i];
        if (container.contains(containerRef.current)) {
          // Explicitly cast to HTMLElement to ensure proper typing
          const scrollableElement = container as HTMLElement;
          
          // Use smooth scrolling behavior unless immediate is required
          scrollableElement.scrollTo({
            top: scrollableElement.scrollHeight,
            behavior: immediate ? 'auto' : 'smooth'
          });
          
          break; // Exit after finding the first container
        }
      }
    }, immediate ? 0 : 10); // Small delay to ensure DOM updates have happened
  };
  
  // Set up a mutation observer to watch for content changes and scroll accordingly
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Create a mutation observer to watch for content changes
    const observer = new MutationObserver(() => {
      scrollToBottom();
    });
    
    // Start observing the container for changes
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    // Clean up the observer on unmount
    return () => {
      observer.disconnect();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  // Cleanup typed instances - modified to preserve question content
  const cleanupTyped = () => {
    // Only clean up instances after the first one (the question instance)
    // This ensures the question remains visible throughout the animation
    typedInstances.slice(1).forEach(instance => instance.destroy());
    
    // Keep the first instance (question) in the array
    if (typedInstances.length > 0) {
      setTypedInstances([typedInstances[0]]);
    } else {
      setTypedInstances([]);
    }
  };
  
  // Handle complete exchange lifecycle with minimum view time
  useEffect(() => {
    // Set a timer for the entire exchange cycle
    // Ensure at least 4 seconds of viewing time after everything is typed
    const minViewingTimeAfterCompletion = 5000; // 5 seconds minimum viewing time
    
    // Function to calculate how long this should display
    const calculateActualDisplayTime = () => {
      if (!questionTyped || !answerIntroTyped || !answerListVisible || !footerTyped) {
        // If animations are still running, use the full display duration
        return displayDuration;
      }
      
      // Ensure at least minViewingTimeAfterCompletion time from now
      // This makes sure that when all typing is complete, the user has enough time to read
      return Math.max(minViewingTimeAfterCompletion, displayDuration * 0.2);
    };
    
    const exchangeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, calculateActualDisplayTime());
    
    return () => {
      clearTimeout(exchangeTimer);
      cleanupTyped();
    };
  }, [displayDuration, onComplete, questionTyped, answerIntroTyped, answerListVisible, footerTyped]);
  
  // Step 1: Type the question
  useEffect(() => {
    if (!questionRef.current) return;
    
    // Store the original question text to preserve it
    const questionText = conversation.question;
    
    const typed = new Typed(questionRef.current, {
      strings: [questionText],
      typeSpeed: 35, // Slightly faster
      startDelay: 500,
      showCursor: true,
      cursorChar: '|',
      onComplete: () => {
        // When typing is complete, explicitly set the HTML content to ensure it persists
        if (questionRef.current) {
          // Keep the cursor by appending it
          questionRef.current.innerHTML = questionText + '<span class="typed-cursor">|</span>';
        }
        setQuestionTyped(true);
        
        // Show "Analyzing..." text after question is typed
        setTimeout(() => {
          setShowAnalyzing(true);
        }, 700);
      }
    });
    
    setTypedInstances(prev => [...prev, typed]);
    
    return () => {
      // Before destroying, save the content if it exists
      if (questionRef.current && questionRef.current.textContent) {
        const currentText = questionRef.current.textContent.replace('|', '');
        // Set the raw text content without the cursor to prevent flickering
        questionRef.current.textContent = currentText;
      }
      typed.destroy();
    };
  }, [conversation.question]);
  
  // Step 2: Type the answer intro after question completes and analyzing shows
  useEffect(() => {
    if (!questionTyped || !showAnalyzing || !answerIntroRef.current) return;
    
    // Delay response after "Analyzing..." appears
    const responseDelay = 1200;
    
    setTimeout(() => {
      const typed = new Typed(answerIntroRef.current, {
        strings: [conversation.answer.text],
        typeSpeed: 25, // Slightly faster
        startDelay: 300,
        showCursor: false,
        onComplete: () => {
          setAnswerIntroTyped(true);
        }
      });
      
      setTypedInstances(prev => [...prev, typed]);
    }, responseDelay);
    
    return () => {
      // Cleanup will be handled by the cleanupTyped function
    };
  }, [questionTyped, showAnalyzing, conversation.answer.text]);
  
  // Step 3: Show list items with staggered appearance
  useEffect(() => {
    if (!answerIntroTyped || !answerListRef.current) return;
    
    // Clear any existing list items
    answerListRef.current.innerHTML = '';
    
    // Create list items with staggered appearance
    conversation.answer.items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = `${isMobile ? 'text-sm ' : ''}break-words opacity-0 transition-opacity duration-300`;
      li.innerHTML = item;
      answerListRef.current?.appendChild(li);
      
      // Stagger the appearance of list items
      setTimeout(() => {
        li.classList.remove('opacity-0');
      }, index * 350 + 200); // Slightly faster
    });
    
    // Mark list as complete after all items would be visible
    setTimeout(() => {
      setAnswerListVisible(true);
    }, conversation.answer.items.length * 350 + 400);
    
  }, [answerIntroTyped, conversation.answer.items, isMobile]);
  
  // Step 4: Type the footer after list items appear
  useEffect(() => {
    if (!answerListVisible || !answerFooterRef.current || !conversation.answer.footer) return;
    
    const typed = new Typed(answerFooterRef.current, {
      strings: [conversation.answer.footer],
      typeSpeed: 15, // Faster
      startDelay: 300,
      showCursor: false,
      onComplete: () => {
        setFooterTyped(true);
        
        // Show citations after a short delay
        if (conversation.answer.citations && !isMobile) {
          setTimeout(() => {
            setShowCitations(true);
          }, 600); // Slightly faster
        }
      }
    });
    
    setTypedInstances(prev => [...prev, typed]);
    
    return () => {
      typed.destroy();
    };
  }, [answerListVisible, conversation.answer.footer, conversation.answer.citations, isMobile]);
  
  // Render citations if they exist
  const renderCitations = () => {
    if (!conversation.answer.citations) return null;
    
    return (
      <div 
        className={`mt-4 pt-3 border-t border-black/20 dark:border-white/20 text-xs text-black/70 dark:text-white/70 opacity-0 transition-opacity duration-500 ${showCitations ? 'opacity-80' : ''}`}
        ref={citationsRef}
      >
        <div className="flex items-center mb-1">
          <Info className="h-3 w-3 mr-1 text-primary" />
          <span className="font-semibold">Sources:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(conversation.answer.citations).map(([key, value]) => (
            <div key={key} className="flex gap-1">
              <span className="shrink-0">{key}.</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div ref={containerRef} className={`space-y-${isMobile ? '4' : '5'}`}>
      {/* User question bubble */}
      <div className={`flex items-start ${isMobile ? 'gap-3' : 'gap-4'}`}>
        <div className={`flex ${isMobile ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-full bg-white dark:bg-dark-bg shadow border border-black/30 dark:border-white/30`}>
          <User className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-black dark:text-white`} />
        </div>
        <div className={`flex-1 ${isMobile ? 'min-w-0' : ''}`}>
          <p className={`${isMobile ? 'text-xs mb-1.5' : 'text-sm mb-2'} font-medium text-black dark:text-white flex items-center gap-2`}>
            <span>User Query</span>
            <span className="text-xs font-mono text-primary">~$</span>
          </p>
          <div className={`rounded-lg bg-white dark:bg-dark-bg ${isMobile ? 'p-2.5 text-sm' : 'p-3'} border border-black/20 dark:border-white/20 shadow-sm dark:shadow-dark`}>
            <span ref={questionRef} className="dark:text-white"></span>
          </div>
        </div>
      </div>
      
      {/* Processing indicator - appears after question is typed */}
      {showAnalyzing && (
        <div className={`pl-12 ${isMobile ? 'pl-10' : 'pl-14'} transition-opacity ${answerIntroTyped ? 'opacity-0' : 'opacity-100'} duration-300`}>
          <div className="inline-flex items-center space-x-2 rounded bg-white dark:bg-dark-bg border border-black/20 dark:border-white/20 px-2 py-1 text-xs font-mono text-primary shadow-sm">
            <div className="flex space-x-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "300ms" }}></div>
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "600ms" }}></div>
            </div>
            <span>Analyzing query...</span>
          </div>
        </div>
      )}
      
      {/* Agent response bubble */}
      <div className={`flex items-start ${isMobile ? 'gap-3' : 'gap-4'}`}>
        <div className={`flex ${isMobile ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-full bg-accent dark:bg-dark-accent shadow border border-black dark:border-dark-border text-light-text dark:text-dark-text`}>
          <Terminal className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
        </div>
        <div className={`flex-1 ${isMobile ? 'min-w-0' : ''}`}>
          <p className={`${isMobile ? 'text-xs mb-1.5' : 'text-sm mb-2'} font-medium text-black dark:text-white flex items-center gap-2`}>
            <span>Intelligence Terminal</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 dark:bg-dark-accent/30 text-accent dark:text-dark-accent font-mono border border-black/10 dark:border-white/10">v1.0.2</span>
          </p>
          <div className={`rounded-lg bg-white dark:bg-dark-bg ${isMobile ? 'p-2.5 text-sm' : 'p-3'} shadow-sm dark:shadow-dark border border-black/20 dark:border-white/20`}>
            <p className={`${isMobile ? 'text-sm ' : ''}mb-2 break-words text-black dark:text-white`} ref={answerIntroRef}></p>
            <ul className={`ml-4 list-disc ${isMobile ? 'space-y-1' : 'space-y-1.5'} text-black dark:text-white`} ref={answerListRef}></ul>
            {!isMobile && conversation.answer.footer && (
              <p className="mt-3 text-black dark:text-white" ref={answerFooterRef}></p>
            )}
            {!isMobile && renderCitations()}
          </div>
        </div>
      </div>
    </div>
  );
} 
