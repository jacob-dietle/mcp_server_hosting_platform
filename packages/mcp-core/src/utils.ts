import { Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { CoreConfig } from "./types";

// Helper function to recursively sanitize schema objects
const sanitizeSchema = (schema: unknown): unknown => {
  if (!schema || typeof schema !== "object") return schema;

  if (Array.isArray(schema)) {
    return schema.map((item) => sanitizeSchema(item));
  }

  const schemaObj = schema as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schemaObj)) {
    if (
      key === "properties" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const propertiesObj = value as Record<string, unknown>;
      const sanitizedProps: Record<string, unknown> = {};
      const keyMapping: Record<string, string> = {};

      for (const [propKey, propValue] of Object.entries(propertiesObj)) {
        const sanitizedKey = propKey.replace(/[^a-zA-Z0-9_-]/g, "_");
        keyMapping[propKey] = sanitizedKey;
        sanitizedProps[sanitizedKey] = sanitizeSchema(propValue);
      }

      sanitized[key] = sanitizedProps;

      if ("required" in schemaObj && Array.isArray(schemaObj.required)) {
        sanitized.required = (schemaObj.required as string[]).map(
          (req: string) => keyMapping[req] || req,
        );
      }
    } else {
      sanitized[key] = sanitizeSchema(value);
    }
  }

  return sanitized;
};

export const mappedTools = (tools: Tool[]) => {
  return tools.map((tool: Tool) => {
    let inputSchema;
    if (tool.input_schema) {
      inputSchema = JSON.parse(JSON.stringify(tool.input_schema));
    } else {
      inputSchema = {
        type: "object",
        properties: {},
        required: [],
      };
    }

    if (!inputSchema.type) {
      inputSchema.type = "object";
    }

    if (inputSchema.type === "object" && !inputSchema.properties) {
      inputSchema.properties = {};
    }

    const sanitizedSchema = sanitizeSchema(inputSchema);

    return {
      name: tool.name,
      description: tool.description,
      input_schema: sanitizedSchema,
    } as Tool;
  });
};

export const createDefaultConfig = (): CoreConfig => ({
    mcpServerRequestTimeout: 10000,
    mcpRequestTimeoutResetOnProgress: true,
    mcpRequestMaxTotalTimeout: 60000,
}); 
