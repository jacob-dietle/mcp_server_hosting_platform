import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TrialInfo, TrialApplication } from '@/contracts/component-contracts';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Trial status request started', { requestId })

    // Initialize Supabase client and get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('Unauthenticated trial status request', { requestId })
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
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
      logger.info('Impersonation detected for trial status', { 
        requestId,
        adminUserId: user.id,
        impersonatedUserId
      })
    }

    logger.debug('User authenticated for trial status', { 
      requestId,
      userId: user.id, 
      effectiveUserId,
      isImpersonating 
    })

    // Query real trial data from database
    
    // Check for trial application
    const { data: application, error: appError } = await supabase
      .schema('auth_logic')
      .from('trial_applications')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('applied_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (appError) {
      logger.error('Error fetching trial application', { requestId, effectiveUserId, error: appError })
      throw new Error('Failed to fetch trial application')
    }

    // Check for active deployment trial
    const { data: deploymentTrial, error: trialError } = await supabase
      .schema('auth_logic')
      .from('deployment_trials')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('trial_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (trialError) {
      logger.error('Error fetching deployment trial', { requestId, effectiveUserId, error: trialError })
      throw new Error('Failed to fetch deployment trial')
    }

    // Construct trial info if deployment trial exists
    let trial: TrialInfo | null = null
    if (deploymentTrial) {
      const now = new Date()
      const trialEnd = new Date(deploymentTrial.trial_end)
      const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      
      trial = {
        id: deploymentTrial.id,
        user_id: effectiveUserId,
        status: deploymentTrial.converted ? 'converted' : daysRemaining > 0 ? 'active' : 'expired',
        start_date: deploymentTrial.trial_start,
        end_date: deploymentTrial.trial_end,
        days_remaining: daysRemaining,
        benefits: [
          'Full access to EmailBison MCP Server',
          'Unlimited deployments during trial',
          'Priority support and onboarding',
          'Advanced analytics and monitoring',
          'Custom configuration assistance'
        ],
        conversion_url: '/upgrade',
        support_contact: 'trial-support@mcpgtm.com',
        created_at: deploymentTrial.trial_start,
        updated_at: new Date().toISOString()
      }
    }

    const duration = Date.now() - startTime
    logger.info('Trial status request completed', {
      requestId,
      effectiveUserId,
      isImpersonating,
      duration
    })

    return NextResponse.json({
      success: true,
      trial: trial,
      application: application,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Trial status request failed', {
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch trial status'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 });
  }
}

// Update trial status (for admin use)
export async function PATCH(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  try {
    logger.info('Trial status update request started', { requestId })
    
    // Initialize Supabase client and get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('Unauthenticated trial update request', { requestId })
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }, { status: 401 })
    }

    const body = await request.json();
    const { user_id, status, days_to_extend } = body;

    // Check for impersonation headers
    const impersonationSession = request.headers.get('X-Impersonation-Session')
    const impersonatedUserId = request.headers.get('X-Impersonated-User-Id')
    
    let effectiveUserId = user_id || user.id
    let isImpersonating = false
    
    if (impersonationSession && impersonatedUserId) {
      effectiveUserId = impersonatedUserId
      isImpersonating = true
      logger.info('Impersonation detected for trial update', { 
        requestId,
        adminUserId: user.id,
        impersonatedUserId,
        requestedUserId: user_id
      })
    }

    // Mock trial update logic
    const updatedTrial: TrialInfo = {
      id: `trial-${effectiveUserId.slice(-8)}`,
      user_id: effectiveUserId,
      status: status || 'active',
      start_date: '2024-06-20T00:00:00Z',
      end_date: days_to_extend 
        ? new Date(Date.now() + (days_to_extend * 24 * 60 * 60 * 1000)).toISOString()
        : '2024-07-04T23:59:59Z',
      days_remaining: days_to_extend || 10,
      benefits: [
        'Full access to EmailBison MCP Server',
        'Unlimited deployments during trial',
        'Priority support and onboarding',
        'Advanced analytics and monitoring',
        'Custom configuration assistance'
      ],
      conversion_url: '/upgrade',
      support_contact: 'trial-support@mcpgtm.com',
      created_at: '2024-06-20T00:00:00Z',
      updated_at: new Date().toISOString()
    };

    const duration = Date.now() - startTime
    logger.info('Trial status updated successfully', {
      requestId,
      effectiveUserId,
      isImpersonating,
      status,
      days_to_extend,
      duration
    })

    return NextResponse.json({
      success: true,
      data: {
        trial: updatedTrial,
        message: 'Trial status updated successfully'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Trial status update failed', {
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update trial status'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0.0'
      }
    }, { status: 500 });
  }
}
