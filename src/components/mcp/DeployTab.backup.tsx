import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket, Server, Shield, Zap, ArrowRight, Clock, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const serverTemplates = [
  {
    id: 'smartlead',
    name: 'Smartlead MCP Server',
    description: 'Email sequencing and campaign automation',
    deployUrl: 'https://railway.com/deploy/YyT1tk?referralCode=SQ5fZY',
    features: ['Campaign Management', 'Email Sequences', 'A/B Testing', 'Analytics'],
    // estimatedCost: '$5-10/month', // Removed pricing
    setupTime: '~2 minutes',
    category: 'Email Automation'
  },
  {
    id: 'n8n',
    name: 'n8n MCP Server',
    description: 'Workflow automation and integration',
    deployUrl: 'https://railway.com/deploy/se2WHK?referralCode=SQ5fZY',
    features: ['Workflow Automation', 'API Integration', 'Data Processing', 'Event-Driven Architecture'],
    // estimatedCost: '$5-10/month', // Removed pricing
    setupTime: '~2 minutes',
    category: 'Workflow Automation'
  }
];

interface DeployTabProps {
  userId: string;
}

export function DeployTab({ userId }: DeployTabProps) {
  const [deploymentStatus, setDeploymentStatus] = React.useState<{[key: string]: 'idle' | 'deploying' | 'deployed'}>({});

  const handleDeploy = (templateId: string, deployUrl: string) => {
    // Track deployment intent (future: actual deployment via Railway API)
    setDeploymentStatus(prev => ({ ...prev, [templateId]: 'deploying' }));
    
    // Open Railway deploy in new tab
    window.open(deployUrl, '_blank');
    
    // Simulate deployment tracking (future: webhook from Railway)
    setTimeout(() => {
      setDeploymentStatus(prev => ({ ...prev, [templateId]: 'deployed' }));
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold terminal-text">DEPLOY MCP SERVERS</h2>
            <p className="text-muted-foreground mt-1 font-mono">
              {'>'} ONE-CLICK DEPLOYMENT OF PRE-CONFIGURED MCP SERVERS TO THE CLOUD
            </p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Zap className="h-3 w-3" />
            Quick Deploy
          </Badge>
        </div>

        <Alert>
          <Rocket className="h-4 w-4" />
          <AlertDescription>
            <strong>Coming Soon:</strong> Automated deployment pipeline with API key management. 
            For now, use these pre-configured cloud platform templates.
          </AlertDescription>
        </Alert>
      </div>

      {/* Server Templates Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {serverTemplates.map((template) => (
          <Card key={template.id} className="card-terminal relative overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl terminal-text">{template.name}</CardTitle>
                  <CardDescription className="mt-2 font-mono">
                    {template.description}
                  </CardDescription>
                </div>
                <Badge variant="outline">{template.category}</Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Features */}
              <div>
                <p className="text-sm font-medium mb-2">Features:</p>
                <div className="flex flex-wrap gap-2">
                  {template.features.map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Deployment Info */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{template.setupTime}</span>
                </div>
                {/* <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>{template.estimatedCost}</span>
                </div> */}
              </div>
            </CardContent>

            <CardFooter>
              <Button 
                className="w-full gap-2 btn-terminal" 
                onClick={() => handleDeploy(template.id, template.deployUrl)}
                disabled={deploymentStatus[template.id] === 'deploying'}
              >
                {deploymentStatus[template.id] === 'deploying' ? (
                  <>
                    <Server className="h-4 w-4 animate-pulse" />
                    Deploying...
                  </>
                ) : deploymentStatus[template.id] === 'deployed' ? (
                  <>
                    <Shield className="h-4 w-4" />
                    Deployed
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    [DEPLOY]
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Future State Preview */}
      <Card className="card-terminal border-dashed border-2 bg-muted/20">
        <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 terminal-text">
              <Zap className="h-5 w-5 text-primary" />
              AUTOMATED DEPLOYMENT PIPELINE (COMING SOON EXCLUSIVELY FOR DESIGN PARTNERS)
            </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="status-led online"></div>
              <div>
                <p className="font-medium text-foreground terminal-text">SELF-SERVE DEPLOYMENT</p>
                <p className="font-mono">PARTNERS SUBMIT API KEYS THROUGH SECURE FORMS</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="status-led warning"></div>
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
        </CardContent>
      </Card>
    </div>
  );
} 
