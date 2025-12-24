'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OAuthStatus } from '@/components/OAuthStatus';
import { useToast } from '@/hooks/use-toast';
import { Save, Trash2, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState({
    agencyName: 'Acme Marketing Agency',
    notificationEmail: 'admin@acmeagency.com',
    webhookUrl: 'https://acmeagency.com/webhook',
    defaultSnapshotId: 'snap_001',
    autoProvisioningEnabled: true,
  });

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast({
        title: 'Settings saved',
        description: 'Your settings have been updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'Unable to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your GHL account?')) {
      return;
    }

    try {
      toast({
        title: 'Account disconnected',
        description: 'Your GHL account has been disconnected',
      });
    } catch (error) {
      toast({
        title: 'Disconnect failed',
        description: 'Unable to disconnect account. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your agency settings and preferences
        </p>
      </div>

      <OAuthStatus />

      <Card>
        <CardHeader>
          <CardTitle>Agency Settings</CardTitle>
          <CardDescription>Basic information about your agency</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agencyName">Agency Name</Label>
            <Input
              id="agencyName"
              value={settings.agencyName}
              onChange={(e) => setSettings({ ...settings, agencyName: e.target.value })}
              placeholder="Your Agency Name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notificationEmail">Notification Email</Label>
            <Input
              id="notificationEmail"
              type="email"
              value={settings.notificationEmail}
              onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
              placeholder="notifications@agency.com"
            />
            <p className="text-xs text-gray-500">
              Receive notifications about provisioning jobs and system updates
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
            <Input
              id="webhookUrl"
              type="url"
              value={settings.webhookUrl}
              onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
              placeholder="https://your-domain.com/webhook"
            />
            <p className="text-xs text-gray-500">
              Receive webhook notifications when provisioning jobs complete
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provisioning Defaults</CardTitle>
          <CardDescription>Default settings for new provisioning jobs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultSnapshot">Default Snapshot</Label>
            <Select
              value={settings.defaultSnapshotId}
              onValueChange={(value) => setSettings({ ...settings, defaultSnapshotId: value })}
            >
              <SelectTrigger id="defaultSnapshot">
                <SelectValue placeholder="Select default snapshot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="snap_001">Real Estate Pro</SelectItem>
                <SelectItem value="snap_002">Automotive CRM</SelectItem>
                <SelectItem value="snap_003">Healthcare Template</SelectItem>
                <SelectItem value="snap_004">Legal Services</SelectItem>
                <SelectItem value="snap_005">Fitness & Wellness</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              This snapshot will be suggested by default when creating new provisions
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <p className="font-medium text-gray-900">AI Snapshot Selection</p>
              <p className="text-sm text-gray-500">
                Automatically select the best snapshot based on business data
              </p>
            </div>
            <Button
              variant={settings.autoProvisioningEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setSettings({
                  ...settings,
                  autoProvisioningEnabled: !settings.autoProvisioningEnabled,
                })
              }
            >
              {settings.autoProvisioningEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Integration</CardTitle>
          <CardDescription>Manage your API access and integration settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>API Base URL</Label>
            <div className="mt-2 rounded-lg bg-gray-50 p-3">
              <code className="text-sm text-gray-700">
                {process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api'}
              </code>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> API authentication is managed through your GHL OAuth
              connection. Ensure your connection is active for API access.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-error">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <p className="font-medium text-gray-900">Disconnect GHL Account</p>
              <p className="text-sm text-gray-500">
                Remove OAuth connection and stop all provisioning
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <p className="font-medium text-gray-900">Reset All Settings</p>
              <p className="text-sm text-gray-500">
                Restore all settings to their default values
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('Are you sure you want to reset all settings?')) {
                  toast({
                    title: 'Settings reset',
                    description: 'All settings have been restored to defaults',
                  });
                }
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline">Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
