// Core Client and Agent
export { MCPJamClient } from './mcpjamClient';
export { MCPJamAgent } from './mcpjamAgent';

// Main options and info interfaces
export type { MCPClientOptions, ServerConnectionInfo } from './mcpjamAgent';

// Configuration and Type Definitions
export type {
    CoreConfig,
    ConnectionStatus,
    StdErrNotification,
    MCPJamServerConfig,
    HttpServerDefinition,
    StdioServerDefinition,
    BaseServerOptions
} from './types';

// Utility functions
export { createDefaultConfig } from './utils'; 