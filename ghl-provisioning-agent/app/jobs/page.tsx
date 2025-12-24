import { Suspense } from 'react';
import { JobStatusCard } from '@/components/JobStatusCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import type { ProvisionJob, JobsSummary } from '@/lib/types';

interface JobsPageProps {
  searchParams: {
    page?: string;
    status?: string;
  };
}

// Mock data - replace with actual API call
async function getJobs(page: number = 1, status?: string): Promise<{
  jobs: ProvisionJob[];
  summary: JobsSummary;
  totalPages: number;
}> {
  const allJobs: ProvisionJob[] = [
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
      subAccountId: 'sub_001',
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
    {
      id: 'job_004',
      agencyId: 'agency_123',
      status: 'failed',
      progress: 45,
      snapshotId: 'snap_001',
      snapshotName: 'Real Estate Pro',
      businessName: 'Failed Business Inc',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
      error: 'Snapshot application failed: Invalid custom field mapping',
    },
    {
      id: 'job_005',
      agencyId: 'agency_123',
      status: 'completed',
      progress: 100,
      snapshotId: 'snap_002',
      snapshotName: 'Automotive CRM',
      businessName: 'Premium Motors',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(),
      subAccountId: 'sub_002',
    },
  ];

  let filteredJobs = status ? allJobs.filter((job) => job.status === status) : allJobs;

  return {
    jobs: filteredJobs,
    summary: {
      total: allJobs.length,
      pending: allJobs.filter((j) => j.status === 'pending').length,
      processing: allJobs.filter((j) => j.status === 'processing').length,
      completed: allJobs.filter((j) => j.status === 'completed').length,
      failed: allJobs.filter((j) => j.status === 'failed').length,
    },
    totalPages: Math.ceil(filteredJobs.length / 20),
  };
}

function JobsListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  );
}

async function JobsList({ page, status }: { page: number; status?: string }) {
  const { jobs, summary, totalPages } = await getJobs(page, status);

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-warning">{summary.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{summary.processing}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{summary.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-error">{summary.failed}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {jobs.map((job) => (
          <JobStatusCard key={job.id} job={job} />
        ))}
      </div>

      {jobs.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-500">No jobs found</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              asChild={page > 1}
            >
              {page > 1 ? (
                <a href={`/jobs?page=${page - 1}${status ? `&status=${status}` : ''}`}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </a>
              ) : (
                <>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              asChild={page < totalPages}
            >
              {page < totalPages ? (
                <a href={`/jobs?page=${page + 1}${status ? `&status=${status}` : ''}`}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const page = Number(searchParams.page) || 1;
  const status = searchParams.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Provisioning Jobs</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and monitor all provisioning jobs
          </p>
        </div>
      </div>

      <Tabs defaultValue={status || 'all'} className="w-full">
        <TabsList>
          <TabsTrigger value="all" asChild>
            <a href="/jobs">All</a>
          </TabsTrigger>
          <TabsTrigger value="pending" asChild>
            <a href="/jobs?status=pending">Pending</a>
          </TabsTrigger>
          <TabsTrigger value="processing" asChild>
            <a href="/jobs?status=processing">Processing</a>
          </TabsTrigger>
          <TabsTrigger value="completed" asChild>
            <a href="/jobs?status=completed">Completed</a>
          </TabsTrigger>
          <TabsTrigger value="failed" asChild>
            <a href="/jobs?status=failed">Failed</a>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={status || 'all'} className="mt-6">
          <Suspense fallback={<JobsListSkeleton />}>
            <JobsList page={page} status={status} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
