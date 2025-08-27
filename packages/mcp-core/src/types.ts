import {
    ClientCapabilities,
    NotificationSchema as BaseNotificationSchema,
    ClientNotificationSchema,
    ServerNotificationSchema,
  } from "@modelcontextprotocol/sdk/types.js";
  import { z } from "zod";
  
  // From client/src/lib/constants.ts
  export type ConnectionStatus =
    | "disconnected"
    | "connected"
    | "error";
  
  // From client/src/lib/notificationTypes.ts
  export const StdErrNotificationSchema = BaseNotificationSchema.extend({
    method: z.literal("notifications/stderr"),
    params: z.object({
      content: z.string(),
    }),
  });
  
  export const NotificationSchema = ClientNotificationSchema.or(
    StdErrNotificationSchema
  )
    .or(ServerNotificationSchema)
    .or(BaseNotificationSchema);
  
  export type StdErrNotification = z.infer<typeof StdErrNotificationSchema>;
  export type Notification = z.infer<typeof NotificationSchema>;
  
  
  // From client/src/lib/serverTypes.ts, simplified for core package
  export type BaseServerOptions = {
    transportType: "stdio" | "sse" | "streamable-http";
    timeout?: number;
    capabilities?: ClientCapabilities;
    enableServerLogs?: boolean;
  };
  
  export type StdioServerDefinition = BaseServerOptions & {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    url?: never;
    requestInit?: never;
  };
  
  export type HttpServerDefinition = BaseServerOptions & {
    url: URL;
    requestInit?: RequestInit;
  };
  
  export type MCPJamServerConfig = StdioServerDefinition | HttpServerDefinition;
  
  // From client/src/lib/configurationTypes.ts, simplified for core package
  export type CoreConfig = {
    mcpServerRequestTimeout: number;
    mcpRequestTimeoutResetOnProgress: boolean;
    mcpRequestMaxTotalTimeout: number;
  }; 
  