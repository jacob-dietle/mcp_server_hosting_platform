"use client"

import React, { useEffect, useRef } from 'react';
import Typed from 'typed.js';
import { CHAT_QUESTIONS, CHAT_RESPONSES, ANIMATION_CONFIG, useChatContext } from './chat-context';

interface TypedQuestionsProps {
  className?: string;
}

export function TypedQuestions({ className }: TypedQuestionsProps) {
  const typeTarget = useRef<HTMLSpanElement>(null);
  const { setCurrentQuestionIndex, setAnswerVisible } = useChatContext();

  useEffect(() => {
    if (!typeTarget.current) return;

    // Calculate a reasonable backDelay based on response length
    // This ensures a long response has time to fully animate before moving to next question
    const calculateBackDelay = (currentIndex: number) => {
      const response = CHAT_RESPONSES[currentIndex as keyof typeof CHAT_RESPONSES];
      
      if (!response) return ANIMATION_CONFIG.minimumResponseVisibleTime; // Default delay if no response
      
      // Calculate an approximate time needed based on response content length
      const totalResponseLength = 
        response.text.length + 
        response.items.reduce((acc, item) => acc + item.length, 0) + 
        (response.footer?.length || 0);
      
      // Calculate time based on content length plus minimum time
      const timeNeeded = 
        ANIMATION_CONFIG.minimumResponseVisibleTime + 
        (totalResponseLength * ANIMATION_CONFIG.timePerCharacter);
      
      // Return calculated time with a safety buffer
      return timeNeeded;
    };

    const typed = new Typed(typeTarget.current, {
      strings: CHAT_QUESTIONS,
      typeSpeed: 50,
      backSpeed: 30,
      backDelay: ANIMATION_CONFIG.minimumResponseVisibleTime, // Start with a reasonable delay
      startDelay: 1000,
      loop: true,
      cursorChar: '|',
      smartBackspace: true,
      onStringTyped: (arrayPos) => {
        // When a string is fully typed:
        setCurrentQuestionIndex(arrayPos);
        
        // Show the answer with a slight delay to simulate thinking
        setAnswerVisible(false);
        setTimeout(() => {
          setAnswerVisible(true);
        }, ANIMATION_CONFIG.answerDelay);
        
        // Dynamically set the backDelay based on current question's response length
        // Access the internal typing object which has the typeable methods
        const typingInstance = typed as unknown as { options: { backDelay: number } };
        typingInstance.options.backDelay = calculateBackDelay(arrayPos);
      },
      onStart: () => {
        // Hide answer when backspacing/starting new question
        setAnswerVisible(false);
      }
    });

    return () => {
      typed.destroy();
    };
  }, [setCurrentQuestionIndex, setAnswerVisible]);

  return <span ref={typeTarget} className={className}></span>;
} 
