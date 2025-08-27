'use client'

import React, { useState, useMemo } from 'react'
import { Search, Star, Filter, Grid, List, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useServerTemplates, useTemplateCategories } from '@/hooks/server-templates/use-server-templates'
import { ServerTemplate } from '@/lib/deployment/server-template-service'

interface ServerTemplateSelectorProps {
  selectedTemplateId?: string
  onTemplateSelect: (template: ServerTemplate) => void
  className?: string
}

type ViewMode = 'grid' | 'list'

export function ServerTemplateSelector({
  selectedTemplateId,
  onTemplateSelect,
  className = ''
}: ServerTemplateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false)

  // Fetch data
  const { categories, isLoading: categoriesLoading } = useTemplateCategories()
  const { 
    templates, 
    isLoading: templatesLoading, 
    error: templatesError 
  } = useServerTemplates({
    searchTerm: searchTerm || undefined,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    featured: showFeaturedOnly || undefined
  })

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let filtered = Array.isArray(templates) ? templates : []

    // Additional client-side filtering if needed
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(template => 
        template.display_name.toLowerCase().includes(term) ||
        template.description?.toLowerCase().includes(term) ||
        (Array.isArray(template.tags) && template.tags.some(tag => tag.toLowerCase().includes(term)))
      )
    }

    // Sort: featured first, then alphabetically
    return filtered.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1
      if (!a.is_featured && b.is_featured) return 1
      return a.display_name.localeCompare(b.display_name)
    })
  }, [templates, searchTerm])

  const isLoading = templatesLoading || categoriesLoading

  if (templatesError) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertDescription>
          Failed to load server templates: {templatesError.message}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Choose Server Template</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Array.isArray(categories) && categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showFeaturedOnly ? 'default' : 'outline'}
            onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
            className="flex items-center space-x-2"
          >
            <Star className={`h-4 w-4 ${showFeaturedOnly ? 'fill-current' : ''}`} />
            <span>Featured</span>
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Templates Grid/List */}
      {!isLoading && (
        <>
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-2">No templates found</div>
              <div className="text-sm text-gray-400">
                Try adjusting your search or filter criteria
              </div>
            </div>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-4'
            }>
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplateId === template.id}
                  onSelect={() => onTemplateSelect(template)}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface TemplateCardProps {
  template: ServerTemplate
  isSelected: boolean
  onSelect: () => void
  viewMode: ViewMode
}

function TemplateCard({ template, isSelected, onSelect, viewMode }: TemplateCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
      } ${viewMode === 'list' ? 'flex' : ''}`}
      onClick={onSelect}
    >
      <div className={viewMode === 'list' ? 'flex-1' : ''}>
        <CardHeader className={viewMode === 'list' ? 'pb-2' : ''}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              {template.icon_url && (
                <img 
                  src={template.icon_url} 
                  alt={template.display_name}
                  className="h-6 w-6 rounded"
                />
              )}
              <CardTitle className="text-lg">{template.display_name}</CardTitle>
              {template.is_featured && (
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
              )}
            </div>
            <Badge variant="secondary" className="text-xs">
              {template.category}
            </Badge>
          </div>
          {template.description && (
            <CardDescription className="line-clamp-2">
              {template.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className={viewMode === 'list' ? 'pt-0' : ''}>
          <div className="space-y-3">
            {/* Tags */}
            {Array.isArray(template.tags) && template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{template.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Technical Details */}
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Port: {template.port}</span>
              <span>Memory: {template.min_memory_mb}MB</span>
            </div>

            {/* Links */}
            <div className="flex items-center space-x-4 text-sm">
              {template.documentation_url && (
                <a
                  href={template.documentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Docs</span>
                </a>
              )}
              <a
                href={`https://github.com/${template.github_repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-800"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

