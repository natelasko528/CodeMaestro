import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OAuthStatus } from '@/components/OAuthStatus';
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  XCircle,
  Plus,
  ListChecks,
} from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';
import type { DashboardStats, ProvisionJob } from '@/lib/types';

// Mock data - replace with actual API call
async function getDashboardStats(): Promise<DashboardStats> {
  return {
    totalJobs: 147,
    activeJobs: 3,
    completedJobs: 142,
    failedJobs: 2,
    successRate: 96.6,
    recentActivity: [
      {
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
      },
      {
        id: 'job_002',
        agencyId: 'agency_123',
        status: 'processing',
        progress: 65,
        snapshotId: 'snap_002',
        snapshotName: 'Automotive CRM',
        businessName: 'Auto Solutions LLC',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: 'job_003',
        agencyId: 'agency_123',
        status: 'pending',
        progress: 0,
        snapshotId: 'snap_003',
        snapshotName: 'Healthcare Template',
        businessName: 'City Dental Care',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    ],
  };
}

function getStatusIcon(status: ProvisionJob['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-error" />;
    case 'processing':
      return <Clock className="h-5 w-5 text-primary animate-pulse" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
}

function getStatusBadgeVariant(status: ProvisionJob['status']) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'processing':
      return 'default';
    default:
      return 'secondary';
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor your provisioning activity and performance
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/jobs">
            <Button variant="outline">
              <ListChecks className="mr-2 h-4 w-4" />
              View All Jobs
            </Button>
          </Link>
          <Link href="/provision">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Provision
            </Button>
          </Link>
        </div>
      </div>

      <OAuthStatus />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <ListChecks className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalJobs}</div>
            <p className="text-xs text-gray-500">All time provisioning jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.activeJobs}</div>
            <p className="text-xs text-gray-500">Currently processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.completedJobs}</div>
            <p className="text-xs text-gray-500">Successfully provisioned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.successRate}%</div>
            <p className="text-xs text-gray-500">
              {stats.failedJobs} failed jobs
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest provisioning jobs and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentActivity.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium text-gray-900">{job.businessName}</p>
                      <p className="text-sm text-gray-500">{job.snapshotName}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={getStatusBadgeVariant(job.status)}>
                      {job.status}
                    </Badge>
                    <p className="text-xs text-gray-500">
                      {formatRelativeTime(job.createdAt)}
                    </p>
                  </div>
                </div>
                {job.status === 'processing' && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{job.progress}% complete</p>
                  </div>
                )}
              </Link>
            ))}
          </div>
          {stats.recentActivity.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">No recent activity</p>
              <Link href="/provision" className="mt-2 inline-block">
                <Button size="sm">Create your first provision</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
