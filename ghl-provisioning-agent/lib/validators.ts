import { z } from 'zod';

/**
 * Validation schemas for API requests using Zod
 * These schemas ensure type-safe validation on both client and server
 */

// Provision request schema
export const provisionRequestSchema = z.object({
  agencyId: z.string().uuid('Agency ID must be a valid UUID'),
  intakeData: z.record(z.any()).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Intake data cannot be empty' }
  ),
  snapshotId: z.string().uuid('Snapshot ID must be a valid UUID').optional(),
  customValues: z.record(z.any()).optional(),
  options: z.object({
    useAISnapshotSelection: z.boolean().default(true),
    useAICustomValueMapping: z.boolean().default(true),
    sendWelcomeEmail: z.boolean().default(true),
    webhookUrl: z.string().url().optional(),
  }).optional(),
});

export type ProvisionRequest = z.infer<typeof provisionRequestSchema>;

// Snapshot selection request schema
export const snapshotSelectRequestSchema = z.object({
  intakeData: z.record(z.any()).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Intake data cannot be empty' }
  ),
  availableSnapshots: z.array(z.string().uuid()).optional(),
});

export type SnapshotSelectRequest = z.infer<typeof snapshotSelectRequestSchema>;

// Custom value mapping request schema
export const customValueMapRequestSchema = z.object({
  intakeData: z.record(z.any()).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Intake data cannot be empty' }
  ),
  snapshotId: z.string().uuid('Snapshot ID must be a valid UUID'),
  customFields: z.array(z.object({
    fieldId: z.string(),
    fieldName: z.string(),
    fieldType: z.enum(['text', 'number', 'date', 'email', 'phone', 'url', 'dropdown', 'checkbox']),
    required: z.boolean(),
  })).optional(),
});

export type CustomValueMapRequest = z.infer<typeof customValueMapRequestSchema>;

// Job query parameters
export const jobListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'RETRYING']).optional(),
  agencyId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;

// API Error response schema
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(z.record(z.any())).optional(),
  timestamp: z.string().datetime().optional(),
  path: z.string().optional(),
});

export type APIError = z.infer<typeof apiErrorSchema>;

/**
 * Helper function to format Zod validation errors
 */
export function formatZodError(error: z.ZodError): APIError {
  return {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request parameters',
    details: error.errors.map((err) => ({
      field: err.path.join('.'),
      error: err.message,
    })),
    timestamp: new Date().toISOString(),
  };
}
