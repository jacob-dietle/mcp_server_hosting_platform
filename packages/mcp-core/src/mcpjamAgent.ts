import { MCPJamClient } from "./mcpjamClient";
import {
  CoreConfig,
  MCPJamServerConfig,
  StdErrNotification,
} from "./types";
import {
  Tool,
  Resource,
  Prompt,
  ServerCapabilities,
  CreateMessageRequest,
  CreateMessageResult,
} from "@modelcontextprotocol/sdk/types.js";
import { createDefaultConfig } from "./utils";

export interface MCPClientOptions {
  servers: Record<string, MCPJamServerConfig>;
  config?: CoreConfig;
  claudeApiKey?: string;
  onStdErrNotification?: (notification: StdErrNotification) => void;
  // This is a placeholder for potential future use where agent needs to handle requests.
  onPendingRequest?: (
    request: CreateMessageRequest,
    resolve: (result: CreateMessageResult) => void,
    reject: (error: Error) => void,
  ) => void;
}

export interface ServerConnectionInfo {
  name: string;
  config: MCPJamServerConfig;
  client: MCPJamClient | null;
  connectionStatus: string;
  capabilities: ServerCapabilities | null;
}

export class MCPJamAgent {
  private mcpClientsById = new Map<string, MCPJamClient>();
  private serverConfigs: Record<string, MCPJamServerConfig>;
  private config: CoreConfig;
  private claudeApiKey?: string;
  private onStdErrNotification?: (notification: StdErrNotification) => void;
  private onPendingRequest?: (
    request: CreateMessageRequest,
    resolve: (result: CreateMessageResult) => void,
    reject: (error: Error) => void,
  ) => void;
  
  constructor(options: MCPClientOptions) {
    this.serverConfigs = options.servers;
    this.config = options.config || createDefaultConfig();
    this.claudeApiKey = options.claudeApiKey;
    this.onStdErrNotification = options.onStdErrNotification;
    this.onPendingRequest = options.onPendingRequest;
  }

  setClaudeApiKey(apiKey: string) {
    this.claudeApiKey = apiKey;
    // Propagate the new key to all existing client instances
    this.mcpClientsById.forEach(client => {
      client.setClaudeApiKey(apiKey);
    });
  }

  updateConfig(newConfig: Partial<CoreConfig>) {
    this.config = { ...this.config, ...newConfig };
    // Update existing clients with new config
    this.mcpClientsById.forEach(client => {
      client.config = { ...client.config, ...newConfig };
    });
  }

  getConfig(): CoreConfig {
    return { ...this.config };
  }

  addServer(name: string, config: MCPJamServerConfig) {
    this.serverConfigs[name] = config;
  }

  async removeServer(name: string) {
    const client = this.mcpClientsById.get(name);
    if (client) {
      await client.disconnect();
      this.mcpClientsById.delete(name);
    }
    delete this.serverConfigs[name];
  }

  getServerNames(): string[] {
    return Object.keys(this.serverConfigs);
  }

  getAllConnectionInfo(): ServerConnectionInfo[] {
    return Object.entries(this.serverConfigs).map(([name, config]) => {
      const client = this.mcpClientsById.get(name);
      return {
        name,
        config,
        client: client || null,
        connectionStatus: client?.connectionStatus || "disconnected",
        capabilities: client?.serverCapabilities || null,
      };
    });
  }

  async connectToServer(serverName: string): Promise<MCPJamClient> {
    const serverConfig = this.serverConfigs[serverName];
    if (!serverConfig) {
      throw new Error(`Server ${serverName} not found`);
    }
    return this.getOrCreateClient(serverName, serverConfig);
  }

  async connectToAllServers(): Promise<void> {
    const promises = Object.keys(this.serverConfigs).map(serverName =>
      this.connectToServer(serverName).catch(error => {
        console.error(`Failed to connect to server ${serverName}:`, error);
        return null;
      }),
    );
    await Promise.all(promises);
  }

  async disconnectFromServer(serverName: string): Promise<void> {
    const client = this.mcpClientsById.get(serverName);
    if (client) {
      await client.disconnect();
    }
  }

  async disconnectFromAllServers(): Promise<void> {
    const promises = Array.from(this.mcpClientsById.values()).map(client =>
      client.disconnect().catch(error => console.error(`Failed to disconnect a client:`, error))
    );
    await Promise.all(promises);
  }

  getClient(serverName: string): MCPJamClient | undefined {
    return this.mcpClientsById.get(serverName);
  }

  getAllClients(): Map<string, MCPJamClient> {
    return new Map(this.mcpClientsById);
  }

  private async getOrCreateClient(name: string, config: MCPJamServerConfig): Promise<MCPJamClient> {
    const existingClient = this.mcpClientsById.get(name);
    if (existingClient?.connectionStatus === "connected") {
      return existingClient;
    }

    if (existingClient?.connectionStatus === "disconnected") {
        try {
            await existingClient.connectToServer();
            return existingClient;
        } catch (error) {
            console.error(`Failed to reconnect existing client ${name}:`, error);
        }
    }

    const newClient = new MCPJamClient(
      config,
      this.config,
      this.claudeApiKey,
      undefined, // authToken - this needs to be provided per-server if needed.
      this.onStdErrNotification
    );

    await newClient.connectToServer();
    this.mcpClientsById.set(name, newClient);
    return newClient;
  }

  private async getConnectedClientForServer(serverName: string): Promise<MCPJamClient> {
    const serverConfig = this.serverConfigs[serverName];
    if (!serverConfig) throw new Error(`Server ${serverName} not found`);
    return this.getOrCreateClient(serverName, serverConfig);
  }

  async getAllTools(): Promise<{ serverName: string; tools: any[] }[]> {
    const allServerTools: { serverName: string; tools: any[] }[] = [];
    for (const serverName of this.getServerNames()) {
      try {
        const client = await this.getConnectedClientForServer(serverName);
        const tools = await client.tools();
        allServerTools.push({ serverName, tools });
      } catch (error) {
        console.error(`Could not get tools for ${serverName}:`, error);
        allServerTools.push({ serverName, tools: [] });
      }
    }
    return allServerTools;
  }

  async getAllResources(): Promise<{ serverName: string; resources: Resource[] }[]> {
    // Implementation requires resources/list which is not yet implemented in MCPJamClient
    console.warn("getAllResources is not fully implemented yet.");
    return [];
  }

  async getAllPrompts(): Promise<{ serverName: string; prompts: Prompt[] }[]> {
    // Implementation requires prompts/list which is not yet implemented in MCPJamClient
    console.warn("getAllPrompts is not fully implemented yet.");
    return [];
  }

  async processQuery(
    query: string,
    tools: any[],
    onUpdate?: (content: string) => void
  ): Promise<string> {
    const connectedClients = Array.from(this.mcpClientsById.values()).filter(
      (client) => client.connectionStatus === "connected"
    );

    if (connectedClients.length === 0) {
      const errorMsg = "No connected servers available to process query.";
      onUpdate?.(`[Error: ${errorMsg}]`);
      throw new Error(errorMsg);
    }

    // For now, let's use the first connected client.
    // A more advanced strategy could be implemented here later.
    const client = connectedClients[0];

    // The tool definitions from MCP servers use camelCase 'inputSchema',
    // but the underlying client expects snake_case 'input_schema'.
    // We map them here.
    const mappedToolsForClient = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema || { type: 'object', properties: {} },
    }));

    try {
      return await client.processQuery(query, mappedToolsForClient, onUpdate);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onUpdate?.(`[Error processing query on ${client.serverConfig.url}: ${errorMessage}]`);
      throw error;
    }
  }
}
