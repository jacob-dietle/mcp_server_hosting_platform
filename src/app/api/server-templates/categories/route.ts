import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ServerTemplateService } from '@/lib/deployment/server-template-service'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  console.info(`[${requestId}] Get server template categories request started`, { 
    endpoint: '/api/server-templates/categories',
    method: 'GET',
    timestamp: new Date().toISOString()
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.warn(`[${requestId}] Unauthorized access attempt`, { 
        endpoint: '/api/server-templates/categories',
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
    
    // Get all templates that the user can access
    const accessibleTemplates = await templateService.listTemplates(effectiveUserId)

    // Extract unique categories from accessible templates
    const categories = [...new Set(
      accessibleTemplates
        .map(template => template.category)
        .filter(category => category && category.trim() !== '')
    )].sort()

    console.info(`[${requestId}] Server template categories retrieved successfully`, { 
      userId: effectiveUserId,
      categoryCount: categories.length,
      categories,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: {
        categories
      }
    })

  } catch (error) {
    console.error(`[${requestId}] Failed to retrieve server template categories`, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve server template categories'
      }
    }, { status: 500 })
  }
}
