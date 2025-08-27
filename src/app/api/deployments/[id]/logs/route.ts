import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDeploymentService } from '@/lib/deployment'
import { 
  GetDeploymentLogsRequest,
  GetDeploymentLogsResponse,
  AddDeploymentLogRequest,
  AddDeploymentLogResponse,
  StreamingLogEvent
} from '@/contracts/api-contracts'

const deploymentService = createDeploymentService()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: { 
          code: 'UNAUTHORIZED', 
          message: 'Authentication required' 
        } 
      }, { status: 401 })
    }

    const deploymentId = params.id
    const { searchParams } = new URL(request.url)
    const follow = searchParams.get('follow') === 'true'
    const level = searchParams.get('level')
    const since = searchParams.get('since')
    const until = searchParams.get('until')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Verify deployment exists and belongs to user
    const deployment = await deploymentService.getDeployment(deploymentId)
    
    if (!deployment || deployment.user_id !== user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: 'Deployment not found' 
          } 
        }, 
        { status: 404 }
      )
    }

    // If follow=true, return Server-Sent Events stream
    if (follow) {
      const encoder = new TextEncoder()
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial logs
            const initialLogs = await deploymentService.getDeploymentLogs(deploymentId, 50)

            // Send existing logs
            for (const log of initialLogs) {
              const event: StreamingLogEvent = {
                type: 'log',
                data: log
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            }

            // Set up real-time subscription for new logs
            const supabaseClient = await createClient()
            const subscription = supabaseClient
              .channel(`deployment_logs_${deploymentId}`)
              .on(
                'postgres_changes',
                {
                  event: 'INSERT',
                  schema: 'auth_logic',
                  table: 'deployment_logs',
                  filter: `deployment_id=eq.${deploymentId}`
                },
                (payload) => {
                  const event: StreamingLogEvent = {
                    type: 'log',
                    data: payload.new as any
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
                }
              )
              .subscribe()

            // Keep connection alive with heartbeat
            const heartbeat = setInterval(() => {
              controller.enqueue(encoder.encode(`: heartbeat\n\n`))
            }, 30000)

            // Cleanup on close
            const cleanup = () => {
              clearInterval(heartbeat)
              subscription.unsubscribe()
              controller.close()
            }

            // Handle client disconnect
            request.signal.addEventListener('abort', cleanup)
            
            // Auto-cleanup after 1 hour
            setTimeout(cleanup, 60 * 60 * 1000)
            
          } catch (error) {
            console.error('Error in log streaming:', error)
            controller.error(error)
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        }
      })
    }

    // Regular paginated logs response
    const logs = await deploymentService.getDeploymentLogs(deploymentId, limit)

    const response: GetDeploymentLogsResponse = {
      success: true,
      data: {
        data: logs,
        pagination: {
          page: 1,
          limit: logs.length,
          total: logs.length,
          totalPages: 1
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0'
      }
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to get deployment logs:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to get deployment logs' 
        } 
      }, 
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: { 
          code: 'UNAUTHORIZED', 
          message: 'Authentication required' 
        } 
      }, { status: 401 })
    }

    const deploymentId = params.id
    const body: AddDeploymentLogRequest = await request.json()

    // Validate required fields
    if (!body.log_level || !body.message) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Missing required fields: log_level and message are required' 
          } 
        }, 
        { status: 400 }
      )
    }

    // Verify deployment exists and belongs to user
    const deployment = await deploymentService.getDeployment(deploymentId)
    
    if (!deployment || deployment.user_id !== user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: 'Deployment not found' 
          } 
        }, 
        { status: 404 }
      )
    }

    // Add log entry
    const log = await deploymentService.addDeploymentLog(deploymentId, {
      log_level: body.log_level,
      message: body.message,
      metadata: body.metadata
    })

    const response: AddDeploymentLogResponse = {
      success: true,
      data: {
        log
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0'
      }
    }
    
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Failed to add deployment log:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to add deployment log' 
        } 
      }, 
      { status: 500 }
    )
  }
}
