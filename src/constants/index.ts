// Application constants

// Environment
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'

// API URLs
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

// Add any other constants here as needed

/**
 * @type {string}
 */
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export const USE_COOKIE_BASED_AUTHENTICATION =
  process.env.USE_COOKIE_BASED_AUTHENTICATION === 'true';

// Log levels: 'debug', 'info', 'warn', 'error', 'none'
export const LOG_LEVEL = process.env.LOG_LEVEL || 'error';

// UI Text Constants
export const TEXTBOX_PLACEHOLDER = "Type a message..."
export const DEFAULT_BOT_MESSAGE = "Hello! How can I help you today?"
export const ERROR_CONNECTING = "Error connecting to server"
export const NO_MESSAGES_LABEL = "No messages yet"
export const MESSAGE_POPOVER_DESCRIPTION = "Click here to see suggested actions"

// Suggested chat actions
export const suggestedChatActions = [
  { 
    title: "Get Started", 
    description: "Ask me anything",
    message: "Hello! What can you help me with?"
  }
] 
