import OpenAI from 'openai';
import prisma from './db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4o-mini';

export interface SnapshotRecommendation {
  snapshotId: string;
  snapshotName: string;
  rank: number;
  confidenceScore: number;
  reasoning: string;
  matchedFeatures: string[];
}

export interface SelectSnapshotResult {
  recommendations: SnapshotRecommendation[];
  analysisMetadata: {
    modelVersion: string;
    processingTime: number;
    confidence: 'high' | 'medium' | 'low';
  };
}

/**
 * AI-powered snapshot selection service using OpenAI GPT-4o-mini
 * Analyzes client intake data and recommends the most appropriate snapshot
 */
export class AISnapshotSelector {
  /**
   * Select the best snapshot for a client based on intake data
   * @param agencyId - Agency ID to fetch available snapshots
   * @param intakeData - Client intake form data
   * @param availableSnapshotIds - Optional list of snapshot IDs to consider
   * @returns Ranked snapshot recommendations with confidence scores
   */
  async selectSnapshot(
    agencyId: string,
    intakeData: Record<string, any>,
    availableSnapshotIds?: string[]
  ): Promise<SelectSnapshotResult> {
    const startTime = Date.now();

    // Fetch available snapshots for the agency
    const snapshots = await prisma.snapshot.findMany({
      where: {
        agencyId,
        isActive: true,
        ...(availableSnapshotIds && { id: { in: availableSnapshotIds } }),
      },
      select: {
        id: true,
        name: true,
        niche: true,
        description: true,
      },
    });

    if (snapshots.length === 0) {
      throw new Error('No active snapshots available for this agency');
    }

    // If only one snapshot is available, return it with high confidence
    if (snapshots.length === 1) {
      const processingTime = Date.now() - startTime;
      return {
        recommendations: [
          {
            snapshotId: snapshots[0].id,
            snapshotName: snapshots[0].name,
            rank: 1,
            confidenceScore: 1.0,
            reasoning: 'Only available snapshot for this agency',
            matchedFeatures: ['default'],
          },
        ],
        analysisMetadata: {
          modelVersion: MODEL,
          processingTime,
          confidence: 'high',
        },
      };
    }

    // Prepare prompt for OpenAI
    const systemPrompt = `You are an expert at matching business requirements to CRM templates.
You will be given client intake data and a list of available GoHighLevel snapshot templates.
Your task is to analyze the client's business needs and recommend the most suitable snapshots.

For each recommendation, provide:
1. A confidence score (0-1) indicating how well the snapshot matches
2. Clear reasoning explaining why this snapshot is suitable
3. Specific features that match the client's needs

Return your response as JSON in this exact format:
{
  "recommendations": [
    {
      "snapshotId": "snapshot-uuid",
      "confidenceScore": 0.95,
      "reasoning": "explanation here",
      "matchedFeatures": ["feature1", "feature2"]
    }
  ],
  "overallConfidence": "high" | "medium" | "low"
}`;

    const userPrompt = `Client Intake Data:
${JSON.stringify(intakeData, null, 2)}

Available Snapshots:
${snapshots.map((s, i) => `${i + 1}. ID: ${s.id}
   Name: ${s.name}
   Niche: ${s.niche || 'General'}
   Description: ${s.description || 'No description available'}`).join('\n\n')}

Please analyze the client data and recommend the best snapshots (rank top 3 if possible).`;

    try {
      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const aiResponse = completion.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from OpenAI');
      }

      // Parse AI response
      const parsedResponse = JSON.parse(aiResponse);
      const processingTime = Date.now() - startTime;

      // Map AI recommendations to our format
      const recommendations: SnapshotRecommendation[] = parsedResponse.recommendations
        .map((rec: any, index: number) => {
          const snapshot = snapshots.find((s) => s.id === rec.snapshotId);
          if (!snapshot) {
            console.warn(`Snapshot ${rec.snapshotId} not found in available snapshots`);
            return null;
          }

          return {
            snapshotId: rec.snapshotId,
            snapshotName: snapshot.name,
            rank: index + 1,
            confidenceScore: rec.confidenceScore,
            reasoning: rec.reasoning,
            matchedFeatures: rec.matchedFeatures || [],
          };
        })
        .filter((rec: any) => rec !== null)
        .sort((a: any, b: any) => b.confidenceScore - a.confidenceScore); // Sort by confidence descending

      // If no valid recommendations, use the first snapshot as fallback
      if (recommendations.length === 0) {
        recommendations.push({
          snapshotId: snapshots[0].id,
          snapshotName: snapshots[0].name,
          rank: 1,
          confidenceScore: 0.5,
          reasoning: 'Default snapshot selection (AI recommendation failed)',
          matchedFeatures: ['fallback'],
        });
      }

      return {
        recommendations,
        analysisMetadata: {
          modelVersion: MODEL,
          processingTime,
          confidence: parsedResponse.overallConfidence || 'medium',
        },
      };

    } catch (error) {
      console.error('Error calling OpenAI API:', error);

      // Fallback: return first snapshot with low confidence
      const processingTime = Date.now() - startTime;
      return {
        recommendations: [
          {
            snapshotId: snapshots[0].id,
            snapshotName: snapshots[0].name,
            rank: 1,
            confidenceScore: 0.5,
            reasoning: 'Fallback selection due to AI service error. Manual review recommended.',
            matchedFeatures: ['fallback'],
          },
        ],
        analysisMetadata: {
          modelVersion: MODEL,
          processingTime,
          confidence: 'low',
        },
      };
    }
  }

  /**
   * Get the top recommended snapshot ID
   * @param agencyId - Agency ID
   * @param intakeData - Client intake data
   * @returns Top snapshot ID and confidence score
   */
  async getTopSnapshot(
    agencyId: string,
    intakeData: Record<string, any>
  ): Promise<{ snapshotId: string; confidenceScore: number }> {
    const result = await this.selectSnapshot(agencyId, intakeData);
    const topRecommendation = result.recommendations[0];

    if (!topRecommendation) {
      throw new Error('No snapshot recommendations available');
    }

    return {
      snapshotId: topRecommendation.snapshotId,
      confidenceScore: topRecommendation.confidenceScore,
    };
  }
}

export default AISnapshotSelector;
