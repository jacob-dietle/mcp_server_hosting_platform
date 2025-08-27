'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  User, 
  Building2, 
  Clock, 
  Code, 
  Mail, 
  MessageSquare, 
  FileText, 
  BarChart3,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { 
  TrialQualificationFormProps,
  TrialQualificationFormState,
  TrialQualificationData,
  TrialUseCase,
  TechnicalLevel,
  ImplementationTimeline,
  CompanyContext
} from '@/contracts/component-contracts';

const USE_CASE_OPTIONS: Array<{ value: TrialUseCase; label: string; icon: React.ReactNode; description: string }> = [
  {
    value: 'email_automation',
    label: 'Email Automation',
    icon: <Mail className="h-4 w-4" />,
    description: 'Automate email campaigns, responses, and workflows'
  },
  {
    value: 'customer_support',
    label: 'Customer Support',
    icon: <MessageSquare className="h-4 w-4" />,
    description: 'Enhance support workflows and response automation'
  },
  {
    value: 'content_creation',
    label: 'Content Creation',
    icon: <FileText className="h-4 w-4" />,
    description: 'Generate and manage content at scale'
  },
  {
    value: 'data_analysis',
    label: 'Data Analysis',
    icon: <BarChart3 className="h-4 w-4" />,
    description: 'Analyze and process data with AI assistance'
  },
  {
    value: 'exploration',
    label: 'Exploration',
    icon: <Search className="h-4 w-4" />,
    description: 'Explore MCP capabilities and potential use cases'
  }
];

const TECHNICAL_LEVELS: Array<{ value: TechnicalLevel; label: string; description: string }> = [
  {
    value: 'expert',
    label: 'Expert',
    description: 'Extensive experience with APIs, integrations, and development'
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Some technical experience, comfortable with configuration'
  },
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'Limited technical experience, prefer guided setup'
  }
];

const IMPLEMENTATION_TIMELINES: Array<{ value: ImplementationTimeline; label: string; description: string }> = [
  {
    value: 'immediate',
    label: 'Immediate',
    description: 'Ready to implement and deploy right away'
  },
  {
    value: 'this_month',
    label: 'This Month',
    description: 'Planning to implement within the next 30 days'
  },
  {
    value: 'exploring',
    label: 'Exploring',
    description: 'Evaluating options and gathering requirements'
  }
];

const COMPANY_CONTEXTS: Array<{ value: CompanyContext; label: string; description: string }> = [
  {
    value: 'enterprise',
    label: 'Enterprise',
    description: 'Large organization with complex requirements'
  },
  {
    value: 'business',
    label: 'Business',
    description: 'Small to medium business with specific needs'
  },
  {
    value: 'personal',
    label: 'Personal',
    description: 'Individual use or personal projects'
  }
];

export function TrialQualificationForm({
  onSubmit,
  onCancel,
  isLoading = false,
  className = ''
}: TrialQualificationFormProps) {
  const [state, setState] = React.useState<TrialQualificationFormState>({
    formData: {
      primary_use_case: 'email_automation',
      technical_level: 'intermediate',
      implementation_timeline: 'immediate',
      company_context: 'business',
      company_name: '',
      role: ''
    },
    errors: {},
    isValidating: false,
    isSubmitting: false
  });

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Required field validation
    if (!state.formData.primary_use_case) {
      errors.primary_use_case = 'Please select your primary use case';
    }

    if (!state.formData.technical_level) {
      errors.technical_level = 'Please select your technical experience level';
    }

    if (!state.formData.implementation_timeline) {
      errors.implementation_timeline = 'Please select your implementation timeline';
    }

    if (!state.formData.company_context) {
      errors.company_context = 'Please select your company context';
    }

    // Conditional validation
    if (state.formData.company_context !== 'personal' && !state.formData.company_name?.trim()) {
      errors.company_name = 'Company name is required for business and enterprise contexts';
    }

    if (state.formData.company_context !== 'personal' && !state.formData.role?.trim()) {
      errors.role = 'Role is required for business and enterprise contexts';
    }

    setState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setState(prev => ({ ...prev, isValidating: true }));
    
    if (!validateForm()) {
      setState(prev => ({ ...prev, isValidating: false }));
      return;
    }

    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      await onSubmit(state.formData);
    } catch (error) {
      console.error('Trial application submission failed:', error);
      setState(prev => ({
        ...prev,
        errors: { submit: 'Failed to submit application. Please try again.' }
      }));
    } finally {
      setState(prev => ({ 
        ...prev, 
        isValidating: false, 
        isSubmitting: false 
      }));
    }
  };

  const updateFormData = (field: keyof TrialQualificationData, value: string) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: value },
      errors: { ...prev.errors, [field]: '' } // Clear field error on change
    }));
  };

  const selectedUseCase = USE_CASE_OPTIONS.find(option => option.value === state.formData.primary_use_case);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <h2 className="text-2xl font-bold terminal-text">TRIAL QUALIFICATION</h2>
        </div>
        <p className="text-muted-foreground font-mono">
          {'>'} HELP US CUSTOMIZE YOUR EMAILBISON MCP TRIAL EXPERIENCE
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="card-terminal">
          <CardHeader>
            <CardTitle className="terminal-text flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              PRIMARY USE CASE
            </CardTitle>
            <CardDescription className="font-mono">
              What's your main goal with EmailBison MCP Server?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={state.formData.primary_use_case}
              onValueChange={(value) => updateFormData('primary_use_case', value as TrialUseCase)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select your primary use case" />
              </SelectTrigger>
              <SelectContent>
                {USE_CASE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors.primary_use_case && (
              <p className="text-sm text-red-500 mt-1 font-mono">
                {'>'} {state.errors.primary_use_case}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardHeader>
            <CardTitle className="terminal-text flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              TECHNICAL EXPERIENCE
            </CardTitle>
            <CardDescription className="font-mono">
              How would you describe your technical experience level?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={state.formData.technical_level}
              onValueChange={(value) => updateFormData('technical_level', value as TechnicalLevel)}
              className="space-y-3"
            >
              {TECHNICAL_LEVELS.map((level) => (
                <div key={level.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={level.value} id={level.value} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={level.value} className="font-medium cursor-pointer">
                      {level.label}
                    </Label>
                    <p className="text-sm text-muted-foreground font-mono">
                      {level.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
            {state.errors.technical_level && (
              <p className="text-sm text-red-500 mt-2 font-mono">
                {'>'} {state.errors.technical_level}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardHeader>
            <CardTitle className="terminal-text flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              IMPLEMENTATION TIMELINE
            </CardTitle>
            <CardDescription className="font-mono">
              When are you planning to implement this solution?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={state.formData.implementation_timeline}
              onValueChange={(value) => updateFormData('implementation_timeline', value as ImplementationTimeline)}
              className="space-y-3"
            >
              {IMPLEMENTATION_TIMELINES.map((timeline) => (
                <div key={timeline.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={timeline.value} id={timeline.value} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={timeline.value} className="font-medium cursor-pointer">
                      {timeline.label}
                    </Label>
                    <p className="text-sm text-muted-foreground font-mono">
                      {timeline.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
            {state.errors.implementation_timeline && (
              <p className="text-sm text-red-500 mt-2 font-mono">
                {'>'} {state.errors.implementation_timeline}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="card-terminal">
          <CardHeader>
            <CardTitle className="terminal-text flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              COMPANY CONTEXT
            </CardTitle>
            <CardDescription className="font-mono">
              What type of organization will be using this?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={state.formData.company_context}
              onValueChange={(value) => updateFormData('company_context', value as CompanyContext)}
              className="space-y-3"
            >
              {COMPANY_CONTEXTS.map((context) => (
                <div key={context.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={context.value} id={context.value} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={context.value} className="font-medium cursor-pointer">
                      {context.label}
                    </Label>
                    <p className="text-sm text-muted-foreground font-mono">
                      {context.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
            {state.errors.company_context && (
              <p className="text-sm text-red-500 mt-2 font-mono">
                {'>'} {state.errors.company_context}
              </p>
            )}

            {/* Conditional fields for business/enterprise */}
            {state.formData.company_context !== 'personal' && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="font-medium">
                    Company Name
                  </Label>
                  <Input
                    id="company_name"
                    value={state.formData.company_name || ''}
                    onChange={(e) => updateFormData('company_name', e.target.value)}
                    placeholder="Enter your company name"
                    className="font-mono"
                  />
                  {state.errors.company_name && (
                    <p className="text-sm text-red-500 font-mono">
                      {'>'} {state.errors.company_name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="font-medium">
                    Your Role
                  </Label>
                  <Input
                    id="role"
                    value={state.formData.role || ''}
                    onChange={(e) => updateFormData('role', e.target.value)}
                    placeholder="e.g., DevOps Engineer, CTO, Developer"
                    className="font-mono"
                  />
                  {state.errors.role && (
                    <p className="text-sm text-red-500 font-mono">
                      {'>'} {state.errors.role}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Error */}
        {state.errors.submit && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono">
              {state.errors.submit}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading || state.isSubmitting}
            className="gap-2"
          >
            [CANCEL]
          </Button>
          <Button
            type="submit"
            disabled={isLoading || state.isSubmitting || state.isValidating}
            className="gap-2 btn-terminal"
          >
            {state.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                [SUBMITTING...]
              </>
            ) : (
              <>
                [APPLY FOR TRIAL]
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Info Box */}
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription className="font-mono">
          {'>'} Most applications are approved automatically based on qualification criteria
          <br />
          {'>'} You'll receive immediate access for qualifying use cases and timelines
          <br />
          {'>'} Enterprise applications may require additional review
        </AlertDescription>
      </Alert>
    </div>
  );
}
