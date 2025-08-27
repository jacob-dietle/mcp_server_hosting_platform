"use client"

import React, { useEffect, useRef, useState } from 'react';
import Typed from 'typed.js';
import { CHAT_RESPONSES, useChatContext } from './chat-context';

interface TypedResponseProps {
  className?: string;
  isMobile?: boolean;
}

export function TypedResponse({ className, isMobile = false }: TypedResponseProps) {
  const introTextRef = useRef<HTMLParagraphElement>(null);
  const listItemsRef = useRef<HTMLUListElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);
  
  const { currentQuestionIndex, isAnswerVisible } = useChatContext();
  const [hasTypedIntro, setHasTypedIntro] = useState(false);
  const [hasTypedList, setHasTypedList] = useState(false);
  const [introTyped, setIntroTyped] = useState<Typed | null>(null);
  const [footerTyped, setFooterTyped] = useState<Typed | null>(null);
  
  // Cleanup function to destroy any active typing instances
  const cleanupTypingInstances = () => {
    if (introTyped) {
      introTyped.destroy();
      setIntroTyped(null);
    }
    if (footerTyped) {
      footerTyped.destroy();
      setFooterTyped(null);
    }
  };
  
  // Reset states when changing questions
  useEffect(() => {
    setHasTypedIntro(false);
    setHasTypedList(false);
    cleanupTypingInstances();
    
    // Clear DOM elements
    if (introTextRef.current) introTextRef.current.innerHTML = '';
    if (listItemsRef.current) listItemsRef.current.innerHTML = '';
    if (footerRef.current) footerRef.current.innerHTML = '';
    
  }, [currentQuestionIndex]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupTypingInstances();
  }, []);
  
  // Type the intro text 
  useEffect(() => {
    if (!isAnswerVisible || !introTextRef.current || hasTypedIntro) return;
    
    const response = CHAT_RESPONSES[currentQuestionIndex as keyof typeof CHAT_RESPONSES];
    if (!response) return;
    
    const typed = new Typed(introTextRef.current, {
      strings: [response.text],
      typeSpeed: 30,
      startDelay: 300,
      showCursor: false,
      onComplete: () => {
        setHasTypedIntro(true);
      }
    });
    
    setIntroTyped(typed);
    
    return () => {
      typed.destroy();
      setIntroTyped(null);
    };
  }, [isAnswerVisible, currentQuestionIndex, hasTypedIntro]);
  
  // Type the list items
  useEffect(() => {
    if (!isAnswerVisible || !hasTypedIntro || !listItemsRef.current || hasTypedList) return;
    
    const response = CHAT_RESPONSES[currentQuestionIndex as keyof typeof CHAT_RESPONSES];
    if (!response) return;
    
    // Create and append list items
    const createListItems = () => {
      if (!listItemsRef.current) return;
      
      // Clear any existing list items
      listItemsRef.current.innerHTML = '';
      
      // Create list items with staggered appearance
      response.items.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = `${isMobile ? 'text-sm ' : ''}break-words opacity-0 transition-opacity duration-300`;
        li.innerHTML = item;
        listItemsRef.current?.appendChild(li);
        
        // Stagger the appearance of list items
        setTimeout(() => {
          li.classList.remove('opacity-0');
        }, index * 400 + 200); // Slightly faster animation for list items
      });
      
      // Mark list as complete after the last item would be visible
      const listCompleteTimer = setTimeout(() => {
        setHasTypedList(true);
      }, response.items.length * 400 + 400);
      
      return () => clearTimeout(listCompleteTimer);
    };
    
    // Small delay before showing list items
    const timer = setTimeout(createListItems, 200); // Reduced delay before showing list
    
    return () => {
      clearTimeout(timer);
    };
  }, [isAnswerVisible, hasTypedIntro, currentQuestionIndex, hasTypedList, isMobile]);
  
  // Type the footer text
  useEffect(() => {
    if (!isAnswerVisible || !hasTypedList || !footerRef.current) return;
    
    const response = CHAT_RESPONSES[currentQuestionIndex as keyof typeof CHAT_RESPONSES];
    if (!response || !response.footer) return;
    
    const typed = new Typed(footerRef.current, {
      strings: [response.footer],
      typeSpeed: 20,
      startDelay: 500, // Reduced delay before typing footer
      showCursor: false
    });
    
    setFooterTyped(typed);
    
    return () => {
      typed.destroy();
      setFooterTyped(null);
    };
  }, [isAnswerVisible, hasTypedList, currentQuestionIndex]);
  
  // Only render content for the current question if a response exists
  const hasResponse = Boolean(CHAT_RESPONSES[currentQuestionIndex as keyof typeof CHAT_RESPONSES]);
  
  if (!hasResponse) {
    return null;
  }
  
  return (
    <div className={className}>
      <p className={`${isMobile ? 'text-sm ' : ''}mb-2 break-words`} ref={introTextRef}></p>
      <ul className={`ml-4 list-disc ${isMobile ? 'space-y-1' : 'space-y-1.5'}`} ref={listItemsRef}></ul>
      {!isMobile && <p className="mt-3" ref={footerRef}></p>}
    </div>
  );
} 
