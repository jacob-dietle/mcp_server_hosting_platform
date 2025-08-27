"use client"

import React, { createContext, useState, useContext } from 'react';

// Define our questions and corresponding answers
export const CHAT_QUESTIONS = [
  "Who are the key VCs actively investing in quantum computing hardware right now?",
  "Map the competitive landscape for carbon capture technologies",
  "What partnerships exist between aerospace corporates and deeptech startups?",
  "Identify potential customers for advanced battery technology in industrial applications",
  "Which deeptech founders previously exited in the renewable energy space?",
  "Find me suitable manufacturing partners for quantum sensing devices"
];

// Only creating one response for now - for the first question about quantum computing
export const CHAT_RESPONSES = {
  0: {
    text: "Based on my analysis of recent funding data and the deeptech directory, here are the top VCs active in quantum computing hardware:",
    items: [
      "<strong>Quantum Capital Partners</strong> - Led Series A for QubitTech ($12M) and seed round for QuantumWave ($4M)",
      "<strong>Deeptech Capital Group</strong> - Invested in 3 quantum hardware startups in the last 18 months",
      "<strong>InGen Ventures</strong> - Recently raised a $150M fund specifically for quantum technologies"
    ],
    footer: "You are connected to two partners at Quantum Capital Partners through your network. Would you like me to identify a warm intro path for these firms?"
  },
  // Adding partial responses for other questions to ensure a smooth experience
  1: {
    text: "I've identified 37 companies in the carbon capture space. Here's a breakdown by technology approach:",
    items: [
      "<strong>Direct Air Capture (DAC)</strong> - 14 companies including Carbon Engineering and Climeworks",
      "<strong>Biological Capture</strong> - 9 companies using algae and microorganisms",
      "<strong>Mineralization</strong> - 8 companies focused on carbon sequestration in minerals"
    ],
    footer: "Several companies in this space have secured significant funding in the last 6 months. Would you like details on specific technology approaches?"
  }
};

// Animation timing configuration
export const ANIMATION_CONFIG = {
  // Minimum time (ms) to show response before moving to next question
  minimumResponseVisibleTime: 8000,
  // Delay after question is typed before showing the answer
  answerDelay: 500,
  // Additional display time per character in response
  timePerCharacter: 15
};

type ChatContextType = {
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  isAnswerVisible: boolean;
  setAnswerVisible: (visible: boolean) => void;
};

const ChatContext = createContext<ChatContextType>({
  currentQuestionIndex: 0,
  setCurrentQuestionIndex: () => {},
  isAnswerVisible: false,
  setAnswerVisible: () => {}
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isAnswerVisible, setAnswerVisible] = useState(false);

  return (
    <ChatContext.Provider value={{
      currentQuestionIndex,
      setCurrentQuestionIndex,
      isAnswerVisible,
      setAnswerVisible
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext); 
