'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Info, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ServerTemplate, EnvVarSchema } from '@/lib/deployment/server-template-service'

interface DynamicConfigFormProps {
  template: ServerTemplate
  initialConfig?: Record<string, any>
  onConfigChange: (config: Record<string, any>) => void
  onValidationChange: (isValid: boolean, errors: string[]) => void
  className?: string
}

interface FieldState {
  value: any
  error?: string
  touched: boolean
}

export function DynamicConfigForm({
  template,
  initialConfig = {},
  onConfigChange,
  onValidationChange,
  className = ''
}: DynamicConfigFormProps) {
  const [config, setConfig] = useState<Record<string, FieldState>>({})
  const [showSensitiveFields, setShowSensitiveFields] = useState<Record<string, boolean>>({})
  
  // Store callbacks in refs to prevent infinite loops
  const onConfigChangeRef = useRef(onConfigChange)
  const onValidationChangeRef = useRef(onValidationChange)
  
  useEffect(() => {
    onConfigChangeRef.current = onConfigChange
    onValidationChangeRef.current = onValidationChange
  }, [onConfigChange, onValidationChange])

  // Initialize form state - only when template changes
  useEffect(() => {
    const initialState: Record<string, FieldState> = {}
    
    // Initialize required fields
    template.required_env_vars.forEach(varSchema => {
      initialState[varSchema.name] = {
        value: initialConfig[varSchema.name] || getDefaultValue(varSchema),
        touched: false
      }
    })

    // Initialize optional fields
    template.optional_env_vars.forEach(varSchema => {
      initialState[varSchema.name] = {
        value: initialConfig[varSchema.name] || getDefaultValue(varSchema),
        touched: false
      }
    })

    setConfig(initialState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]) // Only re-initialize when template changes, not when config updates

  // Validate and emit changes
  useEffect(() => {
    const currentConfig: Record<string, any> = {}
    const errors: string[] = []

    Object.entries(config).forEach(([key, fieldState]) => {
      currentConfig[key] = fieldState.value
      if (fieldState.error) {
        errors.push(fieldState.error)
      }
    })

    // Validate required fields
    template.required_env_vars.forEach(varSchema => {
      const fieldState = config[varSchema.name]
      if (!fieldState || !fieldState.value || fieldState.value === '') {
        errors.push(`${varSchema.display_name} is required`)
      }
    })

    onConfigChangeRef.current(currentConfig)
    onValidationChangeRef.current(errors.length === 0, errors)
  }, [config, template.required_env_vars, template.optional_env_vars]) // Remove callbacks from deps to prevent loops

  const updateField = (name: string, value: any) => {
    const varSchema = [...template.required_env_vars, ...template.optional_env_vars]
      .find(v => v.name === name)
    
    const error = varSchema ? validateField(value, varSchema) : undefined

    setConfig(prev => ({
      ...prev,
      [name]: {
        value,
        error,
        touched: true
      }
    }))
  }

  const toggleSensitiveField = (name: string) => {
    setShowSensitiveFields(prev => ({
      ...prev,
      [name]: !prev[name]
    }))
  }

  const getDefaultValue = (varSchema: EnvVarSchema): any => {
    if (varSchema.default !== undefined) {
      return varSchema.default
    }

    switch (varSchema.type) {
      case 'boolean':
        return false
      case 'number':
        return ''
      default:
        return ''
    }
  }

  const validateField = (value: any, varSchema: EnvVarSchema): string | undefined => {
    // Required validation
    if (varSchema.validation?.required && (value === undefined || value === '')) {
      return `${varSchema.display_name} is required`
    }

    // Skip further validation if empty and not required
    if (value === undefined || value === '') {
      return undefined
    }

    // Type validation
    switch (varSchema.type) {
      case 'number':
        if (isNaN(Number(value))) {
          return `${varSchema.display_name} must be a number`
        }
        break
      case 'url':
        try {
          new URL(value)
        } catch {
          return `${varSchema.display_name} must be a valid URL`
        }
        break
      case 'enum':
        if (varSchema.options && !varSchema.options.includes(value)) {
          return `${varSchema.display_name} must be one of: ${varSchema.options.join(', ')}`
        }
        break
    }

    // Pattern validation
    if (varSchema.validation?.pattern) {
      const regex = new RegExp(varSchema.validation.pattern)
      if (!regex.test(String(value))) {
        return `${varSchema.display_name} format is invalid`
      }
    }

    // Length validation
    if (varSchema.validation?.minLength && String(value).length < varSchema.validation.minLength) {
      return `${varSchema.display_name} must be at least ${varSchema.validation.minLength} characters`
    }

    if (varSchema.validation?.maxLength && String(value).length > varSchema.validation.maxLength) {
      return `${varSchema.display_name} must be at most ${varSchema.validation.maxLength} characters`
    }

    // Numeric range validation
    if (varSchema.type === 'number') {
      const numValue = Number(value)
      if (varSchema.validation?.min !== undefined && numValue < varSchema.validation.min) {
        return `${varSchema.display_name} must be at least ${varSchema.validation.min}`
      }
      if (varSchema.validation?.max !== undefined && numValue > varSchema.validation.max) {
        return `${varSchema.display_name} must be at most ${varSchema.validation.max}`
      }
    }

    return undefined
  }

  const renderField = (varSchema: EnvVarSchema, isRequired: boolean) => {
    const fieldState = config[varSchema.name]
    const value = fieldState?.value || ''
    const error = fieldState?.error
    const touched = fieldState?.touched

    const fieldId = `field-${varSchema.name}`
    const isSensitive = varSchema.sensitive || varSchema.name.toLowerCase().includes('password') || 
                      varSchema.name.toLowerCase().includes('secret') || varSchema.name.toLowerCase().includes('key')

    return (
      <div key={varSchema.name} className="space-y-2">
        <div className="flex items-center space-x-2">
          <Label htmlFor={fieldId} className="text-sm font-medium">
            {varSchema.display_name}
            {isRequired && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {varSchema.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{varSchema.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {renderFieldInput(varSchema, value, fieldId, isSensitive)}

        {error && touched && (
          <div className="flex items-center space-x-1 text-red-600 text-sm">
            <AlertCircle className="h-3 w-3" />
            <span>{error}</span>
          </div>
        )}

        {varSchema.help_text && (
          <p className="text-xs text-gray-500">{varSchema.help_text}</p>
        )}
      </div>
    )
  }

  const renderFieldInput = (varSchema: EnvVarSchema, value: any, fieldId: string, isSensitive: boolean) => {
    const commonProps = {
      id: fieldId,
      value: value || '',
      onChange: (e: any) => updateField(varSchema.name, e.target.value),
      placeholder: varSchema.placeholder || `Enter ${varSchema.display_name.toLowerCase()}...`
    }

    switch (varSchema.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={fieldId}
              checked={Boolean(value)}
              onCheckedChange={(checked) => updateField(varSchema.name, checked)}
            />
            <Label htmlFor={fieldId} className="text-sm text-gray-600">
              {value ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        )

      case 'enum':
        return (
          <Select value={value || ''} onValueChange={(val) => updateField(varSchema.name, val)}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${varSchema.display_name.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {varSchema.options?.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            rows={4}
            className="resize-none"
          />
        )

      default:
        return (
          <div className="relative">
            <Input
              {...commonProps}
              type={isSensitive && !showSensitiveFields[varSchema.name] ? 'password' : 
                    varSchema.type === 'number' ? 'number' : 
                    varSchema.type === 'url' ? 'url' : 'text'}
            />
            {isSensitive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => toggleSensitiveField(varSchema.name)}
              >
                {showSensitiveFields[varSchema.name] ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        )
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Required Fields */}
      {template.required_env_vars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Required Configuration</CardTitle>
            <CardDescription>
              These fields are required for {template.display_name} to function properly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {template.required_env_vars.map(varSchema => 
              renderField(varSchema, true)
            )}
          </CardContent>
        </Card>
      )}

      {/* Optional Fields */}
      {template.optional_env_vars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Optional Configuration</CardTitle>
            <CardDescription>
              These fields are optional and can be used to customize the behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {template.optional_env_vars.map(varSchema => 
              renderField(varSchema, false)
            )}
          </CardContent>
        </Card>
      )}

      {/* Example Configuration */}
      {template.example_config && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium">Example Configuration:</div>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(template.example_config, null, 2)}
              </pre>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
