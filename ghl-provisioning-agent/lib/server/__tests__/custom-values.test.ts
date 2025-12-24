import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CustomValueService, CustomField } from '../custom-values';
import prisma from '../db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock OpenAI API
const openaiHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as any;
    const messages = body.messages;
    const userMessage = messages.find((m: any) => m.role === 'user')?.content || '';

    // Parse intake data from the prompt
    const intakeMatch = userMessage.match(/Client Intake Data:\n({[\s\S]*?})\n\nCustom Fields:/);
    const intakeData = intakeMatch ? JSON.parse(intakeMatch[1]) : {};

    // Parse custom fields from the prompt
    const fieldMatches = userMessage.matchAll(/ID: (cf_\w+)\n\s+Name: ([\w\s]+)\n\s+Type: (\w+)/g);
    const customFields: RegExpMatchArray[] = Array.from(fieldMatches);

    // Generate mappings based on field names and intake data
    const mappings = customFields
      .map((match) => {
        const fieldId = match[1] as string;
        const fieldName = match[2] as string;
        const fieldType = match[3] as string;

        // Try to find matching intake field
        const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '_');
        const matchingIntakeKey = Object.keys(intakeData).find(
          (key) =>
            key.toLowerCase() === normalizedFieldName ||
            key.toLowerCase().includes(normalizedFieldName.split('_')[0])
        );

        if (matchingIntakeKey) {
          return {
            sourceField: matchingIntakeKey,
            targetField: fieldId,
            value: intakeData[matchingIntakeKey],
            transformation: 'direct_mapping',
            confidence: 0.95,
          };
        }

        return null;
      })
      .filter((m) => m !== null);

    return HttpResponse.json({
      id: 'chatcmpl-test-cv',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({ mappings }),
          },
          finish_reason: 'stop',
        },
      ],
    });
  }),
];

const server = setupServer(...openaiHandlers);

describe('CustomValueService', () => {
  let service: CustomValueService;
  let testAgencyId: string;

  beforeEach(async () => {
    server.listen({ onUnhandledRequest: 'error' });
    service = new CustomValueService();

    // Create test agency
    const agency = await prisma.agency.create({
      data: {
        name: 'Test Agency',
        ghlAgencyId: 'test-ghl-cv',
        oauthAccessTokenEncrypted: 'encrypted_test_token',
        oauthRefreshTokenEncrypted: 'encrypted_test_refresh',
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    testAgencyId = agency.id;
  });

  afterEach(async () => {
    server.resetHandlers();
    server.close();

    await prisma.provisioningLog.deleteMany({});
    await prisma.snapshot.deleteMany({});
    await prisma.agency.deleteMany({});
  });

  describe('mapCustomValues', () => {
    it('should map intake data to custom fields using AI', async () => {
      const intakeData = {
        businessName: 'Acme Corp',
        contactEmail: 'contact@acme.com',
        phoneNumber: '+1-555-0123',
        monthlyBudget: '$5,000',
      };

      const customFields: CustomField[] = [
        {
          fieldId: 'cf_business_name',
          fieldName: 'Business Name',
          fieldType: 'text',
          required: true,
        },
        {
          fieldId: 'cf_email',
          fieldName: 'Contact Email',
          fieldType: 'email',
          required: true,
        },
        {
          fieldId: 'cf_phone',
          fieldName: 'Phone Number',
          fieldType: 'phone',
          required: false,
        },
        {
          fieldId: 'cf_budget',
          fieldName: 'Monthly Budget',
          fieldType: 'number',
          required: false,
        },
      ];

      const result = await service.mapCustomValues(intakeData, customFields);

      expect(result.mappedValues).toBeTruthy();
      expect(Object.keys(result.mappedValues).length).toBeGreaterThan(0);
      expect(result.mappingDetails).toBeTruthy();
      expect(result.mappingDetails.length).toBeGreaterThan(0);

      // Verify mapping details have required fields
      result.mappingDetails.forEach((mapping) => {
        expect(mapping.sourceField).toBeTruthy();
        expect(mapping.targetField).toBeTruthy();
        expect(mapping.confidence).toBeGreaterThan(0);
        expect(mapping.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should handle empty custom fields array', async () => {
      const result = await service.mapCustomValues(
        { businessName: 'Test' },
        []
      );

      expect(result.mappedValues).toEqual({});
      expect(result.mappingDetails).toEqual([]);
      expect(result.unmappedFields).toEqual(['businessName']);
      expect(result.missingRequiredFields).toEqual([]);
    });

    it('should identify unmapped intake fields', async () => {
      const intakeData = {
        businessName: 'Test Corp',
        unknownField1: 'value1',
        unknownField2: 'value2',
      };

      const customFields: CustomField[] = [
        {
          fieldId: 'cf_business_name',
          fieldName: 'Business Name',
          fieldType: 'text',
          required: true,
        },
      ];

      const result = await service.mapCustomValues(intakeData, customFields);

      expect(result.unmappedFields).toContain('unknownField1');
      expect(result.unmappedFields).toContain('unknownField2');
    });

    it('should identify missing required fields', async () => {
      const intakeData = {
        businessName: 'Test Corp',
      };

      const customFields: CustomField[] = [
        {
          fieldId: 'cf_business_name',
          fieldName: 'Business Name',
          fieldType: 'text',
          required: true,
        },
        {
          fieldId: 'cf_email',
          fieldName: 'Email',
          fieldType: 'email',
          required: true,
        },
        {
          fieldId: 'cf_optional',
          fieldName: 'Optional Field',
          fieldType: 'text',
          required: false,
        },
      ];

      const result = await service.mapCustomValues(intakeData, customFields);

      // cf_email should be in missing required fields
      expect(result.missingRequiredFields).toContain('cf_email');
      // cf_optional should NOT be in missing required fields
      expect(result.missingRequiredFields).not.toContain('cf_optional');
    });

    it('should transform phone numbers correctly', async () => {
      const intakeData = {
        phone: '+1 (555) 123-4567',
      };

      const customFields: CustomField[] = [
        {
          fieldId: 'cf_phone',
          fieldName: 'Phone',
          fieldType: 'phone',
          required: false,
        },
      ];

      const result = await service.mapCustomValues(intakeData, customFields);

      // Phone should be cleaned to contain only digits and +
      const mappedPhone = result.mappedValues['cf_phone'];
      expect(mappedPhone).toBeTruthy();
      expect(mappedPhone).toMatch(/^\+?[0-9]+$/);
    });

    it('should transform numbers correctly', async () => {
      const intakeData = {
        budget: '$5,000.50',
      };

      const customFields: CustomField[] = [
        {
          fieldId: 'cf_budget',
          fieldName: 'Budget',
          fieldType: 'number',
          required: false,
        },
      ];

      const result = await service.mapCustomValues(intakeData, customFields);

      const mappedBudget = result.mappedValues['cf_budget'];
      expect(typeof mappedBudget).toBe('number');
      expect(mappedBudget).toBe(5000.50);
    });

    it('should handle checkbox fields correctly', async () => {
      const intakeData = {
        acceptTerms: 'yes',
        newsletter: true,
        marketing: 'false',
      };

      const customFields: CustomField[] = [
        {
          fieldId: 'cf_terms',
          fieldName: 'Accept Terms',
          fieldType: 'checkbox',
          required: false,
        },
        {
          fieldId: 'cf_newsletter',
          fieldName: 'Newsletter',
          fieldType: 'checkbox',
          required: false,
        },
        {
          fieldId: 'cf_marketing',
          fieldName: 'Marketing',
          fieldType: 'checkbox',
          required: false,
        },
      ];

      const result = await service.mapCustomValues(intakeData, customFields);

      expect(result.mappedValues['cf_terms']).toBe(true);
      expect(result.mappedValues['cf_newsletter']).toBe(true);
      expect(result.mappedValues['cf_marketing']).toBe(false);
    });

    it('should handle dropdown fields with options', async () => {
      const intakeData = {
        propertyType: 'residential',
      };

      const customFields: CustomField[] = [
        {
          fieldId: 'cf_property_type',
          fieldName: 'Property Type',
          fieldType: 'dropdown',
          required: false,
          options: ['Residential', 'Commercial', 'Industrial'],
        },
      ];

      const result = await service.mapCustomValues(intakeData, customFields);

      // Should match option with case-insensitive comparison
      expect(result.mappedValues['cf_property_type']).toBe('Residential');
    });

    it('should fallback gracefully on OpenAI error', async () => {
      // Override handler to return error
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json(
            { error: { message: 'API error' } },
            { status: 500 }
          );
        })
      );

      const intakeData = {
        businessName: 'Test Corp',
      };

      const customFields: CustomField[] = [
        {
          fieldId: 'cf_business_name',
          fieldName: 'businessName',
          fieldType: 'text',
          required: true,
        },
      ];

      const result = await service.mapCustomValues(intakeData, customFields);

      // Should use fallback exact-match mapping
      expect(result.mappedValues).toBeTruthy();
      expect(result.mappingDetails[0]?.transformation).toBe('exact_match');
    });
  });

  describe('extractCustomFields', () => {
    it('should extract custom fields for a real estate snapshot', async () => {
      const snapshot = await prisma.snapshot.create({
        data: {
          agencyId: testAgencyId,
          ghlSnapshotId: 'snapshot-re-001',
          name: 'Real Estate Pro',
          niche: 'Real Estate',
          isActive: true,
        },
      });

      const customFields = await service.extractCustomFields(snapshot.id, testAgencyId);

      expect(customFields.length).toBeGreaterThan(0);
      expect(customFields.some((f) => f.fieldName === 'Business Name')).toBe(true);
      expect(customFields.some((f) => f.fieldType === 'phone')).toBe(true);
    });

    it('should extract generic custom fields for non-real estate snapshot', async () => {
      const snapshot = await prisma.snapshot.create({
        data: {
          agencyId: testAgencyId,
          ghlSnapshotId: 'snapshot-generic-001',
          name: 'Generic Template',
          niche: 'General',
          isActive: true,
        },
      });

      const customFields = await service.extractCustomFields(snapshot.id, testAgencyId);

      expect(customFields.length).toBeGreaterThan(0);
      expect(customFields.some((f) => f.fieldName === 'Business Name')).toBe(true);
    });

    it('should throw error for non-existent snapshot', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await expect(
        service.extractCustomFields(nonExistentId, testAgencyId)
      ).rejects.toThrow('Snapshot not found or not available');
    });

    it('should throw error for inactive snapshot', async () => {
      const snapshot = await prisma.snapshot.create({
        data: {
          agencyId: testAgencyId,
          ghlSnapshotId: 'snapshot-inactive-001',
          name: 'Inactive Snapshot',
          isActive: false,
        },
      });

      await expect(
        service.extractCustomFields(snapshot.id, testAgencyId)
      ).rejects.toThrow('Snapshot not found or not available');
    });
  });

  describe('Integration tests', () => {
    it('should handle complex real-world intake data', async () => {
      const complexIntake = {
        businessName: 'Luxury Coastal Homes',
        contactName: 'Sarah Johnson',
        email: 'sarah@luxurycoastal.com',
        phone: '+1 (555) 987-6543',
        propertyType: 'Luxury Residential',
        monthlyBudget: '$15,000',
        estimatedLeads: '100',
        website: 'https://luxurycoastal.com',
        companySize: '10-50',
      };

      const customFields: CustomField[] = [
        {
          fieldId: 'cf_business_name',
          fieldName: 'Business Name',
          fieldType: 'text',
          required: true,
        },
        {
          fieldId: 'cf_contact_email',
          fieldName: 'Email',
          fieldType: 'email',
          required: true,
        },
        {
          fieldId: 'cf_phone',
          fieldName: 'Phone',
          fieldType: 'phone',
          required: false,
        },
        {
          fieldId: 'cf_budget',
          fieldName: 'Monthly Budget',
          fieldType: 'number',
          required: false,
        },
        {
          fieldId: 'cf_lead_count',
          fieldName: 'Estimated Leads',
          fieldType: 'number',
          required: false,
        },
      ];

      const result = await service.mapCustomValues(complexIntake, customFields);

      expect(result.mappedValues).toBeTruthy();
      expect(Object.keys(result.mappedValues).length).toBeGreaterThan(0);
      expect(result.missingRequiredFields.length).toBe(0);
    });
  });
});
