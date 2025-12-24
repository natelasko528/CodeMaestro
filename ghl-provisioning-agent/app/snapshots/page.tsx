import { Button } from '@/components/ui/button';
import { SnapshotSelector } from '@/components/SnapshotSelector';
import { RefreshCw } from 'lucide-react';
import type { Snapshot } from '@/lib/types';

// Mock data - replace with actual API call
async function getSnapshots(): Promise<Snapshot[]> {
  return [
    {
      id: 'snap_001',
      name: 'Real Estate Pro',
      description: 'Complete CRM setup for real estate agencies with automated lead nurturing and property listing management',
      category: 'real-estate',
      tags: ['real-estate', 'crm', 'automation', 'lead-gen'],
      features: [
        'Pre-built funnels',
        'Email templates',
        'SMS campaigns',
        'Custom fields for properties',
        'Lead scoring automation',
      ],
      customFieldsCount: 25,
      isPublic: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      usageCount: 127,
    },
    {
      id: 'snap_002',
      name: 'Automotive CRM',
      description: 'Dealership and automotive service CRM with inventory management and service scheduling',
      category: 'automotive',
      tags: ['automotive', 'crm', 'sales', 'service'],
      features: [
        'Lead tracking',
        'Service scheduling',
        'Follow-up automation',
        'Inventory management',
        'Test drive booking',
      ],
      customFieldsCount: 18,
      isPublic: true,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      usageCount: 84,
    },
    {
      id: 'snap_003',
      name: 'Healthcare Template',
      description: 'Patient management and appointment scheduling for healthcare practices',
      category: 'healthcare',
      tags: ['healthcare', 'appointments', 'patient-care', 'hipaa'],
      features: [
        'Appointment reminders',
        'Patient intake forms',
        'HIPAA compliant',
        'Insurance tracking',
        'Prescription reminders',
      ],
      customFieldsCount: 22,
      isPublic: true,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      usageCount: 63,
    },
    {
      id: 'snap_004',
      name: 'Legal Services',
      description: 'Case management and client communication for law firms',
      category: 'legal',
      tags: ['legal', 'case-management', 'client-portal', 'billing'],
      features: [
        'Case tracking',
        'Document management',
        'Client portal',
        'Time tracking',
        'Billing automation',
      ],
      customFieldsCount: 20,
      isPublic: true,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      usageCount: 45,
    },
    {
      id: 'snap_005',
      name: 'Fitness & Wellness',
      description: 'Member management and class scheduling for fitness centers and wellness studios',
      category: 'fitness',
      tags: ['fitness', 'wellness', 'memberships', 'classes'],
      features: [
        'Class scheduling',
        'Membership management',
        'Workout tracking',
        'Nutrition plans',
        'Progress photos',
      ],
      customFieldsCount: 16,
      isPublic: true,
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      usageCount: 92,
    },
    {
      id: 'snap_006',
      name: 'Restaurant & Hospitality',
      description: 'Reservation management and customer loyalty for restaurants',
      category: 'restaurants',
      tags: ['restaurant', 'hospitality', 'reservations', 'loyalty'],
      features: [
        'Table reservations',
        'Online ordering',
        'Loyalty program',
        'Review management',
        'Menu management',
      ],
      customFieldsCount: 14,
      isPublic: true,
      createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      usageCount: 71,
    },
  ];
}

export default async function SnapshotsPage() {
  const snapshots = await getSnapshots();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Snapshot Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse and search available templates for sub-account provisioning
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync from GHL
        </Button>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          <strong>Tip:</strong> Snapshots are synchronized from your GoHighLevel account.
          Click "Sync from GHL" to fetch the latest templates and updates.
        </p>
      </div>

      <SnapshotSelector snapshots={snapshots} />
    </div>
  );
}
