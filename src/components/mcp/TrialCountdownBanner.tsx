'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  X, 
  ArrowRight, 
  Zap, 
  Star, 
  AlertTriangle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { 
  TrialCountdownBannerProps,
  TrialCountdownBannerState
} from '@/contracts/component-contracts';
import { useTrialCountdown, getUrgencyColor } from '@/hooks/trial';

export function TrialCountdownBanner({
  trial,
  onDismiss,
  onUpgrade,
  onExtend,
  className = ''
}: TrialCountdownBannerProps) {
  const [state, setState] = React.useState<TrialCountdownBannerState>({
    isDismissed: false,
    timeRemaining: { days: 0, hours: 0, minutes: 0 }
  });

  const countdown = useTrialCountdown(trial);

  // Don't show banner if dismissed or trial is not active
  if (state.isDismissed || !trial || trial.status !== 'active') {
    return null;
  }

  const handleDismiss = () => {
    setState(prev => ({ ...prev, isDismissed: true }));
    onDismiss?.();
  };

  const handleUpgrade = () => {
    if (trial.conversion_url) {
      window.open(trial.conversion_url, '_blank');
    }
    onUpgrade?.();
  };

  const handleExtend = () => {
    onExtend?.();
  };

  const getUrgencyIcon = () => {
    switch (countdown.urgencyLevel) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 animate-pulse" />;
      case 'high':
        return <Clock className="h-4 w-4" />;
      case 'medium':
        return <Zap className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getUrgencyMessage = () => {
    if (countdown.isExpired) {
      return 'Your trial has expired. Upgrade now to continue using EmailBison MCP Server.';
    }

    switch (countdown.urgencyLevel) {
      case 'critical':
        return 'Your trial expires in less than 24 hours! Upgrade now to avoid service interruption.';
      case 'high':
        return 'Your trial is expiring soon. Upgrade now to ensure continuous access.';
      case 'medium':
        return 'Your trial is halfway through. Consider upgrading to unlock full features.';
      default:
        return 'You\'re currently on a free trial. Upgrade anytime for unlimited access.';
    }
  };

  const getBenefitsList = () => {
    const benefits = trial.benefits.slice(0, 3); // Show top 3 benefits
    return benefits.map((benefit, index) => (
      <div key={index} className="flex items-center gap-1 text-xs">
        <Star className="h-3 w-3 text-amber-500" />
        <span>{benefit}</span>
      </div>
    ));
  };

  return (
    <div className={`relative ${className}`}>
      <Alert className={`border-2 ${getUrgencyColor(countdown.urgencyLevel)} animate-in slide-in-from-top-2 duration-500`}>
        <div className="flex items-center justify-between w-full">
          {/* Left Section - Status and Countdown */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getUrgencyIcon()}
              <Badge 
                variant="outline" 
                className={`font-mono ${getUrgencyColor(countdown.urgencyLevel)}`}
              >
                TRIAL ACTIVE
              </Badge>
            </div>
            
            <div className="hidden sm:block h-4 w-px bg-border" />
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm font-medium">
                {countdown.formatTimeRemaining()}
              </span>
            </div>
          </div>

          {/* Center Section - Message and Benefits (hidden on mobile) */}
          <div className="hidden lg:flex items-center gap-4 flex-1 mx-6">
            <div className="text-sm">
              {getUrgencyMessage()}
            </div>
            
            <div className="hidden xl:flex items-center gap-3">
              {getBenefitsList()}
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2">
            {countdown.urgencyLevel === 'critical' || countdown.isExpired ? (
              <Button
                size="sm"
                onClick={handleUpgrade}
                className="gap-2 btn-terminal bg-red-600 hover:bg-red-700"
              >
                <Zap className="h-3 w-3" />
                [UPGRADE NOW]
              </Button>
            ) : (
              <>
                {countdown.urgencyLevel !== 'low' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExtend}
                    className="gap-2 hidden sm:flex"
                  >
                    [EXTEND TRIAL]
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleUpgrade}
                  className="gap-2 btn-terminal"
                >
                  <ArrowRight className="h-3 w-3" />
                  [UPGRADE]
                </Button>
              </>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile-only expanded info */}
        <div className="lg:hidden mt-3 pt-3 border-t border-border">
          <AlertDescription className="text-xs font-mono mb-2">
            {getUrgencyMessage()}
          </AlertDescription>
          
          <div className="flex flex-wrap gap-2">
            {getBenefitsList()}
          </div>
        </div>
      </Alert>

      {/* Pulsing border for critical urgency */}
      {countdown.urgencyLevel === 'critical' && (
        <div className="absolute inset-0 border-2 border-red-500 rounded-lg animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

// ============================================================================
// TRIAL COUNTDOWN BANNER VARIANTS
// ============================================================================

interface CompactTrialBannerProps {
  trial: TrialCountdownBannerProps['trial'];
  onUpgrade?: () => void;
  className?: string;
}

export function CompactTrialBanner({ 
  trial, 
  onUpgrade, 
  className = '' 
}: CompactTrialBannerProps) {
  const countdown = useTrialCountdown(trial);

  if (!trial || trial.status !== 'active') {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 p-2 rounded border ${getUrgencyColor(countdown.urgencyLevel)} ${className}`}>
      <Clock className="h-3 w-3" />
      <span className="text-xs font-mono">
        Trial: {countdown.formatTimeRemaining()}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onUpgrade}
        className="h-6 px-2 text-xs"
      >
        Upgrade
      </Button>
    </div>
  );
}

interface TrialStatusIndicatorProps {
  trial: TrialCountdownBannerProps['trial'];
  showDetails?: boolean;
  className?: string;
}

export function TrialStatusIndicator({ 
  trial, 
  showDetails = false, 
  className = '' 
}: TrialStatusIndicatorProps) {
  const countdown = useTrialCountdown(trial);

  if (!trial) {
    return null;
  }

  const getStatusColor = () => {
    switch (trial.status) {
      case 'active':
        return countdown.urgencyLevel === 'critical' ? 'text-red-500' : 'text-green-500';
      case 'expired':
        return 'text-red-500';
      case 'pending':
        return 'text-amber-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusText = () => {
    switch (trial.status) {
      case 'active':
        return showDetails ? countdown.formatTimeRemaining() : 'Active';
      case 'expired':
        return 'Expired';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`h-2 w-2 rounded-full ${getStatusColor().replace('text-', 'bg-')}`} />
      <span className={`text-sm font-mono ${getStatusColor()}`}>
        {getStatusText()}
      </span>
    </div>
  );
}
