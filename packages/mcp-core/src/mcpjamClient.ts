import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  Request,
  Result,
  Notification,
  ServerCapabilities,
  ClientRequest,
  McpError,
  ErrorCode,
  CreateMessageResult,
  CreateMessageRequest,
  CompleteResultSchema,
  ResourceReference,
  PromptReference
} from "@modelcontextprotocol/sdk/types.js";
import { Anthropic } from "@anthropic-ai/sdk";
import {
  MessageParam,
  Tool,
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import {
  CoreConfig,
  HttpServerDefinition,
  MCPJamServerConfig,
  ConnectionStatus,
  StdErrNotification,
  StdErrNotificationSchema,
} from "./types";
import { createDefaultConfig, mappedTools } from "./utils";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  SSEClientTransport,
  SSEClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";

export class MCPJamClient extends Client<Request, Notification, Result> {
  anthropic?: Anthropic;
  clientTransport: Transport | undefined;
  config: CoreConfig;
  serverConfig: MCPJamServerConfig;
  headers: HeadersInit;
  connectionStatus: ConnectionStatus;
  serverCapabilities: ServerCapabilities | null;
  completionsSupported: boolean;
  onStdErrNotification?: (notification: StdErrNotification) => void;

  onError?: (error: Error) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;

  constructor(
    serverConfig: MCPJamServerConfig,
    config?: CoreConfig,
    claudeApiKey?: string,
    authToken?: string,
    onStdErrNotification?: (notification: StdErrNotification) => void,
    onError?: (error: Error) => void,
    onConnectionStatusChange?: (status: ConnectionStatus) => void,
  ) {
    super(
      { name: "mcp-core", version: "0.0.1" },
      {
        capabilities: {
          sampling: {},
          roots: { listChanged: true },
        },
      },
    );

    if (claudeApiKey) {
      this.anthropic = new Anthropic({ 
        apiKey: claudeApiKey,
        dangerouslyAllowBrowser: true 
      });
    }

    this.config = config || createDefaultConfig();
    this.serverConfig = serverConfig;
    this.headers = {};

    if (authToken) {
      this.headers["Authorization"] = `Bearer ${authToken}`;
    }

    this.connectionStatus = "disconnected";
    this.serverCapabilities = null;
    this.completionsSupported = true;
    this.onStdErrNotification = onStdErrNotification;
    this.onError = onError;
    this.onConnectionStatusChange = onConnectionStatusChange;

    if (this.onStdErrNotification) {
        this.setNotificationHandler(
            StdErrNotificationSchema,
            this.onStdErrNotification,
        );
    }
  }

  setClaudeApiKey(apiKey: string) {
    if (apiKey) {
      this.anthropic = new Anthropic({ 
        apiKey,
        dangerouslyAllowBrowser: true 
      });
    } else {
      this.anthropic = undefined;
    }
  }

  private setConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
    this.onConnectionStatusChange?.(status);
  }

  async connectToServer(): Promise<void> {
    this.setConnectionStatus("disconnected");
    try {
      if (this.serverConfig.transportType === "sse") {
        await this.connectSSE();
      } else if (this.serverConfig.transportType === "streamable-http") {
        await this.connectStreamableHttp();
      } else if (this.serverConfig.transportType === 'stdio') {
        throw new Error("Direct STDIO transport is not supported in this library.");
      } else {
        throw new Error(`Unsupported transport type: ${this.serverConfig.transportType}`);
      }
      this.setConnectionStatus("connected");
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("Error connecting to MCP server:", err);
        this.setConnectionStatus("error");
        this.onError?.(err);
        throw err;
    }
  }

  async connectSSE() {
    const serverUrl = (this.serverConfig as HttpServerDefinition).url;
    const transportOptions: SSEClientTransportOptions = {
      eventSourceInit: {
        fetch: (url, init) => fetch(url, { ...init, headers: this.headers }),
      },
      requestInit: { headers: this.headers },
    };
    this.clientTransport = new SSEClientTransport(serverUrl, transportOptions);
    await this.connect(this.clientTransport);
  }

  async connectStreamableHttp() {
    const serverUrl = (this.serverConfig as HttpServerDefinition).url;
    const transportOptions: StreamableHTTPClientTransportOptions = {
      requestInit: { headers: this.headers },
      reconnectionOptions: {
        maxReconnectionDelay: 30000,
        initialReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1.5,
        maxRetries: 2,
      },
    };
    this.clientTransport = new StreamableHTTPClientTransport(serverUrl, transportOptions);
    await this.connect(this.clientTransport);
  }

  async makeRequest<T extends z.ZodType>(
    request: ClientRequest,
    schema: T,
    options?: RequestOptions,
  ): Promise<z.output<T>> {
    const requestOptions = {
      timeout: this.config.mcpServerRequestTimeout,
      resetOnProgress: this.config.mcpRequestTimeoutResetOnProgress,
      maxTotalTimeout: this.config.mcpRequestMaxTotalTimeout,
      ...options,
    };
    if (!this.clientTransport) throw new Error("Client not connected");
    try {
      return await this.request(request, schema, requestOptions);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Request failed for method ${request.method}:`, err);
      this.onError?.(err);
      throw err;
    }
  }

  async tools() {
    const response = await this.makeRequest({ method: "tools/list" }, z.object({ tools: z.array(z.any()) }));
    return response.tools;
  }

  async callTool(toolCall: { name: string; arguments: Record<string, unknown> }) {
    const response = await this.makeRequest(
      { 
        method: 'tools/call', 
        params: { 
          name: toolCall.name, 
          arguments: toolCall.arguments 
        } 
      }, 
      z.any()
    );
    return response;
  }
  
  async disconnect() {
    if (this.clientTransport) {
      await super.close();
      this.clientTransport = undefined;
    }
    this.setConnectionStatus("disconnected");
  }

  async setServerCapabilities(capabilities: ServerCapabilities) {
    this.serverCapabilities = capabilities;
  }
  
  async processQuery(
    query: string,
    tools: Tool[],
    onUpdate?: (content: string) => void,
    model: string = "claude-3-5-sonnet-latest",
  ): Promise<string> {
    if (!this.anthropic) throw new Error("Anthropic client not initialized");
    const context = this.initializeQueryContext(query, tools, model);
    const response = await this.makeInitialApiCall(context);
    return this.processIterations(response, context, onUpdate);
  }

  private initializeQueryContext(query: string, tools: Tool[], model: string) {
    return {
      messages: [{ role: "user" as const, content: query }] as MessageParam[],
      finalText: [] as string[],
      sanitizedTools: mappedTools(tools),
      model,
      MAX_ITERATIONS: 5,
    };
  }

  private async makeInitialApiCall(context: ReturnType<typeof this.initializeQueryContext>) {
    return this.anthropic!.messages.create({
      model: context.model,
      max_tokens: 1000,
      messages: context.messages,
      tools: context.sanitizedTools,
    });
  }

  private async processIterations(
    initialResponse: Message,
    context: ReturnType<typeof this.initializeQueryContext>,
    onUpdate?: (content: string) => void,
  ): Promise<string> {
    let response = initialResponse;
    for (let i = 0; i < context.MAX_ITERATIONS; i++) {
      const { content, hasToolUse } = await this.processIteration(response, context);
      this.sendIterationUpdate(content, onUpdate);
      if (!hasToolUse) break;

      try {
        response = await this.makeFollowUpApiCall(context);
      } catch (error) {
        const errorMessage = `[API Error: ${error}]`;
        context.finalText.push(errorMessage);
        this.sendIterationUpdate(errorMessage, onUpdate);
        break;
      }
      if (i === context.MAX_ITERATIONS - 1) {
          const warn = `[Warning: Reached max iterations]`;
          context.finalText.push(warn);
          this.sendIterationUpdate(warn, onUpdate);
      }
    }
    return context.finalText.join("\n");
  }

  private async processIteration(response: Message, context: ReturnType<typeof this.initializeQueryContext>) {
    const iterationContent: string[] = [];
    const assistantContent: ContentBlock[] = [];
    let hasToolUse = false;
    for (const content of response.content) {
      if (content.type === "text") {
        iterationContent.push(content.text);
        context.finalText.push(content.text);
        assistantContent.push(content);
      } else if (content.type === "tool_use") {
        hasToolUse = true;
        assistantContent.push(content);
        const toolMessage = `[Calling tool ${content.name} with args ${JSON.stringify(content.input)}]`;
        iterationContent.push(toolMessage);
        context.finalText.push(toolMessage);
        try {
          if (typeof content.input !== 'object' || content.input === null) {
            throw new Error('Tool input must be an object.');
          }
          const result = await this.makeRequest({ method: 'tools/call', params: { name: content.name, arguments: content.input as Record<string, unknown> } }, z.any());
          this.addMessagesToContext(context, assistantContent, content.id, result.content as string);
        } catch (error) {
            const errorMessage = `[Tool ${content.name} failed: ${error}]`;
            iterationContent.push(errorMessage);
            context.finalText.push(errorMessage);
            this.addMessagesToContext(context, assistantContent, content.id, `Error: ${error}`, true);
        }
      }
    }
    return { content: iterationContent, hasToolUse };
  }
  
  private addMessagesToContext(context: ReturnType<typeof this.initializeQueryContext>, assistantContent: ContentBlock[], toolUseId: string, resultContent: string, isError = false) {
    if (assistantContent.length > 0) {
      context.messages.push({ role: "assistant", content: assistantContent });
    }
    context.messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUseId, content: resultContent, ...(isError && { is_error: true }) }],
    });
  }

  private async makeFollowUpApiCall(context: ReturnType<typeof this.initializeQueryContext>) {
    return this.anthropic!.messages.create({
      model: context.model,
      max_tokens: 1000,
      messages: context.messages,
      tools: context.sanitizedTools,
    });
  }

  private sendIterationUpdate(content: string | string[], onUpdate?: (content: string) => void) {
    if (!onUpdate) return;
    const message = Array.isArray(content) ? content.join("\n") : content;
    if (message.length > 0) onUpdate(message);
  }

  async cleanup(): Promise<void> {
    await this.disconnect();
  }
}
