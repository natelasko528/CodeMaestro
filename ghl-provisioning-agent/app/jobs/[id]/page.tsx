import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LiveLogViewer } from '@/components/LiveLogViewer';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import type { ProvisionJobDetails } from '@/lib/types';

interface JobDetailPageProps {
  params: {
    id: string;
  };
}

// Mock data - replace with actual API call
async function getJobDetails(id: string): Promise<ProvisionJobDetails | null> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const mockJobs: Record<string, ProvisionJobDetails> = {
    job_001: {
      id: 'job_001',
      agencyId: 'agency_123',
      status: 'completed',
      progress: 100,
      snapshotId: 'snap_001',
      snapshotName: 'Real Estate Pro',
      businessName: 'Sunset Realty',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      subAccountId: 'sub_001',
      intakeData: {
        businessName: 'Sunset Realty',
        contactName: 'John Smith',
        email: 'john@sunsetrealty.com',
        phone: '+1-555-123-4567',
        industry: 'Real Estate',
      },
      mappedCustomValues: {
        business_name: 'Sunset Realty',
        contact_email: 'john@sunsetrealty.com',
        phone_number: '+15551234567',
        industry_type: 'Real Estate',
      },
      timeline: [
        {
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          step: 'validation',
          status: 'completed',
          message: 'Intake data validated successfully',
        },
        {
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30000).toISOString(),
          step: 'snapshot_selection',
          status: 'completed',
          message: 'AI selected snapshot "Real Estate Pro" with 95% confidence',
          details: { confidenceScore: 0.95 },
        },
        {
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 60000).toISOString(),
          step: 'custom_value_mapping',
          status: 'completed',
          message: 'Mapped 4 custom fields successfully',
        },
        {
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 90000).toISOString(),
          step: 'account_creation',
          status: 'completed',
          message: 'Sub-account created successfully',
          details: { subAccountId: 'sub_001' },
        },
        {
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          step: 'snapshot_application',
          status: 'completed',
          message: 'Snapshot applied to sub-account',
        },
      ],
      retryCount: 0,
      canRetry: false,
    },
    job_002: {
      id: 'job_002',
      agencyId: 'agency_123',
      status: 'processing',
      progress: 65,
      snapshotId: 'snap_002',
      snapshotName: 'Automotive CRM',
      businessName: 'Auto Solutions LLC',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      intakeData: {
        businessName: 'Auto Solutions LLC',
        email: 'info@autosolutions.com',
      },
      timeline: [
        {
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          step: 'validation',
          status: 'completed',
          message: 'Intake data validated successfully',
        },
        {
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          step: 'snapshot_selection',
          status: 'completed',
          message: 'Using pre-selected snapshot "Automotive CRM"',
        },
      ],
      retryCount: 0,
      canRetry: true,
    },
  };

  return mockJobs[id] || null;
}

function getStatusIcon(status: ProvisionJobDetails['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-6 w-6 text-success" />;
    case 'failed':
      return <XCircle className="h-6 w-6 text-error" />;
    case 'processing':
      return <Clock className="h-6 w-6 text-primary animate-pulse" />;
    case 'pending':
      return <AlertCircle className="h-6 w-6 text-warning" />;
    default:
      return <Clock className="h-6 w-6 text-gray-400" />;
  }
}

function getStatusBadgeVariant(status: ProvisionJobDetails['status']): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
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

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const job = await getJobDetails(params.id);

  if (!job) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/jobs">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              {getStatusIcon(job.status)}
              <h1 className="text-3xl font-bold text-gray-900">{job.businessName}</h1>
              <Badge variant={getStatusBadgeVariant(job.status)}>
                {job.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Job ID: {job.id} • Created {formatRelativeTime(job.createdAt)}
            </p>
          </div>
        </div>

        {job.canRetry && job.status === 'failed' && (
          <Button>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Job
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Business Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{job.businessName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Snapshot</dt>
                  <dd className="mt-1 text-sm text-gray-900">{job.snapshotName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm">
                    <Badge variant={getStatusBadgeVariant(job.status)}>
                      {job.status}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Progress</dt>
                  <dd className="mt-1 text-sm text-gray-900">{job.progress}%</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDateTime(job.createdAt)}
                  </dd>
                </div>
                {job.completedAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Completed</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDateTime(job.completedAt)}
                    </dd>
                  </div>
                )}
                {job.subAccountId && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Sub-account ID</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm text-gray-900">
                      <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs">
                        {job.subAccountId}
                      </code>
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`https://app.gohighlevel.com/location/${job.subAccountId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Step-by-step execution progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {job.timeline.map((event, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      {event.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : event.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-error" />
                      ) : (
                        <Clock className="h-5 w-5 text-primary animate-pulse" />
                      )}
                      {index < job.timeline.length - 1 && (
                        <div className="h-full w-0.5 bg-gray-200" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-gray-900">
                        {event.step.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">{event.message}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDateTime(event.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {(job.status === 'processing' || job.status === 'pending') && (
            <LiveLogViewer jobId={job.id} />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Intake Data</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {Object.entries(job.intakeData).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs font-medium text-gray-500">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {job.mappedCustomValues && (
            <Card>
              <CardHeader>
                <CardTitle>Custom Values</CardTitle>
                <CardDescription>AI-mapped field values</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {Object.entries(job.mappedCustomValues).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-medium text-gray-500">{key}</dt>
                      <dd className="mt-1 text-sm text-gray-900">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
