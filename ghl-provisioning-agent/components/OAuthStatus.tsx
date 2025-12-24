import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface OAuthStatusProps {
  minimal?: boolean;
}

// This would normally fetch from an API endpoint
async function getConnectionStatus() {
  // Mock data for now - replace with actual API call
  return {
    connected: false,
    email: null,
    expiresAt: null,
    lastSyncedAt: null,
  };
}

export async function OAuthStatus({ minimal = false }: OAuthStatusProps) {
  const status = await getConnectionStatus();

  if (minimal) {
    return (
      <div className="flex items-center gap-2">
        {status.connected ? (
          <>
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm text-gray-600">Connected</span>
          </>
        ) : (
          <>
            <div className="h-2 w-2 rounded-full bg-gray-300" />
            <span className="text-sm text-gray-600">Not connected</span>
          </>
        )}
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <XCircle className="h-5 w-5 text-gray-400" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Not connected</p>
          <p className="text-xs text-gray-500">Connect your GHL account to get started</p>
        </div>
        <Link href="/connect">
          <Button size="sm">Connect</Button>
        </Link>
      </div>
    );
  }

  const expiresAt = status.expiresAt ? new Date(status.expiresAt) : null;
  const isExpiringSoon = expiresAt && expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
      {isExpiringSoon ? (
        <AlertCircle className="h-5 w-5 text-warning" />
      ) : (
        <CheckCircle2 className="h-5 w-5 text-success" />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{status.email}</p>
          <Badge variant={isExpiringSoon ? 'warning' : 'success'}>
            {isExpiringSoon ? 'Expiring soon' : 'Connected'}
          </Badge>
        </div>
        {status.lastSyncedAt && (
          <p className="text-xs text-gray-500">
            Last synced: {new Date(status.lastSyncedAt).toLocaleDateString()}
          </p>
        )}
      </div>
      {isExpiringSoon && (
        <Link href="/connect">
          <Button size="sm" variant="outline">
            Reconnect
          </Button>
        </Link>
      )}
    </div>
  );
}
