// API endpoint interface contracts
// These interfaces define request/response types for Next.js API routes

import { 
  Deployment, 
  DeploymentLog, 
  HealthCheck,
  DeploymentStatus,
  HealthStatus 
} from '../../types/database'
import { 
  CreateDeploymentInput,
  UpdateDeploymentInput,
  PaginationParams,
  PaginatedResponse 
} from './service-contracts'

// ============================================================================
// COMMON API TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    requestId: string
    version: string
  }
}

export interface ApiError {
  code: string
  message: string
  statusCode: number
  details?: any
}

// ============================================================================
// DEPLOYMENT API ENDPOINTS
// ============================================================================

// POST /api/deployments
export interface CreateDeploymentRequest {
  deployment_name: string
  emailbison_config?: {
    api_key: string
    base_url: string
    [key: string]: any
  }
  // New fields for multi-server support
  server_template_id?: string
  server_config?: Record<string, any>
  transport_type?: 'sse' | 'http'
  railway_project_id?: string
  environment?: 'production' | 'staging' | 'development'
  advanced_config?: {
    port?: number
    region?: string
    healthcheck_path?: string
    build_command?: string
    start_command?: string
  }
}

export interface CreateDeploymentResponse extends ApiResponse<{
  deployment: Deployment
  railway_project_id?: string
  estimated_deploy_time?: number
}> {}

// GET /api/deployments
export interface ListDeploymentsRequest extends PaginationParams {
  status?: DeploymentStatus
  health_status?: HealthStatus
  search?: string
}

export interface ListDeploymentsResponse extends ApiResponse<PaginatedResponse<Deployment>> {}

// GET /api/deployments/[id]
export interface GetDeploymentRequest {
  include_logs?: boolean
  include_health_checks?: boolean
  logs_limit?: number
}

export interface GetDeploymentResponse extends ApiResponse<{
  deployment: Deployment
  logs?: DeploymentLog[]
  health_checks?: HealthCheck[]
}> {}

// PATCH /api/deployments/[id]
export interface UpdateDeploymentRequest extends UpdateDeploymentInput {}

export interface UpdateDeploymentResponse extends ApiResponse<{
  deployment: Deployment
}> {}

// DELETE /api/deployments/[id]
export interface DeleteDeploymentRequest {
  force?: boolean
  cleanup_railway?: boolean
}

export interface DeleteDeploymentResponse extends ApiResponse<{
  deleted: boolean
  cleanup_performed: boolean
}> {}

// POST /api/deployments/[id]/restart
export interface RestartDeploymentRequest {
  force_rebuild?: boolean
}

export interface RestartDeploymentResponse extends ApiResponse<{
  deployment: Deployment
  restart_initiated: boolean
}> {}

// ============================================================================
// DEPLOYMENT LOGS API ENDPOINTS
// ============================================================================

// GET /api/deployments/[id]/logs
export interface GetDeploymentLogsRequest extends PaginationParams {
  level?: 'debug' | 'info' | 'warn' | 'error'
  since?: string // ISO timestamp
  until?: string // ISO timestamp
  follow?: boolean // For streaming
}

export interface GetDeploymentLogsResponse extends ApiResponse<PaginatedResponse<DeploymentLog>> {}

// POST /api/deployments/[id]/logs
export interface AddDeploymentLogRequest {
  log_level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  metadata?: Record<string, any>
}

export interface AddDeploymentLogResponse extends ApiResponse<{
  log: DeploymentLog
}> {}

// ============================================================================
// HEALTH CHECK API ENDPOINTS
// ============================================================================

// GET /api/deployments/[id]/health
export interface GetHealthChecksRequest extends PaginationParams {
  since?: string // ISO timestamp
  status?: HealthStatus
}

export interface GetHealthChecksResponse extends ApiResponse<PaginatedResponse<HealthCheck>> {}

// POST /api/deployments/[id]/health
export interface PerformHealthCheckRequest {
  timeout_ms?: number
  custom_endpoint?: string
}

export interface PerformHealthCheckResponse extends ApiResponse<{
  health_check: HealthCheck
  performed_at: string
}> {}

// ============================================================================
// RAILWAY INTEGRATION API ENDPOINTS
// ============================================================================

// GET /api/railway/projects
export interface GetRailwayProjectsRequest extends PaginationParams {
  search?: string
}

export interface GetRailwayProjectsResponse extends ApiResponse<{
  projects: Array<{
    id: string
    name: string
    description?: string
    createdAt: string
    isPublic: boolean
  }>
}> {}

// POST /api/railway/projects
export interface CreateRailwayProjectRequest {
  name: string
  description?: string
  template?: string
}

export interface CreateRailwayProjectResponse extends ApiResponse<{
  project: {
    id: string
    name: string
    description?: string
    createdAt: string
  }
}> {}

// GET /api/railway/projects/[id]/services
export interface GetRailwayServicesRequest {
  project_id: string
}

export interface GetRailwayServicesResponse extends ApiResponse<{
  services: Array<{
    id: string
    name: string
    createdAt: string
    status: string
  }>
}> {}

// ============================================================================
// WEBHOOK API ENDPOINTS
// ============================================================================

// POST /api/webhooks/railway
export interface RailwayWebhookRequest {
  type: 'deployment.started' | 'deployment.completed' | 'deployment.failed'
  data: {
    deployment_id?: string
    railway_deployment_id: string
    service_url?: string
    error_message?: string
    [key: string]: any
  }
}

export interface RailwayWebhookResponse extends ApiResponse<{
  processed: boolean
  event_type: string
  deployment_updated?: boolean
}> {}

// ============================================================================
// ANALYTICS API ENDPOINTS
// ============================================================================

// GET /api/analytics/deployments
export interface GetDeploymentAnalyticsRequest {
  timeframe?: '1h' | '24h' | '7d' | '30d'
  group_by?: 'hour' | 'day' | 'week'
}

export interface GetDeploymentAnalyticsResponse extends ApiResponse<{
  total_deployments: number
  successful_deployments: number
  failed_deployments: number
  average_deploy_time: number
  timeline: Array<{
    timestamp: string
    deployments: number
    successes: number
    failures: number
  }>
}> {}

// GET /api/analytics/health
export interface GetHealthAnalyticsRequest {
  deployment_id?: string
  timeframe?: '1h' | '24h' | '7d' | '30d'
}

export interface GetHealthAnalyticsResponse extends ApiResponse<{
  uptime_percentage: number
  average_response_time: number
  total_checks: number
  failed_checks: number
  timeline: Array<{
    timestamp: string
    status: HealthStatus
    response_time_ms: number
  }>
}> {}

// ============================================================================
// WEBHOOK API ENDPOINTS
// ============================================================================

// POST /api/webhooks/railway  
// Consolidated to match data structure above

// Removed duplicate - merged with above interface

// ============================================================================
// STREAMING API TYPES
// ============================================================================

export interface StreamingLogEvent {
  type: 'log'
  data: DeploymentLog
}

export interface StreamingStatusEvent {
  type: 'status'
  data: {
    deployment_id: string
    status: DeploymentStatus
    timestamp: string
  }
}

export interface StreamingHealthEvent {
  type: 'health'
  data: HealthCheck
}

export type StreamingEvent = StreamingLogEvent | StreamingStatusEvent | StreamingHealthEvent

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export interface ApiValidationError {
  field: string
  message: string
  code: string
}

export interface RequestValidationResult {
  isValid: boolean
  errors: ApiValidationError[]
  sanitizedData?: any
}

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

export interface AuthenticatedRequest extends Request {
  user: {
    id: string
    email: string
    role: string
  }
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

export interface ApiMiddlewareContext {
  user?: {
    id: string
    email: string
    role: string
  }
  rateLimit?: RateLimitInfo
  requestId: string
  startTime: number
}

// ============================================================================
// ADMIN USER MANAGEMENT API ENDPOINTS
// ============================================================================

// GET /api/admin/users
export interface ListAdminUsersRequest extends PaginationParams {
  role?: 'user' | 'admin' | 'super_admin'
  signup_date_from?: string // ISO timestamp
  signup_date_to?: string // ISO timestamp
  activity_level?: 'active' | 'inactive' | 'new'
  search?: string // Search by email or name
  funnel_stage?: 'signup' | 'trial_applied' | 'trial_active' | 'deployed' | 'converted'
}

export interface AdminUserSummary {
  id: string
  email: string
  role: 'user' | 'admin' | 'super_admin'
  signup_date: string
  last_login: string | null
  mcp_server_count: number
  deployment_count: number
  trial_status: 'none' | 'applied' | 'active' | 'expired' | 'converted' | null
  funnel_stage: 'signup' | 'trial_applied' | 'trial_active' | 'deployed' | 'converted'
  last_activity: string | null
  is_active: boolean
}

export interface ListAdminUsersResponse extends ApiResponse<PaginatedResponse<AdminUserSummary>> {}

// GET /api/admin/users/[userId]
export interface GetAdminUserDetailRequest {
  include_mcp_servers?: boolean
  include_deployments?: boolean
  include_trial_history?: boolean
  include_activity_timeline?: boolean
}

export interface AdminUserDetail {
  id: string
  email: string
  role: 'user' | 'admin' | 'super_admin'
  signup_date: string
  last_login: string | null
  profile: {
    created_at: string
    updated_at: string | null
    email_confirmed_at: string | null
    last_sign_in_at: string | null
    raw_user_meta_data: Record<string, any>
  }
  mcp_servers?: Array<{
    id: string
    name: string
    config: {
      url: string
      transportType: 'sse' | 'streamable-http'
    }
    created_at: string
    updated_at: string
  }>
  deployments?: Array<{
    id: string
    deployment_name: string
    status: string
    health_status: string | null
    service_url: string | null
    created_at: string
    deployed_at: string | null
  }>
  trial_history?: Array<{
    id: string
    application_date: string
    status: 'pending' | 'approved' | 'active' | 'expired' | 'converted'
    trial_start_date: string | null
    trial_end_date: string | null
    conversion_date: string | null
  }>
  activity_timeline?: Array<{
    timestamp: string
    event_type: 'signup' | 'login' | 'server_created' | 'deployment_created' | 'trial_applied' | 'trial_started' | 'trial_converted'
    description: string
    metadata?: Record<string, any>
  }>
  funnel_stage: 'signup' | 'trial_applied' | 'trial_active' | 'deployed' | 'converted'
  trial_status: 'none' | 'applied' | 'active' | 'expired' | 'converted' | null
}

export interface GetAdminUserDetailResponse extends ApiResponse<{
  user: AdminUserDetail
}> {}

// GET /api/admin/mcp-servers
export interface ListAdminMCPServersRequest extends PaginationParams {
  user_id?: string
  search?: string // Search by server name
  status?: 'active' | 'inactive'
  transport_type?: 'sse' | 'streamable-http'
  created_from?: string // ISO timestamp
  created_to?: string // ISO timestamp
}

export interface AdminMCPServerSummary {
  id: string
  name: string
  user_id: string
  user_email: string
  config: {
    url: string
    transportType: 'sse' | 'streamable-http'
  }
  created_at: string
  updated_at: string
  deployment_count: number
  last_deployment_date: string | null
  health_status: 'unknown' | 'healthy' | 'unhealthy' | 'degraded' | null
  usage_stats: {
    total_requests: number
    avg_response_time: number | null
    last_used: string | null
  }
}

export interface ListAdminMCPServersResponse extends ApiResponse<PaginatedResponse<AdminMCPServerSummary>> {}

// ============================================================================
// TRIAL MANAGEMENT API ENDPOINTS
// ============================================================================

// POST /api/trials/apply
export interface TrialApplicationRequest {
  mcp_server_type: string
  qualification_answers: {
    use_case: 'email_automation' | 'customer_support' | 'content_creation' | 'data_analysis' | 'exploration'
    technical_level: 'expert' | 'intermediate' | 'beginner'
    timeline: 'immediate' | 'this_month' | 'exploring'
    company_size: 'enterprise' | 'business' | 'personal'
    company_name?: string
    role?: string
    additional_context?: string
  }
}

export interface TrialApplicationResponse extends ApiResponse<{
  application: {
    id: string
    status: 'pending' | 'approved' | 'rejected'
    auto_qualification_score: number
    applied_at: string
    estimated_review_time?: string
  }
  next_steps: {
    message: string
    action_required: boolean
    estimated_approval_time?: string
  }
}> {}

// GET /api/trials/[deploymentId]/status
export interface TrialStatusRequest {
  include_usage_stats?: boolean
}

export interface TrialStatusResponse extends ApiResponse<{
  trial: {
    id: string
    status: 'pending' | 'approved' | 'active' | 'expired' | 'converted'
    trial_start?: string
    trial_end?: string
    days_remaining?: number
    deployment_id?: string
    conversion_eligible: boolean
  }
  usage_stats?: {
    requests_made: number
    requests_limit: number
    last_activity: string | null
  }
  conversion_options?: {
          available_plans: Array<{
        id: string
        name: string
        // price: number // Removed pricing display
        features: string[]
      }>
    discount_available?: {
      percentage: number
      expires_at: string
    }
  }
}> {}

// GET /api/admin/trials
export interface ListAdminTrialsRequest extends PaginationParams {
  status?: 'pending' | 'approved' | 'rejected' | 'active' | 'expired' | 'converted'
  applied_date_from?: string
  applied_date_to?: string
  auto_qualification_score_min?: number
  auto_qualification_score_max?: number
  mcp_server_type?: string
  sort_by?: 'applied_at' | 'qualification_score' | 'review_priority'
  sort_order?: 'asc' | 'desc'
}

export interface AdminTrialSummary {
  id: string
  user: {
    id: string
    email: string
    signup_date: string
  }
  mcp_server_type: string
  qualification_answers: {
    use_case: string
    technical_level: string
    timeline: string
    company_size: string
    company_name?: string
    role?: string
    additional_context?: string
  }
  auto_qualification_score: number
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'expired' | 'converted'
  applied_at: string
  reviewed_at?: string
  reviewed_by?: string
  rejection_reason?: string
  trial_start?: string
  trial_end?: string
  conversion_value?: number
  priority_score: number
}

export interface ListAdminTrialsResponse extends ApiResponse<PaginatedResponse<AdminTrialSummary>> {}

// POST /api/admin/trials/[id]/approve
export interface ApproveTrialRequest {
  trial_duration_days?: number // Default: 7 days
  custom_message?: string
  priority_deployment?: boolean
}

export interface ApproveTrialResponse extends ApiResponse<{
  trial_application: {
    id: string
    status: 'approved'
    approved_at: string
    approved_by: string
  }
  deployment_trial: {
    id: string
    trial_start: string
    trial_end: string
    trial_duration_days: number
  }
  next_steps: {
    deployment_instructions: string
    trial_guidelines: string[]
  }
}> {}

// POST /api/admin/trials/[id]/reject
export interface RejectTrialRequest {
  rejection_reason: string
  custom_message?: string
  reapplication_allowed?: boolean
  reapplication_wait_days?: number
}

export interface RejectTrialResponse extends ApiResponse<{
  trial_application: {
    id: string
    status: 'rejected'
    rejected_at: string
    rejected_by: string
    rejection_reason: string
  }
  user_notification: {
    sent: boolean
    reapplication_date?: string
  }
}> {}

// GET /api/admin/trials/expiring
export interface ListExpiringTrialsRequest {
  days_until_expiry?: number // Default: 3 days
  include_conversion_eligible?: boolean
}

export interface ExpiringTrialSummary {
  id: string
  user: {
    id: string
    email: string
  }
  deployment: {
    id: string
    deployment_name: string
    service_url: string | null
  }
  trial_end: string
  days_remaining: number
  usage_stats: {
    requests_made: number
    last_activity: string | null
    engagement_score: number
  }
  conversion_likelihood: 'high' | 'medium' | 'low'
  recommended_actions: string[]
}

export interface ListExpiringTrialsResponse extends ApiResponse<{
  expiring_trials: ExpiringTrialSummary[]
  summary: {
    total_expiring: number
    high_conversion_potential: number
    recommended_outreach: number
  }
}> {}

// Extended admin dashboard response
export interface AdminDashboardStats {
  user_management: {
    total_users: number
    admin_users: number
    super_admin_users: number
    recent_signups: number
    pending_trial_applications: number
    active_trials: number
    trial_conversion_rate: number
    funnel_breakdown: {
      signup: number
      trial_applied: number
      trial_active: number
      deployed: number
      converted: number
    }
  }
  // ... existing dashboard stats
}

// ============================================================================
// ERROR RESPONSE TYPES
// ============================================================================

export interface ValidationErrorResponse extends ApiResponse {
  success: false
  error: {
    code: 'VALIDATION_ERROR'
    message: string
    details: ApiValidationError[]
  }
}

export interface AuthErrorResponse extends ApiResponse {
  success: false
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN'
    message: string
  }
}

export interface RateLimitErrorResponse extends ApiResponse {
  success: false
  error: {
    code: 'RATE_LIMIT_EXCEEDED'
    message: string
    details: {
      limit: number
      retryAfter: number
    }
  }
}

export interface NotFoundErrorResponse extends ApiResponse {
  success: false
  error: {
    code: 'NOT_FOUND'
    message: string
  }
}

export interface ServerErrorResponse extends ApiResponse {
  success: false
  error: {
    code: 'INTERNAL_SERVER_ERROR'
    message: string
    details?: any
  }
}
