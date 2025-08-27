'use client'

import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { ServerTemplate } from '@/lib/deployment/server-template-service'
import { useImpersonation } from '@/contexts/ImpersonationContext'

interface UseServerTemplatesOptions {
  category?: string
  featured?: boolean
  searchTerm?: string
  limit?: number
  enabled?: boolean
}

interface UseServerTemplatesResult {
  templates: ServerTemplate[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useServerTemplates(options: UseServerTemplatesOptions = {}): UseServerTemplatesResult {
  const { impersonatedUserId } = useImpersonation()
  
  const queryKey = [
    'server-templates', 
    {
      category: options.category,
      featured: options.featured,
      searchTerm: options.searchTerm,
      limit: options.limit,
      userId: impersonatedUserId
    }
  ]

  const {
    data: templates = [],
    isLoading,
    error,
    refetch
  }: UseQueryResult<ServerTemplate[], Error> = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      
      if (options.category) params.append('category', options.category)
      if (options.featured !== undefined) params.append('featured', options.featured.toString())
      if (options.searchTerm) params.append('search', options.searchTerm)
      if (options.limit) params.append('limit', options.limit.toString())
      if (impersonatedUserId) params.append('userId', impersonatedUserId)

      const response = await fetch(`/api/server-templates?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch server templates: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Extract templates from the API response structure
      if (result.success && result.data && result.data.templates) {
        return result.data.templates
      }
      
      // Fallback for legacy response format
      return Array.isArray(result) ? result : []
    },
    enabled: options.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  return {
    templates,
    isLoading,
    error,
    refetch
  }
}

export function useServerTemplate(templateId: string): UseServerTemplatesResult & { template: ServerTemplate | null } {
  const { impersonatedUserId } = useImpersonation()
  
  const queryKey = ['server-template', templateId, { userId: impersonatedUserId }]

  const {
    data: template = null,
    isLoading,
    error,
    refetch
  }: UseQueryResult<ServerTemplate | null, Error> = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (impersonatedUserId) params.append('userId', impersonatedUserId)

      const response = await fetch(`/api/server-templates/${templateId}?${params.toString()}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Failed to fetch server template: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Extract template from the API response structure if wrapped
      if (result.success && result.data && result.data.template) {
        return result.data.template
      }
      
      // Handle direct template response or legacy format
      return result || null
    },
    enabled: !!templateId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  return {
    template,
    templates: template ? [template] : [],
    isLoading,
    error,
    refetch
  }
}

export function useFeaturedTemplates(): UseServerTemplatesResult {
  return useServerTemplates({ featured: true })
}

export function useTemplateCategories(): {
  categories: string[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
} {
  const { impersonatedUserId } = useImpersonation()
  
  const queryKey = ['server-template-categories', { userId: impersonatedUserId }]

  const {
    data: categories = [],
    isLoading,
    error,
    refetch
  }: UseQueryResult<string[], Error> = useQuery({
    queryKey,
    queryFn: async () => {
      console.log('🔍 useTemplateCategories queryFn called')
      const params = new URLSearchParams()
      if (impersonatedUserId) params.append('userId', impersonatedUserId)

      const response = await fetch(`/api/server-templates/categories?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch template categories: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('🔍 useTemplateCategories result:', result)
      
      // Extract categories from the API response structure
      if (result.success && result.data && result.data.categories) {
        console.log('🔍 useTemplateCategories returning:', result.data.categories)
        return result.data.categories
      }
      
      // Fallback for legacy response format
      console.log('🔍 useTemplateCategories fallback:', Array.isArray(result) ? result : [])
      return Array.isArray(result) ? result : []
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
  })

  console.log('🔍 useTemplateCategories hook result:', { categories, isLoading, error })

  return {
    categories,
    isLoading,
    error,
    refetch
  }
}

export function useTemplatesByCategory(category: string): UseServerTemplatesResult {
  return useServerTemplates({ category, enabled: !!category })
}
