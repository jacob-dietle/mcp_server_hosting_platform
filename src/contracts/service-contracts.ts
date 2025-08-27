// Service layer interface contracts
// These interfaces define the core business logic layer

import { 
  Deployment, 
  DeploymentInsert, 
  DeploymentUpdate,
  DeploymentLog,
  DeploymentLogInsert,
  HealthCheck,
  HealthCheckInsert,
  DeploymentStatus,
  HealthStatus,
  RailwayEnvironment as RailwayEnvironmentEnum
} from '../../types/database'

// ============================================================================
// RAILWAY API INTERFACES
// ============================================================================

export interface RailwayProject {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  teamId?: string
  isPublic: boolean
}

export interface RailwayService {
  id: string
  name: string
  projectId: string
  templateServiceId?: string
  createdAt: string
  updatedAt: string
  status?: string
}

export interface RailwayDeployment {
  id: string
  serviceId: string
  environmentId: string
  status: string
  url?: string
  createdAt: string
  updatedAt: string
  buildLogs?: string
  deployLogs?: string
}

export interface RailwayEnvironment {
  id: string
  name: string
  projectId: string
  isEphemeral: boolean
}

export interface DeployConfig {
  serviceName: string
  environmentVariables: Record<string, string>
  buildCommand?: string
  startCommand?: string
  healthcheckPath?: string
  port?: number
  region?: string
}

export interface IRailwayClient {
  // Project Management
  getProjects(): Promise<RailwayProject[]>
  getProject(projectId: string): Promise<RailwayProject | null>
  createProject(name: string, description?: string): Promise<RailwayProject>
  
  // Service Management
  getServices(projectId: string): Promise<RailwayService[]>
  getService(serviceId: string): Promise<RailwayService | null>
  createService(projectId: string, config: DeployConfig): Promise<RailwayService>
  
  // Deployment Management
  deployProject(projectId: string, config: DeployConfig): Promise<RailwayDeployment>
  getDeployment(deploymentId: string): Promise<RailwayDeployment | null>
  getDeploymentLogs(deploymentId: string): Promise<string>
  cancelDeployment(deploymentId: string): Promise<boolean>
  
  // Environment Management
  getEnvironments(projectId: string): Promise<RailwayEnvironment[]>
  createEnvironment(projectId: string, name: string): Promise<RailwayEnvironment>
}

// ============================================================================
// DEPLOYMENT SERVICE INTERFACES
// ============================================================================

export interface CreateDeploymentInput {
  user_id: string
  deployment_name: string
  server_template_id: string
  server_config: Record<string, any>
  railway_project_id?: string
  transport_type?: 'sse' | 'http'
  environment?: RailwayEnvironmentEnum
  advanced_config?: {
    port?: number
    region?: string
    healthcheck_path?: string
    build_command?: string
    start_command?: string
  }
  // Trial-specific fields
  is_trial?: boolean
  trial_application_id?: string
}

export interface UpdateDeploymentInput {
  status?: DeploymentStatus
  railway_project_id?: string
  railway_service_id?: string
  railway_deployment_id?: string
  connection_string?: string
  service_url?: string
  health_check_url?: string
  build_logs?: string
  error_message?: string
  health_status?: HealthStatus
  deployed_at?: string
  last_health_check?: string
}

export interface DeploymentWithLogs extends Deployment {
  logs: DeploymentLog[]
  health_checks: HealthCheck[]
}

export interface IDeploymentService {
  // CRUD Operations
  createDeployment(data: CreateDeploymentInput): Promise<Deployment>
  getDeployment(id: string): Promise<Deployment | null>
  getDeploymentWithLogs(id: string): Promise<DeploymentWithLogs | null>
  updateDeployment(id: string, data: UpdateDeploymentInput): Promise<Deployment>
  deleteDeployment(id: string): Promise<boolean>
  
  // User-specific queries
  listDeployments(userId: string): Promise<Deployment[]>
  getUserActiveDeployments(userId: string): Promise<Deployment[]>
  
  // Status management
  updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<void>
  
  // Logging
  addDeploymentLog(deploymentId: string, log: Omit<DeploymentLogInsert, 'deployment_id'>): Promise<DeploymentLog>
  getDeploymentLogs(deploymentId: string, limit?: number): Promise<DeploymentLog[]>
  
  // Health checks
  recordHealthCheck(deploymentId: string, check: Omit<HealthCheckInsert, 'deployment_id'>): Promise<HealthCheck>
  getLatestHealthCheck(deploymentId: string): Promise<HealthCheck | null>
  getLatestHealthChecks(deploymentId: string, limit?: number): Promise<HealthCheck[]>
}

// ============================================================================
// ORCHESTRATION SERVICE INTERFACES
// ============================================================================

export interface DeploymentOrchestrationResult {
  deployment: Deployment
  railwayProject?: RailwayProject
  railwayService?: RailwayService
  railwayDeployment?: RailwayDeployment
  success: boolean
  error?: string
}

export interface IDeploymentOrchestrator {
  // Main orchestration methods
  deployServer(input: CreateDeploymentInput): Promise<DeploymentOrchestrationResult>
  
  // Status monitoring
  monitorDeployment(deploymentId: string): Promise<void>
  
  // Health checking
  performHealthCheck(deploymentId: string): Promise<HealthCheck>
  
  // Cleanup
  cleanupFailedDeployment(deploymentId: string): Promise<void>
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class DeploymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'DeploymentError'
  }
}

export class RailwayApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message)
    this.name = 'RailwayApiError'
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
