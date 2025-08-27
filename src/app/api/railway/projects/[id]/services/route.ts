import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRailwayClient } from '@/lib/railway-client'
import { 
  GetRailwayServicesRequest,
  GetRailwayServicesResponse
} from '@/contracts/api-contracts'

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

    const projectId = params.id

    // Get Railway services for the project
    const railwayClient = createRailwayClient()
    const services = await railwayClient.getServices(projectId)

    const response: GetRailwayServicesResponse = {
      success: true,
      data: {
        services: services.map(service => ({
          id: service.id,
          name: service.name,
          createdAt: service.createdAt,
          status: service.status || 'unknown'
        }))
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0'
      }
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to get Railway services:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to get Railway services' 
        } 
      }, 
      { status: 500 }
    )
  }
}

