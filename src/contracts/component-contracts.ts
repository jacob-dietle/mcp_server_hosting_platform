// React component interface contracts
// These interfaces define props, state, and component interactions

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
  DeploymentWithLogs,
  RailwayProject 
} from './service-contracts'

// ============================================================================
// DEPLOYMENT FORM COMPONENTS
// ============================================================================

export interface DeploymentFormData {
  deployment_name: string
  railway_project_id?: string
  transport_type?: 'sse' | 'http'
  environment?: 'production' | 'staging' | 'development'
  server_template_id?: string
  server_config?: Record<string, any>
  advanced_config?: {
    port?: number
    region?: string
    healthcheck_path?: string
    build_command?: string
    start_command?: string
  }
}

export interface DeploymentFormProps {
  onSubmit: (data: DeploymentFormData) => Promise<void>
  isLoading?: boolean
  initialData?: Partial<DeploymentFormData>
  availableProjects?: RailwayProject[]
  className?: string
}

export interface DeploymentFormState {
  formData: DeploymentFormData
  errors: Record<string, string>
  isValidating: boolean
  showAdvanced: boolean
}

// ============================================================================
// DEPLOYMENT LIST COMPONENTS
// ============================================================================

export interface DeploymentListProps {
  deployments: Deployment[]
  isLoading?: boolean
  onRefresh?: () => void
  onDeploymentClick?: (deployment: Deployment) => void
  onDeleteDeployment?: (deploymentId: string) => Promise<void>
  className?: string
}

export interface DeploymentCardProps {
  deployment: Deployment
  onClick?: () => void
  onDelete?: () => Promise<void>
  showActions?: boolean
  className?: string
}

export interface DeploymentStatusBadgeProps {
  status: DeploymentStatus
  className?: string
}

export interface HealthStatusIndicatorProps {
  status: HealthStatus
  lastCheck?: string
  className?: string
}

// ============================================================================
// DEPLOYMENT DETAIL COMPONENTS
// ============================================================================

export interface DeploymentDetailProps {
  deploymentId: string
  deployment?: DeploymentWithLogs
  isLoading?: boolean
  onRefresh?: () => void
  onStatusChange?: (status: DeploymentStatus) => Promise<void>
  className?: string
}

export interface DeploymentOverviewProps {
  deployment: Deployment
  onEdit?: () => void
  onDelete?: () => Promise<void>
  onRestart?: () => Promise<void>
  className?: string
}

export interface DeploymentMetricsProps {
  deployment: Deployment
  healthChecks: HealthCheck[]
  className?: string
}

// ============================================================================
// LOG VIEWER COMPONENTS
// ============================================================================

export interface LogViewerProps {
  logs: DeploymentLog[]
  isLoading?: boolean
  isStreaming?: boolean
  onToggleStreaming?: () => void
  maxHeight?: string
  className?: string
}

export interface LogEntryProps {
  log: DeploymentLog
  showTimestamp?: boolean
  showLevel?: boolean
  className?: string
}

export interface LogFilterProps {
  currentLevel?: string
  onLevelChange: (level: string) => void
  onClear: () => void
  className?: string
}

// ============================================================================
// HEALTH CHECK COMPONENTS
// ============================================================================

export interface HealthCheckHistoryProps {
  deploymentId: string
  checks: HealthCheck[]
  isLoading?: boolean
  onRefresh?: () => void
  className?: string
}

export interface HealthCheckChartProps {
  checks: HealthCheck[]
  timeRange?: '1h' | '6h' | '24h' | '7d'
  onTimeRangeChange?: (range: string) => void
  className?: string
}

// ============================================================================
// MODAL AND DIALOG COMPONENTS
// ============================================================================

export interface CreateDeploymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: DeploymentFormData) => Promise<void>
  isLoading?: boolean
}

export interface DeleteDeploymentDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  deploymentName: string
  isLoading?: boolean
}

export interface DeploymentSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  deployment: Deployment
  onSave: (updates: Partial<Deployment>) => Promise<void>
  isLoading?: boolean
}

// ============================================================================
// DASHBOARD COMPONENTS
// ============================================================================

export interface DeploymentDashboardProps {
  userId: string
  className?: string
}

export interface DashboardStatsProps {
  totalDeployments: number
  activeDeployments: number
  failedDeployments: number
  healthyDeployments: number
  className?: string
}

export interface RecentActivityProps {
  activities: Array<{
    id: string
    type: 'deployment' | 'health_check' | 'log'
    message: string
    timestamp: string
    deploymentId: string
    deploymentName: string
  }>
  onActivityClick?: (activity: any) => void
  className?: string
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

export interface UseDeploymentsReturn {
  deployments: Deployment[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
  createDeployment: (data: CreateDeploymentInput) => Promise<Deployment>
  updateDeployment: (id: string, data: UpdateDeploymentInput) => Promise<Deployment>
  deleteDeployment: (id: string) => Promise<void>
}

export interface UseDeploymentReturn {
  deployment: DeploymentWithLogs | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
  updateStatus: (status: DeploymentStatus) => Promise<void>
  addLog: (log: Omit<DeploymentLog, 'id' | 'deployment_id' | 'created_at'>) => Promise<DeploymentLog>
}

export interface UseDeploymentLogsReturn {
  logs: DeploymentLog[]
  isLoading: boolean
  isStreaming: boolean
  error: Error | null
  startStreaming: () => void
  stopStreaming: () => void
  clearLogs: () => void
}

export interface UseHealthChecksReturn {
  checks: HealthCheck[]
  latestCheck: HealthCheck | null
  isLoading: boolean
  error: Error | null
  performCheck: () => Promise<HealthCheck>
  isPerformingCheck: boolean
  refetch: () => void
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: any) => string | null
}

export interface FormValidationSchema {
  [fieldName: string]: ValidationRule
}

export interface FormErrors {
  [fieldName: string]: string
}

// ============================================================================
// THEME AND STYLING
// ============================================================================

export interface DeploymentTheme {
  colors: {
    primary: string
    secondary: string
    success: string
    warning: string
    error: string
    info: string
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }
  borderRadius: {
    sm: string
    md: string
    lg: string
  }
}

export interface ComponentVariants {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
}

// ============================================================================
// TRIAL MANAGEMENT COMPONENTS
// ============================================================================

export type TrialStatus = 'none' | 'pending' | 'active' | 'expired' | 'converted'

export type TrialUseCase = 'email_automation' | 'customer_support' | 'content_creation' | 'data_analysis' | 'exploration'

export type TechnicalLevel = 'expert' | 'intermediate' | 'beginner'

export type ImplementationTimeline = 'immediate' | 'this_month' | 'exploring'

export type CompanyContext = 'enterprise' | 'business' | 'personal'

export interface TrialApplication {
  id?: string
  user_id: string
  primary_use_case?: TrialUseCase
  technical_level?: TechnicalLevel
  implementation_timeline?: ImplementationTimeline
  company_context?: CompanyContext
  company_name?: string
  role?: string
  status: 'pending' | 'approved' | 'rejected'
  applied_at?: string
  created_at?: string
  updated_at?: string
}

export interface TrialInfo {
  id: string
  user_id: string
  status: TrialStatus
  start_date: string
  end_date: string
  days_remaining: number
  benefits: string[]
  conversion_url?: string
  support_contact?: string
  created_at: string
  updated_at: string
}

export interface TrialQualificationData {
  primary_use_case: TrialUseCase
  technical_level: TechnicalLevel
  implementation_timeline: ImplementationTimeline
  company_context: CompanyContext
  company_name?: string
  role?: string
}

// ============================================================================
// TRIAL COMPONENT PROPS
// ============================================================================

export interface TrialQualificationFormProps {
  onSubmit: (data: TrialQualificationData | Record<string, any>) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  className?: string
}

export interface TrialQualificationFormState {
  formData: TrialQualificationData | Record<string, any>
  errors: Record<string, string>
  isValidating: boolean
  isSubmitting: boolean
}

export interface TrialCountdownBannerProps {
  trial: TrialInfo
  onDismiss?: () => void
  onUpgrade?: () => void
  onExtend?: () => void
  className?: string
}

export interface TrialCountdownBannerState {
  isDismissed: boolean
  timeRemaining: {
    days: number
    hours: number
    minutes: number
  }
}

export interface EnhancedDeploymentSuccessProps {
  deploymentName: string
  serviceUrl: string
  transportType: 'sse' | 'http'
  onContinue: () => void
  trial?: TrialInfo
  className?: string
}

export interface TrialOnboardingSection {
  title: string
  description: string
  videoUrl?: string
  quickStartSteps: string[]
  supportContact?: string
}

// ============================================================================
// TRIAL HOOK RETURN TYPES
// ============================================================================

export interface UseTrialStatusReturn {
  trial: TrialInfo | null
  application: TrialApplication | null
  isLoading: boolean
  error: Error | null
  hasActiveTrial: boolean
  needsQualification: boolean
  isTrialExpiring: boolean
  daysUntilExpiration: number
  submitApplication: (data: TrialQualificationData | Record<string, any>) => Promise<TrialApplication>
  refreshTrialStatus: () => void
}

export interface UseTrialCountdownReturn {
  timeRemaining: {
    days: number
    hours: number
    minutes: number
    seconds: number
  }
  isExpired: boolean
  isExpiring: boolean
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
  formatTimeRemaining: () => string
}
