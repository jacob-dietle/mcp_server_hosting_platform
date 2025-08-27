"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/hooks/core';
import { Info } from 'lucide-react';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  
  // Get the intended redirect destination from URL params safely
  const [redirectTo, setRedirectTo] = useState('/dashboard/command-center');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      if (next) setRedirectTo(next);
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: 'Login Failed',
        description: error.message || 'Please check your credentials and try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!agreeToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account');
      toast({
        title: 'Agreement Required',
        description: 'Please agree to our Terms of Service and Privacy Policy to continue',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
        }
      });
      if (error) {
        throw error;
      } else {
        toast({
          title: 'Check your email',
          description: 'We sent you a confirmation link to complete your registration',
        });
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: 'Signup Failed',
        description: error.message || 'Please check your information and try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
        }
      });
      if (error) {
        throw error;
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: 'Login Failed',
        description: error.message || 'Failed to sign in with Google',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-[400px] space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Sign in or create an account to access MCPGTM</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  
                  {/* Terms of Service Agreement */}
                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id="terms-agreement" 
                        checked={agreeToTerms}
                        onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label 
                          htmlFor="terms-agreement" 
                          className="text-sm font-normal leading-relaxed cursor-pointer"
                        >
                          I agree to the{' '}
                          <Link href="/terms" className="text-primary underline hover:text-primary/80" target="_blank">
                            Terms of Service
                          </Link>{' '}
                          and{' '}
                          <Link href="/privacy" className="text-primary underline hover:text-primary/80" target="_blank">
                            Privacy Policy
                          </Link>
                        </Label>
                      </div>
                    </div>
                    
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs leading-relaxed">
                        We use cookies and analytics (PostHog) to improve your experience, track performance, and provide personalized features. 
                        Your data is processed securely and never shared without consent.{' '}
                        <Link href="/privacy" className="text-primary underline hover:text-primary/80" target="_blank">
                          Learn more
                        </Link>
                      </AlertDescription>
                    </Alert>
                  </div>
                  
                  <Button className="w-full" type="submit" disabled={isLoading || !agreeToTerms}>
                    {isLoading ? 'Creating account...' : 'Sign Up'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="w-full relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <GoogleIcon />
              <span className="ml-2">
                {isLoading ? 'Connecting...' : 'Sign in with Google'}
              </span>
            </Button>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="text-center text-sm text-muted-foreground">
              <Link href="/" className="text-primary hover:underline">
                ← Back to home
              </Link>
            </div>
          </CardFooter>
        </Card>
        
        {/* Legal Agreement Text - Outside the modal */}
        <div className="text-center text-xs text-muted-foreground leading-relaxed px-4">
          <p>
            By signing in or creating an account, you agree to our{' '}
            <Link href="/terms" className="text-primary underline hover:text-primary/80">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary underline hover:text-primary/80">
              Privacy Policy
            </Link>
            . We use cookies and analytics to improve your experience.
          </p>
        </div>
      </div>
    </div>
  );
} 
