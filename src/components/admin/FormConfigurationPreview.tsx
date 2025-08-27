'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Eye,
  X,
  Server,
  CheckCircle
} from 'lucide-react'
import type { FormConfiguration, FormQuestion } from '@/lib/trial'

interface FormConfigurationPreviewProps {
  configuration: FormConfiguration
  onClose: () => void
}

export default function FormConfigurationPreview({ 
  configuration, 
  onClose 
}: FormConfigurationPreviewProps) {
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  const renderQuestionInput = (question: FormQuestion) => {
    switch (question.type) {
      case 'text':
        return (
          <Input
            id={question.id}
            value={formValues[question.id] || ''}
            onChange={(e) => setFormValues({ ...formValues, [question.id]: e.target.value })}
            placeholder="Enter your answer"
            className="font-mono"
            required={question.required}
          />
        )

      case 'textarea':
        return (
          <Textarea
            id={question.id}
            value={formValues[question.id] || ''}
            onChange={(e) => setFormValues({ ...formValues, [question.id]: e.target.value })}
            placeholder="Enter your answer"
            className="font-mono"
            rows={4}
            required={question.required}
          />
        )

      case 'select':
        return (
          <Select
            value={formValues[question.id] || ''}
            onValueChange={(value) => setFormValues({ ...formValues, [question.id]: value })}
            required={question.required}
          >
            <SelectTrigger className="font-mono">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option.value} value={option.value} className="font-mono">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'radio':
        return (
          <RadioGroup
            value={formValues[question.id] || ''}
            onValueChange={(value) => setFormValues({ ...formValues, [question.id]: value })}
            required={question.required}
          >
            {question.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${question.id}_${option.value}`} />
                <Label 
                  htmlFor={`${question.id}_${option.value}`} 
                  className="font-mono cursor-pointer"
                >
                  {option.label}
                  {option.description && (
                    <span className="block text-xs text-muted-foreground mt-1">
                      {option.description}
                    </span>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )

      case 'checkbox':
        const selectedValues = formValues[question.id] || []
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}_${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((v: string) => v !== option.value)
                    setFormValues({ ...formValues, [question.id]: newValues })
                  }}
                />
                <Label 
                  htmlFor={`${question.id}_${option.value}`} 
                  className="font-mono cursor-pointer"
                >
                  {option.label}
                  {option.description && (
                    <span className="block text-xs text-muted-foreground mt-1">
                      {option.description}
                    </span>
                  )}
                </Label>
              </div>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="card-terminal">
          <CardHeader className="sticky top-0 bg-card z-10 border-b-2 border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center font-mono terminal-text">
                  <Eye className="h-5 w-5 mr-2 text-primary" />
                  FORM PREVIEW
                </CardTitle>
                <CardDescription className="font-mono text-xs mt-1">
                  THIS IS HOW USERS WILL SEE YOUR FORM
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="font-mono"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Simulated user view */}
            <div className="bg-background border-2 border-border p-6 space-y-6">
              {/* Form Header */}
              <div className="text-center space-y-2">
                <Server className="h-12 w-12 mx-auto text-primary" />
                <h2 className="text-2xl font-bold terminal-text">APPLY FOR TRIAL ACCESS</h2>
                <p className="text-muted-foreground font-mono">EMAIL BISON MCP SERVER</p>
              </div>

              {/* Version Badge */}
              <div className="flex justify-center">
                <Badge variant="outline" className="font-mono border-2">
                  FORM VERSION {configuration.version}
                </Badge>
              </div>

              {/* Configuration Info */}
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <h3 className="font-mono font-semibold terminal-text mb-2">
                    {configuration.name}
                  </h3>
                  {configuration.description && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {configuration.description}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Form */}
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {configuration.questions
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((question) => (
                      <div key={question.id} className="space-y-2">
                        <Label htmlFor={question.id} className="font-mono">
                          {question.label}
                          {question.required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        {question.description && (
                          <p className="text-sm text-muted-foreground font-mono">
                            {question.description}
                          </p>
                        )}
                        {renderQuestionInput(question)}
                      </div>
                    ))}

                  <div className="flex justify-center pt-4">
                    <Button 
                      type="submit"
                      size="lg"
                      className="font-mono terminal-button min-w-[200px]"
                    >
                      SUBMIT APPLICATION
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <CheckCircle className="h-16 w-16 mx-auto text-success" />
                  <h3 className="text-xl font-mono font-semibold terminal-text">
                    APPLICATION SUBMITTED
                  </h3>
                  <p className="text-muted-foreground font-mono max-w-md mx-auto">
                    Thank you for applying! Your trial application is now under review. 
                    We'll notify you via email once it's approved.
                  </p>
                  <Button
                    onClick={() => setSubmitted(false)}
                    variant="outline"
                    className="font-mono"
                  >
                    PREVIEW FORM AGAIN
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
