import { ProvisioningForm } from '@/components/ProvisioningForm';
import type { Snapshot } from '@/lib/types';

// Mock data - replace with actual API call
async function getSnapshots(): Promise<Snapshot[]> {
  return [
    {
      id: 'snap_001',
      name: 'Real Estate Pro',
      description: 'Complete CRM setup for real estate agencies',
      category: 'real-estate',
      tags: ['real-estate', 'crm', 'automation'],
      features: ['Pre-built funnels', 'Email templates', 'SMS campaigns'],
      customFieldsCount: 25,
      isPublic: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 127,
    },
    {
      id: 'snap_002',
      name: 'Automotive CRM',
      description: 'Dealership and automotive service CRM',
      category: 'automotive',
      tags: ['automotive', 'crm', 'sales'],
      features: ['Lead tracking', 'Service scheduling', 'Follow-up automation'],
      customFieldsCount: 18,
      isPublic: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 84,
    },
    {
      id: 'snap_003',
      name: 'Healthcare Template',
      description: 'Patient management and appointment scheduling',
      category: 'healthcare',
      tags: ['healthcare', 'appointments', 'patient-care'],
      features: ['Appointment reminders', 'Patient intake forms', 'HIPAA compliant'],
      customFieldsCount: 22,
      isPublic: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 63,
    },
  ];
}

export default async function ProvisionPage() {
  const snapshots = await getSnapshots();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">New Provision</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a new GHL sub-account with AI-powered configuration
        </p>
      </div>

      <ProvisioningForm snapshots={snapshots} />
    </div>
  );
}
