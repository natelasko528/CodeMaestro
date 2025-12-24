'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Link as LinkIcon, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ConnectPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'expired'>('disconnected');
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsConnecting(true);

    try {
      // Call API to initiate OAuth flow
      const response = await fetch('/api/auth/ghl/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirectUri: `${window.location.origin}/connect/callback`,
          state: crypto.randomUUID(),
        }),
      });

      if (!response.ok) throw new Error('Failed to initiate OAuth flow');

      const data = await response.json();

      // Redirect to GHL OAuth page
      window.location.href = data.authUrl;
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: 'Unable to connect to GoHighLevel. Please try again.',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Connect GoHighLevel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect your GHL account to enable automated sub-account provisioning
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <LinkIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>OAuth Connection</CardTitle>
                <CardDescription>Secure authentication with GoHighLevel</CardDescription>
              </div>
            </div>
            {connectionStatus === 'connected' && (
              <Badge variant="success">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Connected
              </Badge>
            )}
            {connectionStatus === 'expired' && (
              <Badge variant="warning">
                <AlertCircle className="mr-1 h-3 w-3" />
                Token Expired
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {connectionStatus === 'disconnected' && (
            <>
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">What you'll authorize:</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
                    <span className="text-sm text-gray-700">
                      Read access to your snapshots and templates
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
                    <span className="text-sm text-gray-700">
                      Permission to create and manage sub-accounts
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
                    <span className="text-sm text-gray-700">
                      Access to custom field definitions
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
                    <span className="text-sm text-gray-700">
                      Ability to apply snapshots to new accounts
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Your credentials are never stored. We use OAuth 2.0 for
                  secure authentication. You can revoke access at any time from your GHL account
                  settings.
                </p>
              </div>

              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full"
                size="lg"
              >
                {isConnecting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Connect GoHighLevel Account
                  </>
                )}
              </Button>
            </>
          )}

          {connectionStatus === 'connected' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Successfully connected!</span>
              </div>
              <p className="text-sm text-gray-600">
                Your GoHighLevel account is connected and ready to use. You can now create
                provisioning jobs and manage sub-accounts.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1">
                  Disconnect
                </Button>
                <Button className="flex-1" asChild>
                  <a href="/dashboard">Go to Dashboard</a>
                </Button>
              </div>
            </div>
          )}

          {connectionStatus === 'expired' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-warning">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Connection expired</span>
              </div>
              <p className="text-sm text-gray-600">
                Your OAuth token has expired. Please reconnect to continue using the service.
              </p>
              <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
                {isConnecting ? 'Reconnecting...' : 'Reconnect Account'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security & Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            We take security seriously. Your OAuth tokens are encrypted and stored securely.
            We only request the minimum permissions necessary to provide the service.
          </p>
          <p>
            You maintain full control over your GHL account and can revoke access at any time
            from your GoHighLevel account settings or from the Settings page in this application.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
