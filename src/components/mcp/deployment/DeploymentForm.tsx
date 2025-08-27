'use client';

import React, { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Rocket, 
  AlertCircle, 
  Info,
  ChevronRight
} from 'lucide-react';
import { DeploymentFormProps, DeploymentFormData } from '../../../contracts/component-contracts';
import { ServerTemplateSelector } from './ServerTemplateSelector';
import { DynamicConfigForm } from './DynamicConfigForm';
import { ServerTemplate } from '@/lib/deployment/server-template-service';

interface DeploymentFormComponentProps extends DeploymentFormProps {
  onCancel: () => void;
}

export function DeploymentForm({
  onSubmit,
  onCancel,
  isLoading = false,
  initialData,
  className = ''
}: DeploymentFormComponentProps) {
  // State for multi-step form
  const [step, setStep] = React.useState<'template' | 'config'>('template');
  const [selectedTemplate, setSelectedTemplate] = React.useState<ServerTemplate | null>(null);
  
  // Form data state
  const [formData, setFormData] = React.useState<DeploymentFormData>({
    deployment_name: initialData?.deployment_name || '',
    railway_project_id: initialData?.railway_project_id || '',
    environment: initialData?.environment || 'production',
    advanced_config: {
      port: initialData?.advanced_config?.port || 3000,
      region: initialData?.advanced_config?.region || 'us-west1',
      healthcheck_path: initialData?.advanced_config?.healthcheck_path || '/health',
      build_command: initialData?.advanced_config?.build_command || 'npm run build',
      start_command: initialData?.advanced_config?.start_command || 'npm start',
      ...initialData?.advanced_config
    }
    // transport_type removed - now handled by server template service
  });

  const [serverConfig, setServerConfig] = React.useState<Record<string, any>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [configIsValid, setConfigIsValid] = React.useState(false);
  const [configErrors, setConfigErrors] = React.useState<string[]>([]);

  // Helper function to update form data
  const updateFormData = useCallback((field: keyof DeploymentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    setErrors(prev => {
      if (prev[field]) {
        const { [field]: removed, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, []);

  // Handle deployment name change
  const handleDeploymentNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    updateFormData('deployment_name', value);
  }, [updateFormData]);

  // Validate deployment name
  const validateDeploymentName = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.deployment_name.trim()) {
      newErrors.deployment_name = 'Deployment name is required';
    } else if (formData.deployment_name.length < 3) {
      newErrors.deployment_name = 'Deployment name must be at least 3 characters';
    } else if (formData.deployment_name.length > 50) {
      newErrors.deployment_name = 'Deployment name must be 50 characters or less';
    } else if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*[a-zA-Z0-9]$/.test(formData.deployment_name) && formData.deployment_name.length > 1) {
      newErrors.deployment_name = 'Deployment name must start and end with a letter or number';
    }

    // Check if the sanitized name would be too short
    const sanitized = formData.deployment_name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    if (sanitized.length < 1) {
      newErrors.deployment_name = 'Deployment name must contain at least one letter or number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle template selection
  const handleTemplateSelect = useCallback((template: ServerTemplate) => {
    setSelectedTemplate(template);
    setStep('config');
  }, []);

  // Handle going back to template selection
  const handleBackToTemplates = useCallback(() => {
    setStep('template');
    setSelectedTemplate(null);
    setServerConfig({});
    setConfigErrors([]);
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplate) {
      setErrors({ submit: 'Please select a server template' });
      return;
    }
    
    if (!validateDeploymentName()) {
      return;
    }
    
    if (!configIsValid) {
      setErrors({ submit: 'Please fix configuration errors before submitting' });
      return;
    }

    try {
      // All server types use the same format - transport type now handled by server template
      await onSubmit({
        ...formData,
        server_template_id: selectedTemplate.id,
        server_config: serverConfig
        // transport_type removed - now resolved by server template service
      });
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors({ submit: 'Failed to create deployment. Please try again.' });
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={step === 'template' ? onCancel : handleBackToTemplates}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          [BACK]
        </Button>
        <div>
          <h2 className="text-2xl font-bold terminal-text">
            {step === 'template' ? 'SELECT SERVER TEMPLATE' : 'CONFIGURE DEPLOYMENT'}
          </h2>
          <p className="text-muted-foreground font-mono">
            {'>'} {step === 'template' 
              ? 'CHOOSE YOUR MCP SERVER TYPE' 
              : `CONFIGURE ${selectedTemplate?.display_name.toUpperCase()}`}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        <Badge variant={step === 'template' ? 'default' : 'secondary'}>
          1. Select Template
        </Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Badge variant={step === 'config' ? 'default' : 'secondary'}>
          2. Configure
        </Badge>
      </div>

      {/* Step Content */}
      {step === 'template' ? (
        <ServerTemplateSelector
          selectedTemplateId={selectedTemplate?.id}
          onTemplateSelect={handleTemplateSelect}
          className="mt-6"
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selected Template Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>{selectedTemplate?.display_name}:</strong> {selectedTemplate?.description}
            </AlertDescription>
          </Alert>

          {/* Deployment Name */}
          <Card className="card-terminal">
            <CardHeader>
              <CardTitle className="terminal-text">DEPLOYMENT SETTINGS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deployment_name" className="terminal-text">
                  Deployment Name *
                </Label>
                <Input
                  id="deployment_name"
                  value={formData.deployment_name}
                  onChange={handleDeploymentNameChange}
                  placeholder="my-mcp-server"
                  className={errors.deployment_name ? 'border-red-500' : ''}
                  maxLength={50}
                />
                {errors.deployment_name && (
                  <p className="text-sm text-red-500 font-mono">{errors.deployment_name}</p>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for cloud service name and connection string • {formData.deployment_name.length}/50 chars
                  </p>
                </div>
              </div>

              {/* Transport Type - Only show for EmailBison */}

            </CardContent>
          </Card>

          {/* Dynamic Configuration Form */}
          {selectedTemplate && (
            <DynamicConfigForm
              template={selectedTemplate}
              initialConfig={serverConfig}
              onConfigChange={setServerConfig}
              onValidationChange={(isValid, errors) => {
                setConfigIsValid(isValid);
                setConfigErrors(errors);
              }}
            />
          )}

          {/* Configuration Errors */}
          {configErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">Please fix the following errors:</p>
                  {configErrors.map((error, index) => (
                    <p key={index} className="text-sm">• {error}</p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleBackToTemplates}
              disabled={isLoading}
              className="flex-1"
            >
              [BACK TO TEMPLATES]
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !configIsValid || !formData.deployment_name}
              className="flex-1 gap-2 btn-terminal"
            >
              {isLoading ? (
                <>
                  <div className="status-led warning animate-pulse"></div>
                  DEPLOYING...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  [DEPLOY]
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

