'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Rocket, Server, Activity, Terminal, Plus, RefreshCw, 
  AlertCircle, CheckCircle2, Clock, Loader2, Eye 
} from 'lucide-react';

// Import the hooks from Phase 2
import { useDeploymentsWithImpersonation, useDeploymentStatsWithImpersonation } from '@/hooks/deployment';
import { useTrialStatusWithImpersonation } from '@/hooks/trial';
import { useEffectiveUserId, useImpersonation } from '@/contexts/ImpersonationContext';
import { useAdminStatus } from '@/hooks/admin';
import { DeploymentList } from './deployment/DeploymentList';
import { DeploymentForm } from './deployment/DeploymentForm';
import { DeploymentDetail } from './deployment/DeploymentDetail';
import { DeploymentSuccess } from './deployment/DeploymentSuccess';
import { DynamicTrialQualificationForm } from './DynamicTrialQualificationForm';
import { TrialStartModal } from './TrialStartModal';
import { TrialPendingApproval } from './TrialPendingApproval';

interface DeployTabProps {
  userId: string;
}

// Persistent state management
const getPersistedState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('mcp-deploy-tab-state');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const setPersistedState = (state: {
  selectedDeploymentId: string | null;
  showCreateForm: boolean;
  showSuccess: boolean;
  showTrialForm: boolean;
  lastDeployment: {
    id: string;
    name: string;
    url: string;
    transportType: 'sse' | 'http';
  } | null;
}) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('mcp-deploy-tab-state', JSON.stringify(state));
  } catch {
    // Ignore localStorage errors
  }
};

export function DeployTab({ userId }: DeployTabProps) {
  // Use effective user ID (impersonated user if active, otherwise current user)
  const effectiveUserId = useEffectiveUserId(userId);
  const { isImpersonating, impersonatedUserEmail } = useImpersonation();
  
  // Initialize state with persisted values
  const persistedState = getPersistedState();
  const [selectedDeploymentId, setSelectedDeploymentId] = React.useState<string | null>(
    persistedState?.selectedDeploymentId || null
  );
  const [showCreateForm, setShowCreateForm] = React.useState(
    persistedState?.showCreateForm || false
  );
  const [showSuccess, setShowSuccess] = React.useState(
    persistedState?.showSuccess || false
  );
  const [showTrialForm, setShowTrialForm] = React.useState(
    persistedState?.showTrialForm || false
  );
  const [showTrialModal, setShowTrialModal] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [lastDeployment, setLastDeployment] = React.useState<{
    id: string;
    name: string;
    url: string;
    transportType: 'sse' | 'http';
  } | null>(persistedState?.lastDeployment || null);
  
  // Persist state changes with debounce to prevent excessive writes
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPersistedState({
        selectedDeploymentId,
        showCreateForm,
        showSuccess,
        showTrialForm,
        lastDeployment
      });
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [selectedDeploymentId, showCreateForm, showSuccess, showTrialForm, lastDeployment]);
  
  const { 
    deployments, 
    isLoading, 
    error, 
    refetch,
    createDeployment,
    deleteDeployment
  } = useDeploymentsWithImpersonation(effectiveUserId || '');
  
  const stats = useDeploymentStatsWithImpersonation(effectiveUserId || '');
  
  // Trial status hook - use effective user ID with impersonation support
  const trialStatus = useTrialStatusWithImpersonation(effectiveUserId || '');
  
  // Admin status - exclude admins from trial flows
  const adminStatus = useAdminStatus();

  // Helper function to clear all state
  const clearState = () => {
    setSelectedDeploymentId(null);
    setShowCreateForm(false);
    setShowSuccess(false);
    setShowTrialForm(false);
    setLastDeployment(null);
  };

  // Handle regular new deployment button (top of page)
  const handleNewDeployment = () => {
    // Check if user can create deployments
    if (adminStatus.isAdmin || trialStatus.hasActiveTrial || 
        (trialStatus.application && trialStatus.application.status === 'approved')) {
      setShowCreateForm(true);
    } else if (trialStatus.needsQualification) {
      // Show trial modal for new users
      setShowTrialModal(true);
    }
    // If they have a pending application, do nothing (they'll see the pending screen)
  };

  // Handle "Create Your First Deployment" button - WITH trial logic
  const handleCreateFirstDeployment = () => {
    if (trialStatus.needsQualification) {
      // Show trial modal first for server selection and confirmation
      setShowTrialModal(true);
    } else {
      setShowCreateForm(true);
    }
  };

  // Handle trial modal confirmation
  const handleStartTrial = (serverType: string) => {
    setShowTrialModal(false);
    setShowTrialForm(true);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold terminal-text">MCP SERVER DEPLOYMENTS</h2>
            <p className="text-muted-foreground mt-1 font-mono">
              {'>'} DEPLOY AND MANAGE YOUR MCP SERVERS
            </p>
          </div>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load deployments: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <Alert className="border-2 border-amber-500 bg-amber-100 dark:bg-amber-900/20">
          <Eye className="h-4 w-4 text-amber-600" />
          <AlertDescription className="font-mono">
            <strong className="text-amber-800 dark:text-amber-200">ADMIN IMPERSONATION ACTIVE:</strong> 
            {' '}Viewing as {impersonatedUserEmail}
            <br />
            {'>'} All trial statuses and deployments shown are for the impersonated user
            <br />
            {'>'} Actions taken will affect their actual account
          </AlertDescription>
        </Alert>
      )}

      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold terminal-text">MCP SERVER DEPLOYMENTS</h2>
          <p className="text-muted-foreground mt-1 font-mono">
            {'>'} DEPLOY AND MANAGE YOUR EMAILBISON MCP SERVER 
          </p>
        </div>
        <Button 
          onClick={handleNewDeployment}
          className="gap-2 btn-terminal"
          disabled={
            showCreateForm || 
            showTrialForm || 
            selectedDeploymentId !== null ||
            (trialStatus.application && trialStatus.application.status === 'pending')
          }
        >
          <Plus className="h-4 w-4" />
          [NEW DEPLOYMENT]
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-terminal">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold terminal-text">
              {stats.data?.total || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-terminal">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {stats.data?.active || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-terminal">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {stats.data?.failed || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-terminal">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Healthy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {stats.data?.healthy || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      {showSuccess && lastDeployment ? (
        <DeploymentSuccess
          deploymentId={lastDeployment.id}
          deploymentName={lastDeployment.name}
          serviceUrl={lastDeployment.url}
          transportType={lastDeployment.transportType}
          trial={trialStatus.trial || undefined}
          onContinue={() => {
            setShowSuccess(false);
            setLastDeployment(null);
            refetch(); // Refresh deployments list
          }}
          onViewDetails={() => {
            setShowSuccess(false);
            setSelectedDeploymentId(lastDeployment.id);
            setLastDeployment(null);
          }}
        />
      ) : showTrialForm ? (
        <DynamicTrialQualificationForm
          onSubmit={async (data: Record<string, any>) => {
            try {
              await trialStatus.submitApplication(data);
              // Refresh trial status to get the updated application state
              await trialStatus.refreshTrialStatus();
              
              // Check if the application was auto-approved
              // The trial status will be updated after refresh
              setShowTrialForm(false);
              
              // We don't automatically show the create form anymore
              // The user will see their application status and can create deployment if approved
            } catch (error) {
              console.error('Trial application failed:', error);
              // Error will be shown in the form
            }
          }}
          onCancel={() => setShowTrialForm(false)}
          isLoading={trialStatus.isLoading}
        />
      ) : showCreateForm ? (
        <DeploymentForm
          onSubmit={async (data) => {
            try {
              setIsCreating(true);
              
              // Handle multi-server deployment submission
              const deploymentInput: any = {
                user_id: userId,
                deployment_name: data.deployment_name,
                railway_project_id: data.railway_project_id || '',
                transport_type: data.transport_type,
                environment: data.environment,
                advanced_config: data.advanced_config
              };

              // All deployments use the same format
              deploymentInput.server_template_id = data.server_template_id;
              deploymentInput.server_config = data.server_config;
              
              const deployment = await createDeployment(deploymentInput);
              
              // Show success screen with deployment details
              setLastDeployment({
                id: deployment.id,
                name: deployment.deployment_name,
                url: deployment.service_url || '',
                transportType: data.transport_type || 'sse'
              });
              setShowCreateForm(false);
              setShowSuccess(true);
            } catch (error) {
              console.error('Deployment failed:', error);
              // Error will be shown in the form
            } finally {
              setIsCreating(false);
            }
          }}
          onCancel={() => setShowCreateForm(false)}
          isLoading={isCreating}
        />
      ) : selectedDeploymentId ? (
        <DeploymentDetail
          deploymentId={selectedDeploymentId}
          onBack={() => setSelectedDeploymentId(null)}
        />
      ) : trialStatus.application && trialStatus.application.status === 'pending' ? (
        // Show pending approval state if user has a pending application
        <TrialPendingApproval
          application={trialStatus.application}
          onRefresh={() => trialStatus.refreshTrialStatus()}
          isRefreshing={trialStatus.isLoading}
        />
      ) : (
        <DeploymentList
          deployments={deployments}
          isLoading={isLoading}
          onRefresh={refetch}
          onDeploymentClick={(deployment) => setSelectedDeploymentId(deployment.id)}
          onDeleteDeployment={async (deploymentId) => {
            await deleteDeployment(deploymentId);
          }}
        />
      )}

      {/* Trial Start Modal */}
      <TrialStartModal
        isOpen={showTrialModal}
        onClose={() => setShowTrialModal(false)}
        onStartTrial={handleStartTrial}
        isLoading={trialStatus.isLoading}
      />

      {/* Future State Preview - Only show when no deployments exist and no forms are showing AND no pending application */}
      {!isLoading && deployments.length === 0 && !showCreateForm && !showTrialForm && !showTrialModal && 
        !(trialStatus.application && trialStatus.application.status === 'pending') && (
        <Card className="card-terminal border-dashed border-2 bg-muted/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 terminal-text">
              <Rocket className="h-5 w-5 text-primary" />
              AUTOMATED DEPLOYMENT PIPELINE
            </CardTitle>
            <CardDescription className="font-mono">
              {'>'} FULLY FUNCTIONAL CLOUD DEPLOYMENT SYSTEM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="status-led online"></div>
                <div>
                  <p className="font-medium text-foreground terminal-text">SELF-SERVE DEPLOYMENT</p>
                  <p className="font-mono">SUBMIT API KEYS THROUGH SECURE FORMS</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="status-led online"></div>
                <div>
                  <p className="font-medium text-foreground terminal-text">MANAGED SERVICE</p>
                  <p className="font-mono">INSTANT SERVER PROVISIONING WITH YOUR CONFIG</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="status-led online"></div>
                <div>
                  <p className="font-medium text-foreground terminal-text">REAL-TIME ANALYTICS</p>
                  <p className="font-mono">MONITOR HEALTH, USAGE, AND PERFORMANCE METRICS</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-border">
              <Button 
                onClick={handleCreateFirstDeployment}
                className="w-full gap-2 btn-terminal"
              >
                <Plus className="h-4 w-4" />
                [CREATE YOUR FIRST DEPLOYMENT]
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
