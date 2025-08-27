"use client"

import React, { useState, useEffect } from 'react';
import { ConversationExchange } from './conversation-exchange';
import { CONVERSATIONS } from './conversation-data';

interface ConversationCarouselProps {
  isMobile?: boolean;
  cycleTime?: number; // Time in ms for each full conversation exchange
  fadeTime?: number;  // Time in ms for fade transition
}

export function ConversationCarousel({ 
  isMobile = false,
  cycleTime = 15000, // 15 seconds per conversation
  fadeTime = 400     // 400ms fade transition
}: ConversationCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [key, setKey] = useState(0); // Key for forcing remount
  
  // Function to move to the next conversation
  const nextConversation = () => {
    // Start fade out
    setIsVisible(false);
    
    // After fade out completes, change the conversation
    setTimeout(() => {
      // Update to next conversation index
      setCurrentIndex((prevIndex) => (prevIndex + 1) % CONVERSATIONS.length);
      // Force remount of the conversation by changing key
      setKey(prev => prev + 1);
      // Start fade in
      setIsVisible(true);
    }, fadeTime);
  };
  
  // If we ever need to pause/resume the carousel
  const [isPaused, setIsPaused] = useState(false);
  
  useEffect(() => {
    // For development/debugging: allow pausing with 'p' key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p') {
        setIsPaused(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  return (
    <div 
      className={`transition-opacity duration-${fadeTime} ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <ConversationExchange
        key={key}
        conversation={CONVERSATIONS[currentIndex]}
        isMobile={isMobile}
        displayDuration={cycleTime - fadeTime} // Subtract fade time from total cycle
        onComplete={!isPaused ? nextConversation : undefined}
      />
    </div>
  );
} 
