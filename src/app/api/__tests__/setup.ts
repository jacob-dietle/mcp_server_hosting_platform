import { jest } from '@jest/globals'

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.RAILWAY_API_KEY = 'test-railway-key'
process.env.RAILWAY_WEBHOOK_SECRET = 'test-webhook-secret'

// Type for mocked functions
type MockedFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T>

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn() as MockedFunction<any>,
    signInWithPassword: jest.fn() as MockedFunction<any>,
    signOut: jest.fn() as MockedFunction<any>,
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
    then: jest.fn(),
  })),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
  })),
}

// Mock Supabase modules
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

// Mock Railway client with proper typing
const mockRailwayClient = {
  getProjects: jest.fn() as MockedFunction<any>,
  createProject: jest.fn() as MockedFunction<any>,
  getProject: jest.fn() as MockedFunction<any>,
  getServices: jest.fn() as MockedFunction<any>,
  createService: jest.fn() as MockedFunction<any>,
  deployService: jest.fn() as MockedFunction<any>,
}

jest.mock('@/lib/railway-client', () => ({
  RailwayClient: jest.fn(() => mockRailwayClient),
  createRailwayClient: jest.fn(() => mockRailwayClient),
}))

// Mock deployment service with proper typing
const mockDeploymentService = {
  createDeployment: jest.fn() as MockedFunction<any>,
  getDeployments: jest.fn() as MockedFunction<any>,
  getDeployment: jest.fn() as MockedFunction<any>,
  updateDeployment: jest.fn() as MockedFunction<any>,
  deleteDeployment: jest.fn() as MockedFunction<any>,
  addDeploymentLog: jest.fn() as MockedFunction<any>,
  getDeploymentLogs: jest.fn() as MockedFunction<any>,
  recordHealthCheck: jest.fn() as MockedFunction<any>,
  getLatestHealthCheck: jest.fn() as MockedFunction<any>,
  getLatestHealthChecks: jest.fn() as MockedFunction<any>,
  restartDeployment: jest.fn() as MockedFunction<any>,
}

jest.mock('@/lib/deployment-service', () => ({
  DeploymentService: jest.fn(() => mockDeploymentService),
  createDeploymentService: jest.fn(() => mockDeploymentService),
}))

// Export mocks for use in tests
export {
  mockSupabaseClient,
  mockRailwayClient,
  mockDeploymentService,
}

