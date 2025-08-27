// Generated from Supabase auth_logic schema
// This file provides complete type safety for database operations

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enum Types
export type DeploymentStatus = 
  | 'pending'
  | 'validating' 
  | 'deploying'
  | 'building'
  | 'running'
  | 'failed'
  | 'cancelled'
  | 'stopped'

export type HealthStatus = 
  | 'unknown'
  | 'healthy'
  | 'unhealthy'
  | 'degraded'

export type RailwayEnvironment = 
  | 'production'
  | 'staging'
  | 'development'

// Database Schema Types
export interface Database {
  auth_logic: {
    Tables: {
      deployments: {
        Row: {
          id: string
          user_id: string
          railway_project_id: string
          deployment_name: string
          status: DeploymentStatus | null
          emailbison_config: Json
          server_config: Json | null
          server_template_id: string | null
          base_url: string | null
          railway_service_id: string | null
          railway_deployment_id: string | null
          connection_string: string | null
          service_url: string | null
          health_check_url: string | null
          build_logs: string | null
          error_message: string | null
          last_health_check: string | null
          health_status: HealthStatus | null
          deployed_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          railway_project_id: string
          deployment_name: string
          status?: DeploymentStatus | null
          emailbison_config: Json
          server_config?: Json | null
          server_template_id?: string | null
          base_url?: string | null
          railway_service_id?: string | null
          railway_deployment_id?: string | null
          connection_string?: string | null
          service_url?: string | null
          health_check_url?: string | null
          build_logs?: string | null
          error_message?: string | null
          last_health_check?: string | null
          health_status?: HealthStatus | null
          deployed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          railway_project_id?: string
          deployment_name?: string
          status?: DeploymentStatus | null
          emailbison_config?: Json
          server_config?: Json | null
          server_template_id?: string | null
          base_url?: string | null
          railway_service_id?: string | null
          railway_deployment_id?: string | null
          connection_string?: string | null
          service_url?: string | null
          health_check_url?: string | null
          build_logs?: string | null
          error_message?: string | null
          last_health_check?: string | null
          health_status?: HealthStatus | null
          deployed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      server_templates: {
        Row: {
          id: string
          name: string
          display_name: string
          description: string | null
          category: string
          github_repo: string
          github_branch: string
          required_env_vars: Json
          optional_env_vars: Json
          port: number
          healthcheck_path: string
          build_command: string | null
          start_command: string | null
          min_memory_mb: number
          min_cpu_cores: number
          default_transport_type: string
          icon_url: string | null
          documentation_url: string | null
          example_config: Json | null
          tags: string[]
          is_active: boolean
          is_featured: boolean
          requires_approval: boolean
          allowed_user_ids: string[]
          created_at: string | null
          updated_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          description?: string | null
          category: string
          github_repo: string
          github_branch: string
          required_env_vars: Json
          optional_env_vars: Json
          port: number
          healthcheck_path: string
          build_command?: string | null
          start_command?: string | null
          min_memory_mb: number
          min_cpu_cores: number
          default_transport_type?: string
          icon_url?: string | null
          documentation_url?: string | null
          example_config?: Json | null
          tags: string[]
          is_active?: boolean
          is_featured?: boolean
          requires_approval?: boolean
          allowed_user_ids?: string[]
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          description?: string | null
          category?: string
          github_repo?: string
          github_branch?: string
          required_env_vars?: Json
          optional_env_vars?: Json
          port?: number
          healthcheck_path?: string
          build_command?: string | null
          start_command?: string | null
          min_memory_mb?: number
          min_cpu_cores?: number
          default_transport_type?: string
          icon_url?: string | null
          documentation_url?: string | null
          example_config?: Json | null
          tags?: string[]
          is_active?: boolean
          is_featured?: boolean
          requires_approval?: boolean
          allowed_user_ids?: string[]
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
        }
      }
      deployment_logs: {
        Row: {
          id: string
          deployment_id: string
          log_level: string
          message: string
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          deployment_id: string
          log_level: string
          message: string
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          deployment_id?: string
          log_level?: string
          message?: string
          metadata?: Json | null
          created_at?: string | null
        }
      }
      health_checks: {
        Row: {
          id: string
          deployment_id: string
          status: HealthStatus
          response_time_ms: number | null
          status_code: number | null
          error_message: string | null
          checked_at: string | null
          tools_discovered: number | null
          transport_type: string | null
          mcp_server_capabilities: Json | null
        }
        Insert: {
          id?: string
          deployment_id: string
          status: HealthStatus
          response_time_ms?: number | null
          status_code?: number | null
          error_message?: string | null
          checked_at?: string | null
          tools_discovered?: number | null
          transport_type?: string | null
          mcp_server_capabilities?: Json | null
        }
        Update: {
          id?: string
          deployment_id?: string
          status?: HealthStatus
          response_time_ms?: number | null
          status_code?: number | null
          error_message?: string | null
          checked_at?: string | null
          tools_discovered?: number | null
          transport_type?: string | null
          mcp_server_capabilities?: Json | null
        }
      }
      api_usage: {
        Row: {
          id: string
          user_id: string
          deployment_id: string | null
          endpoint: string
          method: string
          status_code: number | null
          response_time_ms: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          deployment_id?: string | null
          endpoint: string
          method: string
          status_code?: number | null
          response_time_ms?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          deployment_id?: string | null
          endpoint?: string
          method?: string
          status_code?: number | null
          response_time_ms?: number | null
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      deployment_status: DeploymentStatus
      health_status: HealthStatus
      railway_environment: RailwayEnvironment
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases
export type Deployment = Database['auth_logic']['Tables']['deployments']['Row']
export type DeploymentInsert = Database['auth_logic']['Tables']['deployments']['Insert']
export type DeploymentUpdate = Database['auth_logic']['Tables']['deployments']['Update']

export type DeploymentLog = Database['auth_logic']['Tables']['deployment_logs']['Row']
export type DeploymentLogInsert = Database['auth_logic']['Tables']['deployment_logs']['Insert']

export type HealthCheck = Database['auth_logic']['Tables']['health_checks']['Row']
export type HealthCheckInsert = Database['auth_logic']['Tables']['health_checks']['Insert']

export type ApiUsage = Database['auth_logic']['Tables']['api_usage']['Row']
export type ApiUsageInsert = Database['auth_logic']['Tables']['api_usage']['Insert']
