'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd'
import { 
  Save,
  X,
  Plus,
  Trash2,
  GripVertical,
  AlertTriangle,
  FileText,
  Type,
  ListChecks,
  ToggleLeft,
  MessageSquare,
  Hash,
  Edit3,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import logger from '@/lib/logger'
import type { FormConfiguration, FormQuestion } from '@/lib/trial'

interface FormConfigurationEditorProps {
  configuration?: FormConfiguration
  onSave: () => void
  onCancel: () => void
}

// Default questions for a new form with semantic IDs that map to expected fields
const DEFAULT_QUESTIONS: FormQuestion[] = [
  {
    id: 'use_case', // Maps to required field
    type: 'select',
    label: 'What is your primary use case?',
    description: 'Tell us how you plan to use MCP GTM',
    required: true,
    options: [
      { value: 'email_automation', label: 'Email Automation', description: 'Automate email campaigns and responses' },
      { value: 'customer_support', label: 'Customer Support', description: 'Enhance customer service capabilities' },
      { value: 'content_creation', label: 'Content Creation', description: 'Generate and manage content' },
      { value: 'data_analysis', label: 'Data Analysis', description: 'Analyze and process data' },
      { value: 'exploration', label: 'Just Exploring', description: 'Learning about the platform' }
    ],
    order_index: 0
  },
  {
    id: 'technical_level', // Maps to required field
    type: 'radio',
    label: 'What is your technical level?',
    description: 'This helps us provide the right level of support',
    required: true,
    options: [
      { value: 'expert', label: 'Expert Developer' },
      { value: 'intermediate', label: 'Some Technical Experience' },
      { value: 'beginner', label: 'New to Development' }
    ],
    order_index: 1
  },
  {
    id: 'timeline', // Maps to required field
    type: 'select',
    label: 'When do you plan to implement?',
    required: true,
    options: [
      { value: 'immediate', label: 'Immediately' },
      { value: 'this_month', label: 'Within This Month' },
      { value: 'exploring', label: 'Just Exploring Options' }
    ],
    order_index: 2
  },
  {
    id: 'company_size', // Maps to required field
    type: 'select',
    label: 'What is your company size?',
    required: true,
    options: [
      { value: 'enterprise', label: 'Enterprise (500+ employees)' },
      { value: 'business', label: 'Business (10-500 employees)' },
      { value: 'personal', label: 'Personal/Startup (1-10 employees)' }
    ],
    order_index: 3
  },
  {
    id: 'company_name', // Optional field
    type: 'text',
    label: 'Company Name',
    description: 'Your company or organization name',
    required: false,
    order_index: 4
  },
  {
    id: 'role', // Optional field
    type: 'text',
    label: 'Your Role',
    description: 'Your position or title',
    required: false,
    order_index: 5
  }
]

const QUESTION_TYPE_ICONS = {
  text: Type,
  textarea: MessageSquare,
  select: ListChecks,
  radio: ToggleLeft,
  checkbox: ListChecks
}

export default function FormConfigurationEditor({ 
  configuration, 
  onSave, 
  onCancel 
}: FormConfigurationEditorProps) {
  const [formData, setFormData] = useState({
    name: configuration?.name || '',
    description: configuration?.description || '',
    questions: configuration?.questions || DEFAULT_QUESTIONS
  })
  const [saving, setSaving] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)

  const handleAddQuestion = () => {
    // Generate a semantic ID based on the question number
    // Admins should update this to match the expected field name
    const questionNum = formData.questions.length + 1
    const newQuestion: FormQuestion = {
      id: `custom_field_${questionNum}`,
      type: 'text',
      label: 'New Question',
      description: '',
      required: false,
      options: [],
      order_index: formData.questions.length
    }

    setFormData({
      ...formData,
      questions: [...formData.questions, newQuestion]
    })
    setEditingQuestion(newQuestion.id)
    
    // Show a toast to remind about ID importance
    toast.info('Remember to update the question ID to match expected field names (e.g., use_case, technical_level)')
  }

  const handleUpdateQuestion = (questionId: string, updates: Partial<FormQuestion>) => {
    setFormData({
      ...formData,
      questions: formData.questions.map(q => 
        q.id === questionId ? { ...q, ...updates } : q
      )
    })
  }

  const handleDeleteQuestion = (questionId: string) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter(q => q.id !== questionId)
    })
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(formData.questions)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update order_index for all questions
    const updatedQuestions = items.map((item, index) => ({
      ...item,
      order_index: index
    }))

    setFormData({
      ...formData,
      questions: updatedQuestions
    })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Form name is required')
      return
    }

    if (formData.questions.length === 0) {
      toast.error('At least one question is required')
      return
    }

    try {
      setSaving(true)

      const endpoint = configuration?.id 
        ? `/api/admin/form-configurations/${configuration.id}`
        : '/api/admin/form-configurations'
      
      const method = configuration?.id ? 'PUT' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          questions: formData.questions // Keep IDs - they're important for mapping
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save form configuration')
      }

      const result = await response.json()
      
      if (result.success) {
        toast.success(configuration?.id ? 'Form configuration updated' : 'Form configuration created')
        onSave()
      } else {
        throw new Error(result.error?.message || 'Failed to save configuration')
      }
    } catch (error) {
      logger.error('Failed to save form configuration', { error })
      toast.error('Failed to save form configuration')
    } finally {
      setSaving(false)
    }
  }

  const renderQuestionEditor = (question: FormQuestion) => {
    const isEditing = editingQuestion === question.id
    const IconComponent = QUESTION_TYPE_ICONS[question.type]

    return (
      <div className="p-4 border-2 border-border bg-muted/20">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center flex-1">
            <IconComponent className="h-4 w-4 mr-2 text-primary" />
            {isEditing ? (
              <Input
                value={question.label}
                onChange={(e) => handleUpdateQuestion(question.id, { label: e.target.value })}
                className="font-mono"
                placeholder="Question label"
              />
            ) : (
              <div className="flex-1">
                <p className="font-mono font-medium terminal-text">{question.label}</p>
                {question.description && (
                  <p className="text-xs text-muted-foreground font-mono mt-1">{question.description}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingQuestion(isEditing ? null : question.id)}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteQuestion(question.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isEditing && (
          <div className="space-y-3 mt-4">
            <div>
              <Label className="font-mono text-xs">FIELD ID (IMPORTANT FOR API MAPPING)</Label>
              <Input
                value={question.id}
                onChange={(e) => {
                  // Update the question ID in the array
                  const newId = e.target.value.replace(/\s+/g, '_').toLowerCase()
                  setFormData({
                    ...formData,
                    questions: formData.questions.map(q => 
                      q.id === question.id ? { ...q, id: newId } : q
                    )
                  })
                  setEditingQuestion(newId)
                }}
                className="font-mono"
                placeholder="e.g., use_case, technical_level"
              />
              <p className="text-xs text-muted-foreground font-mono mt-1">
                For required fields use: use_case, technical_level, timeline, company_size
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-mono text-xs">TYPE</Label>
                <Select
                  value={question.type}
                  onValueChange={(value) => handleUpdateQuestion(question.id, { 
                    type: value as FormQuestion['type'],
                    options: ['select', 'radio', 'checkbox'].includes(value) ? question.options : []
                  })}
                >
                  <SelectTrigger className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text" className="font-mono">Text Input</SelectItem>
                    <SelectItem value="textarea" className="font-mono">Text Area</SelectItem>
                    <SelectItem value="select" className="font-mono">Dropdown</SelectItem>
                    <SelectItem value="radio" className="font-mono">Radio Buttons</SelectItem>
                    <SelectItem value="checkbox" className="font-mono">Checkboxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-mono text-xs">REQUIRED</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Switch
                    checked={question.required}
                    onCheckedChange={(checked) => handleUpdateQuestion(question.id, { required: checked })}
                  />
                  <Label className="font-mono text-xs">{question.required ? 'YES' : 'NO'}</Label>
                </div>
              </div>
            </div>

            <div>
              <Label className="font-mono text-xs">DESCRIPTION (OPTIONAL)</Label>
              <Textarea
                value={question.description || ''}
                onChange={(e) => handleUpdateQuestion(question.id, { description: e.target.value })}
                className="font-mono"
                placeholder="Additional help text for this question"
                rows={2}
              />
            </div>

            {['select', 'radio', 'checkbox'].includes(question.type) && (
              <div>
                <Label className="font-mono text-xs mb-2 block">OPTIONS</Label>
                <div className="space-y-2">
                  {question.options?.map((option, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={option.value}
                        onChange={(e) => {
                          const newOptions = [...(question.options || [])]
                          newOptions[idx] = { ...newOptions[idx], value: e.target.value }
                          handleUpdateQuestion(question.id, { options: newOptions })
                        }}
                        className="font-mono"
                        placeholder="Value"
                      />
                      <Input
                        value={option.label}
                        onChange={(e) => {
                          const newOptions = [...(question.options || [])]
                          newOptions[idx] = { ...newOptions[idx], label: e.target.value }
                          handleUpdateQuestion(question.id, { options: newOptions })
                        }}
                        className="font-mono"
                        placeholder="Label"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newOptions = question.options?.filter((_, i) => i !== idx)
                          handleUpdateQuestion(question.id, { options: newOptions })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newOptions = [...(question.options || []), { value: '', label: '', description: '' }]
                      handleUpdateQuestion(question.id, { options: newOptions })
                    }}
                    className="font-mono"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    ADD OPTION
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="card-terminal">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center font-mono terminal-text">
              <FileText className="h-5 w-5 mr-2 text-primary" />
              {configuration?.id ? 'EDIT' : 'CREATE'} FORM CONFIGURATION
            </CardTitle>
            <CardDescription className="font-mono text-xs mt-1">
              DESIGN YOUR TRIAL APPLICATION FORM
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="font-mono"
            >
              <X className="h-4 w-4 mr-2" />
              CANCEL
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="font-mono terminal-button"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              SAVE CONFIGURATION
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form Details */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="font-mono text-xs">FORM NAME</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Email Bison Trial Application"
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor="description" className="font-mono text-xs">DESCRIPTION (OPTIONAL)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this form configuration"
              className="font-mono"
              rows={3}
            />
          </div>
        </div>

        <Separator />

        {/* Questions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-mono font-semibold terminal-text">FORM QUESTIONS</h3>
            <Button
              onClick={handleAddQuestion}
              variant="outline"
              size="sm"
              className="font-mono"
            >
              <Plus className="h-4 w-4 mr-2" />
              ADD QUESTION
            </Button>
          </div>

          {formData.questions.length === 0 ? (
            <Alert className="border-2 border-warning/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-mono">
                NO QUESTIONS ADDED YET. ADD AT LEAST ONE QUESTION TO CREATE A VALID FORM.
              </AlertDescription>
            </Alert>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="questions">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {formData.questions.map((question, index) => (
                      <Draggable key={question.id} draggableId={question.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`relative ${snapshot.isDragging ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                {...provided.dragHandleProps}
                                className="mt-4 cursor-move"
                              >
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                {renderQuestionEditor(question)}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 
