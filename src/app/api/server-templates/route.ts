import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ServerTemplateService } from '@/lib/deployment/server-template-service'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  console.info(`[${requestId}] List server templates request started`, { 
    endpoint: '/api/server-templates',
    method: 'GET',
    timestamp: new Date().toISOString()
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.warn(`[${requestId}] Unauthorized access attempt`, { 
        endpoint: '/api/server-templates',
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const search = searchParams.get('search') || undefined
    const featured = searchParams.get('featured') === 'true' ? true : undefined

    const templateService = new ServerTemplateService()
    
    let templates
    if (category) {
      templates = await templateService.getTemplatesByCategory(category, effectiveUserId)
    } else if (featured) {
      templates = await templateService.getFeaturedTemplates(effectiveUserId)
    } else {
      templates = await templateService.listTemplates(effectiveUserId)
    }

    // Apply search filter if provided
    if (search && templates) {
      const searchLower = search.toLowerCase()
      templates = templates.filter(template => 
        template.display_name.toLowerCase().includes(searchLower) ||
        template.description?.toLowerCase().includes(searchLower) ||
        template.name.toLowerCase().includes(searchLower)
      )
    }

    // Templates are already filtered by user access in the service methods
    const accessibleTemplates = templates || []

    console.info(`[${requestId}] Server templates retrieved successfully`, { 
      userId: effectiveUserId,
      templateCount: accessibleTemplates.length,
      category,
      search,
      featured,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      data: {
        templates: accessibleTemplates,
        total: accessibleTemplates.length
      }
    })

  } catch (error) {
    console.error(`[${requestId}] Failed to retrieve server templates`, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    })

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve server templates'
      }
    }, { status: 500 })
  }
}
