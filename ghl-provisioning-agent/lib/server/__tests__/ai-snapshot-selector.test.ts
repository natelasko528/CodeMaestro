import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AISnapshotSelector } from '../ai-snapshot-selector';
import prisma from '../db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock OpenAI API
const openaiHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as any;
    const messages = body.messages;
    const userMessage = messages.find((m: any) => m.role === 'user')?.content || '';

    // Extract snapshot IDs from the user prompt
    const snapshotMatches = userMessage.match(/ID: ([a-f0-9-]+)/g);
    const snapshotIds = snapshotMatches
      ? snapshotMatches.map((m: string) => m.replace('ID: ', ''))
      : [];

    // Mock AI response with realistic recommendations
    const recommendations = snapshotIds.slice(0, 3).map((id: string, index: number) => ({
      snapshotId: id,
      confidenceScore: 0.9 - (index * 0.1),
      reasoning: `This snapshot is well-suited for the client's ${
        userMessage.includes('Real Estate') ? 'real estate' : 'business'
      } needs.`,
      matchedFeatures: ['industry-match', 'workflow-automation', 'lead-generation'],
    }));

    return HttpResponse.json({
      id: 'chatcmpl-test123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              recommendations,
              overallConfidence: 'high',
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });
  }),
];

const server = setupServer(...openaiHandlers);

describe('AISnapshotSelector', () => {
  let testAgencyId: string;
  let testSnapshotIds: string[];
  let selector: AISnapshotSelector;

  beforeEach(async () => {
    server.listen({ onUnhandledRequest: 'error' });

    // Create test agency
    const agency = await prisma.agency.create({
      data: {
        name: 'Test Agency',
        ghlAgencyId: 'test-ghl-agency-ai',
        oauthAccessTokenEncrypted: 'encrypted_test_token',
        oauthRefreshTokenEncrypted: 'encrypted_test_refresh',
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    testAgencyId = agency.id;

    // Create test snapshots
    const snapshots = await Promise.all([
      prisma.snapshot.create({
        data: {
          agencyId: testAgencyId,
          ghlSnapshotId: 'snapshot-real-estate-001',
          name: 'Real Estate Pro',
          niche: 'Real Estate',
          description: 'Complete CRM for real estate agencies',
          isActive: true,
        },
      }),
      prisma.snapshot.create({
        data: {
          agencyId: testAgencyId,
          ghlSnapshotId: 'snapshot-automotive-001',
          name: 'Automotive Sales',
          niche: 'Automotive',
          description: 'Car dealership CRM template',
          isActive: true,
        },
      }),
      prisma.snapshot.create({
        data: {
          agencyId: testAgencyId,
          ghlSnapshotId: 'snapshot-healthcare-001',
          name: 'Healthcare Practice',
          niche: 'Healthcare',
          description: 'Medical practice management',
          isActive: true,
        },
      }),
    ]);

    testSnapshotIds = snapshots.map((s) => s.id);
    selector = new AISnapshotSelector();
  });

  afterEach(async () => {
    server.resetHandlers();
    server.close();

    // Cleanup
    await prisma.snapshot.deleteMany({});
    await prisma.agency.deleteMany({});
  });

  describe('selectSnapshot', () => {
    it('should recommend snapshots based on intake data', async () => {
      const intakeData = {
        businessName: 'Sunset Realty',
        industry: 'Real Estate',
        services: ['Residential Sales', 'Property Management'],
        targetMarket: 'Luxury coastal properties',
        estimatedLeads: 50,
      };

      const result = await selector.selectSnapshot(testAgencyId, intakeData);

      expect(result.recommendations).toBeTruthy();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].snapshotId).toBeTruthy();
      expect(result.recommendations[0].confidenceScore).toBeGreaterThan(0);
      expect(result.recommendations[0].confidenceScore).toBeLessThanOrEqual(1);
      expect(result.recommendations[0].reasoning).toBeTruthy();
      expect(result.recommendations[0].matchedFeatures).toBeInstanceOf(Array);

      // Verify metadata
      expect(result.analysisMetadata.modelVersion).toBe('gpt-4o-mini');
      expect(result.analysisMetadata.processingTime).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(result.analysisMetadata.confidence);
    });

    it('should rank recommendations by confidence score', async () => {
      const intakeData = {
        businessName: 'Test Business',
        industry: 'General',
      };

      const result = await selector.selectSnapshot(testAgencyId, intakeData);

      // Verify recommendations are sorted by confidence descending
      for (let i = 1; i < result.recommendations.length; i++) {
        expect(result.recommendations[i - 1].confidenceScore).toBeGreaterThanOrEqual(
          result.recommendations[i].confidenceScore
        );
      }

      // Verify ranks are sequential
      result.recommendations.forEach((rec, index) => {
        expect(rec.rank).toBe(index + 1);
      });
    });

    it('should handle single snapshot scenario', async () => {
      // Create a separate agency with only one snapshot
      const singleSnapshotAgency = await prisma.agency.create({
        data: {
          name: 'Single Snapshot Agency',
          ghlAgencyId: 'single-snapshot-agency',
          oauthAccessTokenEncrypted: 'encrypted_test_token',
          oauthRefreshTokenEncrypted: 'encrypted_test_refresh',
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await prisma.snapshot.create({
        data: {
          agencyId: singleSnapshotAgency.id,
          ghlSnapshotId: 'single-snapshot-001',
          name: 'Only Snapshot',
          isActive: true,
        },
      });

      const result = await selector.selectSnapshot(singleSnapshotAgency.id, {
        businessName: 'Test',
      });

      expect(result.recommendations.length).toBe(1);
      expect(result.recommendations[0].confidenceScore).toBe(1.0);
      expect(result.recommendations[0].reasoning).toContain('Only available snapshot');

      // Cleanup
      await prisma.snapshot.deleteMany({ where: { agencyId: singleSnapshotAgency.id } });
      await prisma.agency.delete({ where: { id: singleSnapshotAgency.id } });
    });

    it('should filter by availableSnapshotIds when provided', async () => {
      const intakeData = {
        businessName: 'Test Business',
      };

      // Select only the first two snapshots
      const result = await selector.selectSnapshot(
        testAgencyId,
        intakeData,
        testSnapshotIds.slice(0, 2)
      );

      expect(result.recommendations.length).toBeGreaterThan(0);

      // All recommendations should be from the filtered list
      result.recommendations.forEach((rec) => {
        expect(testSnapshotIds.slice(0, 2)).toContain(rec.snapshotId);
      });
    });

    it('should throw error when no snapshots are available', async () => {
      // Create agency with no snapshots
      const emptyAgency = await prisma.agency.create({
        data: {
          name: 'Empty Agency',
          ghlAgencyId: 'empty-agency',
          oauthAccessTokenEncrypted: 'encrypted_test_token',
          oauthRefreshTokenEncrypted: 'encrypted_test_refresh',
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await expect(
        selector.selectSnapshot(emptyAgency.id, { businessName: 'Test' })
      ).rejects.toThrow('No active snapshots available');

      // Cleanup
      await prisma.agency.delete({ where: { id: emptyAgency.id } });
    });

    it('should handle OpenAI API errors gracefully', async () => {
      // Override handler to return error
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json(
            { error: { message: 'API error', type: 'server_error' } },
            { status: 500 }
          );
        })
      );

      const result = await selector.selectSnapshot(testAgencyId, {
        businessName: 'Test',
      });

      // Should return fallback recommendation
      expect(result.recommendations.length).toBe(1);
      expect(result.recommendations[0].confidenceScore).toBe(0.5);
      expect(result.recommendations[0].reasoning).toContain('Fallback selection');
      expect(result.analysisMetadata.confidence).toBe('low');
    });

    it('should handle invalid JSON from OpenAI', async () => {
      // Override handler to return invalid JSON
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'test',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'invalid json{',
                },
                finish_reason: 'stop',
              },
            ],
          });
        })
      );

      const result = await selector.selectSnapshot(testAgencyId, {
        businessName: 'Test',
      });

      // Should return fallback recommendation
      expect(result.recommendations.length).toBe(1);
      expect(result.recommendations[0].confidenceScore).toBe(0.5);
    });
  });

  describe('getTopSnapshot', () => {
    it('should return the top recommended snapshot', async () => {
      const intakeData = {
        businessName: 'Luxury Real Estate',
        industry: 'Real Estate',
      };

      const result = await selector.getTopSnapshot(testAgencyId, intakeData);

      expect(result.snapshotId).toBeTruthy();
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);

      // Verify the snapshot exists
      const snapshot = await prisma.snapshot.findUnique({
        where: { id: result.snapshotId },
      });
      expect(snapshot).toBeTruthy();
      expect(snapshot?.agencyId).toBe(testAgencyId);
    });

    it('should return highest confidence snapshot', async () => {
      const fullResult = await selector.selectSnapshot(testAgencyId, {
        businessName: 'Test',
      });
      const topResult = await selector.getTopSnapshot(testAgencyId, {
        businessName: 'Test',
      });

      expect(topResult.snapshotId).toBe(fullResult.recommendations[0].snapshotId);
      expect(topResult.confidenceScore).toBe(fullResult.recommendations[0].confidenceScore);
    });
  });

  describe('Integration with real intake data', () => {
    it('should analyze complex intake data correctly', async () => {
      const complexIntake = {
        businessName: 'Coastal Luxury Homes',
        contactName: 'Sarah Johnson',
        email: 'sarah@coastalluxury.com',
        phone: '+1-555-0123',
        industry: 'Real Estate',
        services: [
          'Luxury Residential Sales',
          'Property Management',
          'Commercial Real Estate',
        ],
        targetMarket: 'High-net-worth individuals seeking luxury coastal properties',
        estimatedLeads: 100,
        monthlyBudget: '$10,000',
        website: 'https://coastalluxury.com',
        companySize: '10-50 employees',
        currentCRM: 'Spreadsheets',
        painPoints: [
          'Manual lead tracking',
          'No automated follow-up',
          'Poor client communication',
        ],
        goals: [
          'Automate lead nurturing',
          'Improve client retention',
          'Scale operations',
        ],
      };

      const result = await selector.selectSnapshot(testAgencyId, complexIntake);

      expect(result.recommendations).toBeTruthy();
      expect(result.recommendations[0].reasoning).toBeTruthy();
      expect(result.recommendations[0].matchedFeatures.length).toBeGreaterThan(0);
      expect(result.analysisMetadata.processingTime).toBeGreaterThan(0);
    });
  });
});
