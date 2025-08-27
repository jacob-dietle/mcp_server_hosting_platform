import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  // SECURITY: Disable test routes in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test routes are disabled in production' },
      { status: 404 }
    )
  }

  const results = {
    timestamp: new Date().toISOString(),
    env: {
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      serviceKeyPreview: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
        `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'NOT SET',
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      nodeEnv: process.env.NODE_ENV,
    },
    cookies: {
      available: false,
      sessionCookie: null as any,
      error: null as any,
    },
    tests: {
      regularClient: null as any,
      serviceClient: null as any,
      directServiceClient: null as any,
      rlsPolicyTest: null as any,
    }
  }

  // Check cookies
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    results.cookies.available = true
    results.cookies.sessionCookie = allCookies.find(c => c.name.includes('auth-token'))?.name || 'Not found'
  } catch (e) {
    results.cookies = { 
      error: e instanceof Error ? e.message : 'Unknown error', 
      available: false, 
      sessionCookie: null 
    }
  }

  // Test 1: Regular client auth
  try {
    console.log('[test-auth] Testing regular client...')
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    results.tests.regularClient = {
      userFound: !!user,
      userId: user?.id,
      authError: error?.message,
    }

    // Try to query with regular client
    if (user) {
      console.log('[test-auth] User found, testing query...')
      const { data, error: queryError } = await supabase
        .from('deployments')
        .select('id')
        .limit(1)
      
      results.tests.regularClient.querySuccess = !queryError
      results.tests.regularClient.queryError = queryError?.message
      results.tests.regularClient.rowCount = data?.length || 0
      
      // Test auth.uid() RPC
      const { data: uidData, error: uidError } = await supabase
        .rpc('auth.uid')
      
      results.tests.regularClient.authUidRpc = {
        value: uidData,
        error: uidError?.message
      }
    }
  } catch (e) {
    results.tests.regularClient = { error: e instanceof Error ? e.message : 'Unknown error' }
  }

  // Test 2: Service client using imported function (This won't work as createClient doesn't use service key)
  results.tests.serviceClient = { 
    skipped: true, 
    reason: 'createClient from server.ts uses cookies, not service role' 
  }

  // Test 3: Direct service client creation
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      console.log('[test-auth] Testing direct service client...')
      const directServiceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          db: { schema: 'auth_logic' },
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          }
        }
      )
      
      // Query with service role - should bypass RLS
      const { data, error } = await directServiceClient
        .from('deployments')
        .select('id, user_id, deployment_name')
        .limit(5)
      
      results.tests.directServiceClient = {
        querySuccess: !error,
        queryError: error?.message,
        rowCount: data?.length || 0,
        sample: data?.slice(0, 2), // Show first 2 rows
      }

      // Test if we can query without user_id filter (RLS bypass test)
      const { data: allData, error: allError } = await directServiceClient
        .from('deployments')
        .select('count')
        .single()
      
      results.tests.directServiceClient.totalCount = {
        success: !allError,
        count: allData?.count || 0,
        error: allError?.message
      }

      // Test 3a: Try querying public schema to verify service role key works
      const publicSchemaClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          db: { schema: 'public' },  // Use public schema instead
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          }
        }
      )
      
      // Try to list tables in public schema
      const { data: tables, error: tablesError } = await publicSchemaClient
        .from('information_schema.tables')
        .select('table_schema, table_name')
        .eq('table_schema', 'public')
        .limit(5)
      
      results.tests.directServiceClient.publicSchemaTest = {
        success: !tablesError,
        error: tablesError?.message,
        tableCount: tables?.length || 0,
        tables: tables?.map(t => t.table_name)
      }

      // Test if auth_logic schema exists
      const { data: schemas, error: schemasError } = await publicSchemaClient
        .from('information_schema.schemata')
        .select('schema_name')
        .in('schema_name', ['auth_logic', 'public', 'auth'])
      
      results.tests.directServiceClient.schemaTest = {
        success: !schemasError,
        error: schemasError?.message,
        schemas: schemas?.map(s => s.schema_name)
      }

      // Test 3b: Check if deployments table exists in public schema
      const { data: deploymentTable, error: deploymentTableError } = await publicSchemaClient
        .from('information_schema.tables')
        .select('table_schema, table_name')
        .eq('table_name', 'deployments')
      
      results.tests.directServiceClient.deploymentTableLocation = {
        success: !deploymentTableError,
        error: deploymentTableError?.message,
        locations: deploymentTable?.map(t => t.table_schema)
      }

      // If deployments exists in public, try querying it
      if (deploymentTable?.some(t => t.table_schema === 'public')) {
        const { data: publicDeployments, error: publicDeploymentsError } = await publicSchemaClient
          .from('deployments')
          .select('id')
          .limit(1)
        
        results.tests.directServiceClient.publicDeploymentsQuery = {
          success: !publicDeploymentsError,
          error: publicDeploymentsError?.message,
          found: publicDeployments?.length || 0
        }
      }
    } catch (e) {
      results.tests.directServiceClient = { error: e instanceof Error ? e.message : 'Unknown error' }
    }
  } else {
    results.tests.directServiceClient = { error: 'Missing required env vars' }
  }

  // Test 4: RLS Policy inspection
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          db: { schema: 'auth_logic' },
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          }
        }
      )
      
      // Query RLS policies
      const { data: policies, error: policiesError } = await serviceClient
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'deployments')
      
      results.tests.rlsPolicyTest = {
        success: !policiesError,
        error: policiesError?.message,
        policiesFound: policies?.length || 0,
        policies: policies?.map(p => ({
          policyname: p.policyname,
          cmd: p.cmd,
          qual: p.qual?.substring(0, 100) + '...'
        }))
      }
    } catch (e) {
      results.tests.rlsPolicyTest = { error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }

  return NextResponse.json(results, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  })
}
