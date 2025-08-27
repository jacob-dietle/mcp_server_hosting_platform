import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ServerTemplateService } from '@/lib/deployment/server-template-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const templateId = params.id
  
  console.info(`[${requestId}] Get server template request started`, { 
    endpoint: `/api/server-templates/${templateId}`,
    method: 'GET',
    templateId,
    timestamp: new Date().toISOString()
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.warn(`[${requestId}] Unauthorized access attempt`, { 
        endpoint: `/api/server-templates/${templateId}`,
        duration: Date.now() - startTime
      })
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
    
    if (impersonationSession && impersonatedUserId) {
      // TODO: Validate impersonation session using adminImpersonationService
      // For now, we'll trust the headers if they exist (admin validation should be done)
      effectiveUserId = impersonatedUserId
      console.info(`[${requestId}] Using impersonated user`, { 
        originalUserId: user.id,
        impersonatedUserId: effectiveUserId
      })
    }

    const templateService = new ServerTemplateService()
    
    // Check if user can access this template
    const canAccess = await templateService.canUserAccessTemplate(effectiveUserId, templateId)
    if (!canAccess) {
      console.warn(`[${requestId}] Access denied to server template`, { 
        userId: effectiveUserId,
        templateId,
        duration: Date.now() - startTime
      })
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this server template'
        }
      }, { status: 403 })
    }

    // Get the template
    const template = await templateService.getTemplate(templateId)
    
    if (!template) {
      console.warn(`[${requestId}] Server template not found`, { 
        templateId,
        duration: Date.now() - startTime
      })
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Server template not found'
        }
      }, { status: 404 })
    }

    console.info(`[${requestId}] Server template retrieved successfully`, { 
      userId: effectiveUserId,
      templateId,
      templateName: template.name,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: {
        template
      }
    })

  } catch (error) {
    console.error(`[${requestId}] Failed to retrieve server template`, { 
      templateId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve server template'
      }
    }, { status: 500 })
  }
}
