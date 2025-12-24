// TypeScript types based on OpenAPI spec

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AgencyStatus = 'active' | 'suspended' | 'disconnected';

export interface Agency {
  id: string;
  name: string;
  ghlLocationId: string;
  email: string;
  connectedAt: string;
  status: AgencyStatus;
}

export interface AgencySettings {
  autoProvisioningEnabled: boolean;
  defaultSnapshotId?: string;
  notificationEmail?: string;
  webhookUrl?: string;
}

export interface AgencyStatistics {
  totalSubAccounts: number;
  activeProvisioningJobs: number;
  failedJobsLast30Days: number;
  lastProvisionedAt?: string;
}

export interface AgencyDetails extends Agency {
  settings: AgencySettings;
  statistics: AgencyStatistics;
  ghlTokens: {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt?: string;
  };
}

export interface ProvisionJob {
  id: string;
  agencyId: string;
  status: JobStatus;
  progress: number;
  subAccountId?: string | null;
  snapshotId: string;
  snapshotName: string;
  businessName: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  error?: string | null;
}

export interface TimelineEvent {
  timestamp: string;
  step: string;
  status: 'started' | 'completed' | 'failed';
  message: string;
  details?: Record<string, any>;
}

export interface ProvisionJobDetails extends ProvisionJob {
  intakeData: Record<string, any>;
  mappedCustomValues?: Record<string, any>;
  timeline: TimelineEvent[];
  retryCount: number;
  canRetry: boolean;
}

export interface Snapshot {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  features: string[];
  customFieldsCount: number;
  thumbnailUrl?: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface SnapshotRecommendation {
  snapshotId: string;
  snapshotName: string;
  rank: number;
  confidenceScore: number;
  reasoning: string;
  matchedFeatures: string[];
  snapshot: Snapshot;
}

export interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface JobsSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface ProvisionRequest {
  agencyId: string;
  intakeData: Record<string, any>;
  snapshotId?: string;
  customValues?: Record<string, any>;
  options?: {
    useAISnapshotSelection?: boolean;
    useAICustomValueMapping?: boolean;
    sendWelcomeEmail?: boolean;
    webhookUrl?: string;
  };
}

export interface SSEEvent {
  event: string;
  id: string;
  data: any;
}

export interface SSEJobStatusData {
  id: string;
  status: JobStatus;
  progress: number;
  timestamp: string;
}

export interface SSEStepUpdateData {
  step: string;
  status: 'started' | 'completed' | 'failed';
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface SSEErrorData {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  successRate: number;
  recentActivity: ProvisionJob[];
}
