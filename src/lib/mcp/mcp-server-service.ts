import 'server-only'

import { LettaClient } from '@letta-ai/letta-client'
import { createClient } from '@/lib/supabase/server'

export interface MCPServerConfig {
  serverName: string
  serverUrl: string
  authToken?: string
  customHeaders?: Record<string, string>
  serverType?: string
}

export interface MCPServerRegistrationResult {
  serverName: string
  serverUrl: string
  toolsRegistered: string[]
  agentId: string
}

export class MCPServerService {
  private lettaClient: LettaClient
  private supabase: any

  constructor(supabaseClient?: any) {
    this.lettaClient = new LettaClient({
      token: process.env.LETTA_API_KEY,
      baseUrl: process.env.LETTA_API_BASE_URL
    })
    this.supabase = supabaseClient
  }

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Register MCP server with Letta using the streamable_http transport
   * Based on: https://docs.letta.com/api-reference/tools/add-mcp-server
   */
  async registerMCPServer(config: MCPServerConfig): Promise<void> {
    try {
      // Use the proper Letta SDK method for streamable_http transport
      await this.lettaClient.tools.addMcpServer({
        serverName: config.serverName,
        serverUrl: config.serverUrl,
        type: "streamable_http" as any
      })

      console.log(`MCP server registered: ${config.serverName}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Check if server already exists
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        console.log(`MCP server already exists: ${config.serverName}`)
        return
      }
      
      throw new Error(`Failed to register MCP server: ${errorMessage}`)
    }
  }

  /**
   * Get all tools from an MCP server
   * Based on: https://docs.letta.com/api-reference/tools/list-mcp-tools-by-server
   */
  async getMCPServerTools(serverName: string): Promise<Array<{ name: string; description?: string }>> {
    try {
      const tools = await this.lettaClient.tools.listMcpToolsByServer(serverName)
      
      return tools.map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    } catch (error) {
      throw new Error(`Failed to get tools from MCP server: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Add MCP tool to Letta and attach to agent
   * Based on: https://docs.letta.com/api-reference/tools/add-mcp-tool
   */
  async attachMCPToolToAgent(serverName: string, toolName: string, agentId: string): Promise<void> {
    try {
      // First, add the tool to Letta from the MCP server
      const tool = await this.lettaClient.tools.addMcpTool(serverName, toolName)
      
      // Then attach the tool to the agent
      if (tool.id) {
        // Get current agent to preserve existing tools
        const currentAgent = await this.lettaClient.agents.retrieve(agentId)
        const existingToolIds = (currentAgent.tools || [])
          .map(t => typeof t === 'string' ? t : t.id)
          .filter((id): id is string => typeof id === 'string')

        // Update agent with new tool (additive)
        await this.lettaClient.agents.modify(agentId, {
          toolIds: [...existingToolIds, tool.id]
        })

        console.log(`Tool ${toolName} attached to agent ${agentId}`)
      }
    } catch (error) {
      throw new Error(`Failed to attach tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Complete flow: Register server and attach all tools to user's primary agent
   */
  async registerAndAttachMCPServer(
    userId: string,
    deploymentId: string,
    config: MCPServerConfig
  ): Promise<MCPServerRegistrationResult> {
    try {
      // Step 1: Save to database
      await this.saveMCPServerToDatabase(userId, deploymentId, config)

      // Step 2: Register with Letta
      await this.registerMCPServer(config)

      // Step 3: Get user's primary agent
      const primaryAgent = await this.getUserPrimaryAgent(userId)
      if (!primaryAgent) {
        throw new Error(`No primary agent found for user ${userId}`)
      }

      // Step 4: Get all tools from the server
      const tools = await this.getMCPServerTools(config.serverName)

      // Step 5: Attach all tools to the agent
      const registeredTools: string[] = []
      for (const tool of tools) {
        try {
          await this.attachMCPToolToAgent(config.serverName, tool.name, primaryAgent.id)
          registeredTools.push(tool.name)
        } catch (error) {
          console.error(`Failed to attach tool ${tool.name}:`, error)
          // Continue with other tools
        }
      }

      console.log(`MCP server registration completed: ${config.serverName}, ${registeredTools.length} tools attached`)

      return {
        serverName: config.serverName,
        serverUrl: config.serverUrl,
        toolsRegistered: registeredTools,
        agentId: primaryAgent.id
      }
    } catch (error) {
      throw new Error(`MCP server registration failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Save MCP server to database
   */
  private async saveMCPServerToDatabase(
    userId: string,
    deploymentId: string,
    config: MCPServerConfig
  ): Promise<void> {
    const supabase = await this.getSupabase()
    
    // Store all configuration in the existing 'config' JSONB column
    const serverConfig = {
      server_url: config.serverUrl,
      server_type: config.serverType || 'generic',
      transport_type: 'streamable_http',
      auth_token: config.authToken,
      custom_headers: config.customHeaders || {},
      deployment_id: deploymentId,
      status: 'active'
    }
    
    const { error } = await supabase
      .schema('auth_logic')
      .from('mcp_servers')
      .insert({
        user_id: userId,
        name: config.serverName,
        config: serverConfig
      })

    if (error) {
      throw new Error(`Failed to save MCP server to database: ${error.message}`)
    }
  }

  /**
   * Get user's primary agent (trial agent or first agent)
   */
  private async getUserPrimaryAgent(userId: string) {
    try {
      // First, try to get the user's trial agent
      const supabase = await this.getSupabase()
      const { data: trialApp } = await supabase
        .schema('auth_logic')
        .from('trial_applications')
        .select('agent_id')
        .eq('user_id', userId)
        .not('agent_id', 'is', null)
        .order('applied_at', { ascending: false })
        .limit(1)
        .single()

      if (trialApp?.agent_id) {
        try {
          return await this.lettaClient.agents.retrieve(trialApp.agent_id)
        } catch (error) {
          console.warn(`Trial agent ${trialApp.agent_id} not found in Letta`)
        }
      }

      // Fallback: Get user's first agent by user tag
      const userTag = `user:${userId}`
      const agents = await this.lettaClient.agents.list({
        tags: [userTag],
        matchAllTags: true
      })

      if (agents.length === 0) {
        return null
      }

      // Return the first/oldest agent
      return agents.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateA - dateB
      })[0]

    } catch (error) {
      throw new Error(`Failed to get user primary agent: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export const mcpServerService = new MCPServerService() 