import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, XCircle, AlertCircle, Eye } from 'lucide-react';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import type { ProvisionJob } from '@/lib/types';

interface JobStatusCardProps {
  job: ProvisionJob;
  isLink?: boolean;
}

function getStatusIcon(status: ProvisionJob['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-error" />;
    case 'processing':
      return <Clock className="h-5 w-5 text-primary animate-pulse" />;
    case 'pending':
      return <AlertCircle className="h-5 w-5 text-warning" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
}

function getStatusBadgeVariant(status: ProvisionJob['status']): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'processing':
      return 'default';
    case 'pending':
      return 'warning';
    default:
      return 'secondary';
  }
}

export function JobStatusCard({ job, isLink = true }: JobStatusCardProps) {
  const content = (
    <Card className={isLink ? 'transition-shadow hover:shadow-md' : ''}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            {getStatusIcon(job.status)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{job.businessName}</h3>
                <Badge variant={getStatusBadgeVariant(job.status)}>
                  {job.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-600">{job.snapshotName}</p>
              <p className="mt-1 text-xs text-gray-500">
                Created {formatRelativeTime(job.createdAt)}
              </p>
            </div>
          </div>

          {isLink && (
            <Link href={`/jobs/${job.id}`}>
              <Button variant="ghost" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                View
              </Button>
            </Link>
          )}
        </div>

        {(job.status === 'processing' || job.status === 'pending') && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        )}

        {job.status === 'completed' && job.subAccountId && (
          <div className="mt-4 rounded-lg bg-success/10 p-3">
            <p className="text-xs text-success-700">
              <strong>Sub-account ID:</strong> {job.subAccountId}
            </p>
          </div>
        )}

        {job.status === 'failed' && job.error && (
          <div className="mt-4 rounded-lg bg-error/10 p-3">
            <p className="text-xs text-error-700">
              <strong>Error:</strong> {job.error}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLink) {
    return (
      <Link href={`/jobs/${job.id}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
