'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  FileText,
  Server,
  ChevronDown,
  Info
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { FormConfiguration, FormQuestion } from '@/lib/trial';
import { usePostHog } from 'posthog-js/react';

interface DynamicTrialQualificationFormProps {
  onSubmit: (data: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

// Fetch the active form configuration
const fetchActiveFormConfiguration = async (): Promise<FormConfiguration | null> => {
  const response = await fetch('/api/trials/form-configuration');
  
  if (!response.ok) {
    throw new Error('Failed to fetch form configuration');
  }
  
  const data = await response.json();
  return data.configuration;
};

export function DynamicTrialQualificationForm({
  onSubmit,
  onCancel,
  isLoading = false,
  className = ''
}: DynamicTrialQualificationFormProps) {
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const posthog = usePostHog();

  // Fetch the active form configuration
  const { data: formConfig, isLoading: isLoadingConfig, error: configError } = useQuery({
    queryKey: ['active-form-configuration'],
    queryFn: fetchActiveFormConfiguration,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Initialize form data with default values when config loads
  React.useEffect(() => {
    if (formConfig) {
      const initialData: Record<string, any> = {};
      formConfig.questions.forEach(question => {
        if (question.type === 'checkbox') {
          initialData[question.id] = [];
        } else {
          initialData[question.id] = '';
        }
      });
      setFormData(initialData);
    }
  }, [formConfig]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formConfig) return false;

    formConfig.questions.forEach(question => {
      if (question.required) {
        const value = formData[question.id];
        
        if (question.type === 'checkbox') {
          if (!value || value.length === 0) {
            newErrors[question.id] = `${question.label} is required`;
          }
        } else if (!value || value.trim() === '') {
          newErrors[question.id] = `${question.label} is required`;
        }
      }

      // Apply validation rules if present
      if (question.validation && formData[question.id]) {
        const value = formData[question.id];
        
        if (question.validation.min_length && value.length < question.validation.min_length) {
          newErrors[question.id] = `Minimum length is ${question.validation.min_length} characters`;
        }
        
        if (question.validation.max_length && value.length > question.validation.max_length) {
          newErrors[question.id] = `Maximum length is ${question.validation.max_length} characters`;
        }
        
        if (question.validation.pattern) {
          const regex = new RegExp(question.validation.pattern);
          if (!regex.test(value)) {
            newErrors[question.id] = `Invalid format`;
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Track form submission
      posthog?.capture('trial_form_submitted', {
        form_type: formConfig?.id || 'dynamic',
        form_name: formConfig?.name,
        qualification_questions_count: Object.keys(formData).length
      });
      
      // Submit the form data directly - no transformation needed
      // The backend will handle dynamic validation and scoring
      console.log('Submitting trial application with data:', {
        formData,
        formConfig: formConfig
      });
      
      await onSubmit(formData);
    } catch (error) {
      console.error('Trial application submission failed:', error);
      setErrors({ submit: 'Failed to submit application. Please try again.' });
      
      // Track submission error
      posthog?.capture('trial_form_error', {
        error_type: 'submission_failed',
        form_type: formConfig?.id || 'dynamic'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (questionId: string, value: any) => {
    setFormData(prev => ({ ...prev, [questionId]: value }));
    // Clear error for this field
    setErrors(prev => ({ ...prev, [questionId]: '' }));
  };

  const renderQuestion = (question: FormQuestion) => {
    switch (question.type) {
      case 'text':
        return (
          <Input
            id={question.id}
            value={formData[question.id] || ''}
            onChange={(e) => updateFormData(question.id, e.target.value)}
            placeholder={question.description || 'Enter your answer'}
            className="font-mono"
          />
        );

      case 'textarea':
        return (
          <Textarea
            id={question.id}
            value={formData[question.id] || ''}
            onChange={(e) => updateFormData(question.id, e.target.value)}
            placeholder={question.description || 'Enter your answer'}
            className="font-mono"
            rows={4}
          />
        );

      case 'select':
        return (
          <Select
            value={formData[question.id] || ''}
            onValueChange={(value) => updateFormData(question.id, value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={question.description || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div>
                    <div className="font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={formData[question.id] || ''}
            onValueChange={(value) => updateFormData(question.id, value)}
            className="space-y-3"
          >
            {question.options?.map((option) => (
              <div key={option.value} className="flex items-start space-x-3">
                <RadioGroupItem value={option.value} id={`${question.id}_${option.value}`} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={`${question.id}_${option.value}`} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  {option.description && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        const selectedValues = formData[question.id] || [];
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <div key={option.value} className="flex items-start space-x-3">
                <Checkbox
                  id={`${question.id}_${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((v: string) => v !== option.value);
                    updateFormData(question.id, newValues);
                  }}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor={`${question.id}_${option.value}`} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  {option.description && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground font-mono">LOADING TRIAL FORM...</p>
        </div>
      </div>
    );
  }

  if (configError || !formConfig) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="font-mono">
          Failed to load trial application form. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Server className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold terminal-text">TRIAL APPLICATION</h2>
        </div>
        <p className="text-muted-foreground font-mono">
          {'>'} {formConfig.name.toUpperCase()}
        </p>
        {formConfig.description && (
          <p className="text-sm text-muted-foreground font-mono max-w-2xl mx-auto">
            {formConfig.description}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Render questions in order */}
        {formConfig.questions
          .sort((a, b) => a.order_index - b.order_index)
          .map((question) => (
            <Card key={question.id} className="card-terminal">
              <CardHeader>
                <CardTitle className="terminal-text flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {question.label}
                  {question.required && (
                    <span className="text-destructive">*</span>
                  )}
                </CardTitle>
                {question.description && (
                  <CardDescription className="font-mono">
                    {question.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {renderQuestion(question)}
                {errors[question.id] && (
                  <p className="text-sm text-red-500 mt-2 font-mono">
                    {'>'} {errors[question.id]}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

        {/* Submit Error */}
        {errors.submit && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono">
              {errors.submit}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading || isSubmitting}
            className="gap-2"
          >
            [CANCEL]
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isSubmitting}
            className="gap-2 btn-terminal"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                [SUBMITTING...]
              </>
            ) : (
              <>
                [SUBMIT APPLICATION]
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
          {'>'} Your application will be reviewed based on the information provided
          <br />
          {'>'} Approval times vary based on your responses and current settings
          <br />
          {'>'} You'll be notified via email once your application is processed
        </AlertDescription>
      </Alert>
    </div>
  );
}
