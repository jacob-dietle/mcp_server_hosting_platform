'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Zap, 
  CheckCircle2, 
  Clock, 
  Star, 
  Mail, 
  ArrowRight,
  Info,
  X
} from 'lucide-react';

interface TrialStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTrial: (serverType: string) => void;
  isLoading?: boolean;
}

interface ServerOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  trialBenefits: string[];
  // estimatedCost: string; // Removed pricing display
  category: string;
}

const AVAILABLE_SERVERS: ServerOption[] = [
  {
    id: 'emailbison',
    name: 'EmailBison MCP Server',
    description: 'Email automation and campaign management platform',
    icon: <Mail className="h-6 w-6" />,
    features: [
      'Email Campaign Automation',
      'Sequence Management', 
      'A/B Testing',
      'Advanced Analytics',
      'API Integration'
    ],
    trialBenefits: [
      'Full access to all premium features',
      'Unlimited email campaigns during trial',
      'Priority support and onboarding',
      'Advanced analytics and reporting',
      'Custom configuration assistance'
    ],
    // estimatedCost: '$5-10/month after trial', // Removed pricing
    category: 'Email Automation'
  }
  // Add more servers here as they become available
];

export function TrialStartModal({
  isOpen,
  onClose,
  onStartTrial,
  isLoading = false
}: TrialStartModalProps) {
  const [selectedServer, setSelectedServer] = React.useState<string>('emailbison');

  const handleStartTrial = () => {
    onStartTrial(selectedServer);
  };

  const selectedServerData = AVAILABLE_SERVERS.find(s => s.id === selectedServer);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold terminal-text flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            START 7-DAY FREE TRIAL
          </DialogTitle>
          <DialogDescription className="font-mono">
            {'>'} Choose your MCP server and begin your free trial experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Trial Highlights */}
          <Alert className="border-green-500/20 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="font-mono">
              <strong className="text-green-700 dark:text-green-300">FREE 7-DAY TRIAL INCLUDES:</strong>
              <br />
              {'>'} Full access to all premium features
              <br />
              {'>'} No limitations or restrictions
              <br />
              {'>'} Priority support and guidance
              <br />
              {'>'} No credit card required
            </AlertDescription>
          </Alert>

          {/* Server Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold terminal-text">SELECT MCP SERVER</h3>
            
            <div className="grid gap-4">
              {AVAILABLE_SERVERS.map((server) => (
                <Card 
                  key={server.id}
                  className={`cursor-pointer transition-all card-terminal ${
                    selectedServer === server.id 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedServer(server.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded border bg-muted/50">
                          {server.icon}
                        </div>
                        <div>
                          <CardTitle className="terminal-text">{server.name}</CardTitle>
                          <CardDescription className="font-mono">
                            {server.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={selectedServer === server.id ? 'default' : 'outline'}>
                          {selectedServer === server.id ? 'Selected' : 'Available'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {server.category}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Features */}
                      <div>
                        <h4 className="font-medium terminal-text mb-2">FEATURES:</h4>
                        <div className="space-y-1">
                          {server.features.map((feature, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="font-mono">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Trial Benefits */}
                      <div>
                        <h4 className="font-medium terminal-text mb-2">TRIAL BENEFITS:</h4>
                        <div className="space-y-1">
                          {server.trialBenefits.slice(0, 3).map((benefit, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <Star className="h-3 w-3 text-amber-500" />
                              <span className="font-mono">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between text-sm font-mono">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>7-day free trial</span>
                        </div>
                        {/* <span className="text-muted-foreground">{server.estimatedCost}</span> */}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Coming Soon Placeholder */}
            <Card className="card-terminal border-dashed border-2 opacity-60">
              <CardContent className="text-center py-8">
                <div className="space-y-2">
                  <h4 className="font-semibold terminal-text text-muted-foreground">MORE SERVERS COMING SOON</h4>
                  <p className="text-sm text-muted-foreground font-mono">
                    {'>'} Additional MCP server templates in development
                    <br />
                    {'>'} Custom server deployment options
                    <br />
                    {'>'} Enterprise integration packages
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Server Details */}
          {selectedServerData && (
            <Card className="card-terminal border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="terminal-text flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  TRIAL SUMMARY
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium terminal-text mb-2">SERVER:</h4>
                    <p className="font-mono text-sm">{selectedServerData.name}</p>
                  </div>
                  <div>
                    <h4 className="font-medium terminal-text mb-2">TRIAL DURATION:</h4>
                    <p className="font-mono text-sm">7 days (168 hours)</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium terminal-text mb-2">WHAT YOU GET:</h4>
                  <div className="grid md:grid-cols-2 gap-2">
                    {selectedServerData.trialBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Star className="h-3 w-3 text-amber-500" />
                        <span className="font-mono">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="font-mono text-sm">
                    {'>'} No credit card required to start your trial
                    <br />
                    {'>'} You'll need to complete a brief qualification form
                    <br />
                    {'>'} Most applications are approved automatically
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              [CANCEL]
            </Button>
            <Button
              onClick={handleStartTrial}
              disabled={isLoading || !selectedServer}
              className="gap-2 btn-terminal"
              size="lg"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  [STARTING TRIAL...]
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  [START 7-DAY FREE TRIAL]
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
