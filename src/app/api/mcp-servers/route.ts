import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface MCPServerRecord {
  id: string
  user_id: string
  name: string
  config: {
    url: string
    transportType: 'sse' | 'streamable-http'
  }
  created_at: string
  updated_at: string
}

interface CreateMCPServerRequest {
  name: string
  config: {
    url: string
    transportType: 'sse' | 'streamable-http'
  }
}

// GET - List MCP servers for user
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('MCP servers list request started', { 
      requestId,
      endpoint: '/api/mcp-servers',
      method: 'GET'
    })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      logger.warn('Unauthenticated MCP servers request', { requestId })
      return NextResponse.json({ 
        success: false,
        error: { 
          code: 'UNAUTHORIZED', 
          message: 'Authentication required' 
        } 
      }, { status: 401 })
    }

    // Check for impersonation headers
    const impersonationSession = request.headers.get('X-Impersonation-Session')
    const impersonatedUserId = request.headers.get('X-Impersonated-User-Id')
    
    let effectiveUserId = user.id
    let isImpersonating = false
    
    if (impersonationSession && impersonatedUserId) {
      effectiveUserId = impersonatedUserId
      isImpersonating = true
      logger.info('Impersonation detected for MCP servers list', { 
        requestId,
        adminUserId: user.id,
        impersonatedUserId
      })
    }

    logger.debug('User authenticated for MCP servers list', { 
      requestId,
      userId: user.id, 
      effectiveUserId,
      isImpersonating 
    })

    // Fetch MCP servers for the effective user
    const { data: servers, error } = await supabase
      .schema('auth_logic')
      .from('mcp_servers')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Failed to fetch MCP servers', { 
        requestId, 
        effectiveUserId,
        isImpersonating,
        error: error.message 
      })
      throw new Error(`Failed to fetch MCP servers: ${error.message}`)
    }

    logger.info('MCP servers fetched successfully', {
      requestId,
      count: servers?.length || 0,
      effectiveUserId,
      isImpersonating,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: servers || [],
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('MCP servers list request failed', {
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch MCP servers'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

// POST - Create new MCP server
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Create MCP server request started', { 
      requestId,
      endpoint: '/api/mcp-servers',
      method: 'POST'
    })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      logger.warn('Unauthenticated MCP server creation attempt', { requestId })
      return NextResponse.json({ 
        success: false,
        error: { 
          code: 'UNAUTHORIZED', 
          message: 'Authentication required' 
        } 
      }, { status: 401 })
    }

    // Check for impersonation headers
    const impersonationSession = request.headers.get('X-Impersonation-Session')
    const impersonatedUserId = request.headers.get('X-Impersonated-User-Id')
    
    let effectiveUserId = user.id
    let isImpersonating = false
    
    if (impersonationSession && impersonatedUserId) {
      effectiveUserId = impersonatedUserId
      isImpersonating = true
      logger.info('Impersonation detected for MCP server creation', { 
        requestId,
        adminUserId: user.id,
        impersonatedUserId
      })
    }

    const body: CreateMCPServerRequest = await request.json()
    
    logger.debug('MCP server creation payload parsed', {
      requestId,
      serverName: body.name,
      transportType: body.config?.transportType,
      hasUrl: !!body.config?.url,
      effectiveUserId,
      isImpersonating
    })
    
    // Validate required fields
    if (!body.name || !body.config?.url) {
      logger.warn('Invalid MCP server request - missing required fields', {
        requestId,
        hasName: !!body.name,
        hasConfig: !!body.config,
        hasUrl: !!body.config?.url,
        effectiveUserId
      })
      
      return NextResponse.json({
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Missing required fields: name and config.url are required' 
        } 
      }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(body.config.url)
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid URL format'
        }
      }, { status: 400 })
    }

    // Check for duplicate server names for this user
    const { data: existingServer } = await supabase
      .schema('auth_logic')
      .from('mcp_servers')
      .select('name')
      .eq('user_id', effectiveUserId)
      .eq('name', body.name)
      .single()

    if (existingServer) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DUPLICATE_NAME',
          message: `Server with name "${body.name}" already exists`
        }
      }, { status: 409 })
    }

    // Create the MCP server record
    const newServerConfig = {
      name: body.name,
      user_id: effectiveUserId,
      config: {
        url: body.config.url,
        transportType: body.config.transportType || 'sse'
      }
    }

    const { data: createdServer, error } = await supabase
      .schema('auth_logic')
      .from('mcp_servers')
      .insert(newServerConfig)
      .select()
      .single()

    if (error) {
      logger.error('Failed to create MCP server', {
        requestId,
        serverName: body.name,
        effectiveUserId,
        isImpersonating,
        error: error.message
      })
      throw new Error(`Failed to create MCP server: ${error.message}`)
    }

    logger.info('MCP server created successfully', {
      requestId,
      serverId: createdServer.id,
      serverName: createdServer.name,
      effectiveUserId,
      isImpersonating,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: createdServer,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 201 })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Create MCP server request failed', {
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create MCP server'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
}

// DELETE - Delete MCP server by name
export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const serverName = searchParams.get('name')
    
    if (!serverName) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Server name is required'
        }
      }, { status: 400 })
    }

    logger.info('Delete MCP server request started', { 
      requestId,
      serverName,
      endpoint: '/api/mcp-servers',
      method: 'DELETE'
    })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      logger.warn('Unauthenticated MCP server deletion attempt', { requestId, serverName })
      return NextResponse.json({ 
        success: false,
        error: { 
          code: 'UNAUTHORIZED', 
          message: 'Authentication required' 
        } 
      }, { status: 401 })
    }

    // Check for impersonation headers
    const impersonationSession = request.headers.get('X-Impersonation-Session')
    const impersonatedUserId = request.headers.get('X-Impersonated-User-Id')
    
    let effectiveUserId = user.id
    let isImpersonating = false
    
    if (impersonationSession && impersonatedUserId) {
      effectiveUserId = impersonatedUserId
      isImpersonating = true
      logger.info('Impersonation detected for MCP server deletion', { 
        requestId,
        adminUserId: user.id,
        impersonatedUserId,
        serverName
      })
    }

    // Delete the MCP server
    const { error } = await supabase
      .schema('auth_logic')
      .from('mcp_servers')
      .delete()
      .eq('user_id', effectiveUserId)
      .eq('name', serverName)

    if (error) {
      logger.error('Failed to delete MCP server', {
        requestId,
        serverName,
        effectiveUserId,
        isImpersonating,
        error: error.message
      })
      throw new Error(`Failed to delete MCP server: ${error.message}`)
    }

    logger.info('MCP server deleted successfully', {
      requestId,
      serverName,
      effectiveUserId,
      isImpersonating,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: { deleted: serverName },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Delete MCP server request failed', {
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete MCP server'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 })
  }
} 
