import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Letta } from '@letta-ai/letta-client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Letta message utilities
export function extractMessageText(content: any): string {
  if (!content) return ''
  
  // If the content is already a string, return it
  if (typeof content === 'string') {
    // Remove any JSON message wrapper if present
    if (content.startsWith('{"message":')) {
      try {
        const parsed = JSON.parse(content)
        return parsed.message || content
      } catch {
        return content
      }
    }
    return content
  }
  
  // Handle array of content (AssistantMessageContent)
  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') return item
      if (item.text) return item.text
      if (item.content) return item.content
      return ''
    }).join(' ')
  }
  
  // Handle object with text property
  if (typeof content === 'object' && content.text) {
    return content.text
  }
  
  return String(content)
}

export function getMessageId(response: any): string {
  // Handle streaming response or message with ID
  if (response && 'id' in response && response.id) {
    return response.id
  }
  
  // Generate a unique ID if none exists
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
} 
