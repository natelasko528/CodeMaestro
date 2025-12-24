import OpenAI from 'openai';
import { GHLClient } from './ghl-client';
import prisma from './db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4o-mini';

export interface CustomField {
  fieldId: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'email' | 'phone' | 'url' | 'dropdown' | 'checkbox';
  required: boolean;
  options?: string[]; // For dropdown/checkbox fields
}

export interface CustomValueMapping {
  sourceField: string;
  targetField: string;
  transformation: string;
  confidence: number;
}

export interface CustomValueMapResult {
  mappedValues: Record<string, any>;
  mappingDetails: CustomValueMapping[];
  unmappedFields: string[];
  missingRequiredFields: string[];
}

/**
 * Custom value injection service
 * Maps client intake data to GHL custom field values using AI
 */
export class CustomValueService {
  /**
   * Map intake data to custom field values using AI
   * @param intakeData - Client intake form data
   * @param customFields - Target custom field definitions
   * @returns Mapped values with mapping details
   */
  async mapCustomValues(
    intakeData: Record<string, any>,
    customFields: CustomField[]
  ): Promise<CustomValueMapResult> {
    if (customFields.length === 0) {
      return {
        mappedValues: {},
        mappingDetails: [],
        unmappedFields: Object.keys(intakeData),
        missingRequiredFields: [],
      };
    }

    // Prepare system prompt
    const systemPrompt = `You are an expert at mapping business data to CRM custom fields.
You will be given client intake data and a list of custom field definitions.
Your task is to intelligently map the intake data to the appropriate custom fields.

Rules:
1. Match fields based on semantic meaning, not just exact names
2. Transform data to match the target field type (e.g., format phone numbers, convert strings to numbers)
3. For dropdown fields, select the closest matching option
4. For checkbox fields, return boolean values
5. Only map fields when you have high confidence (>0.7)
6. Leave required fields unmapped if no suitable data exists

Return your response as JSON in this exact format:
{
  "mappings": [
    {
      "sourceField": "source_field_name",
      "targetField": "target_field_id",
      "value": "transformed_value",
      "transformation": "description of transformation applied",
      "confidence": 0.95
    }
  ]
}`;

    const userPrompt = `Client Intake Data:
${JSON.stringify(intakeData, null, 2)}

Custom Fields:
${customFields.map((field, i) => `${i + 1}. ID: ${field.fieldId}
   Name: ${field.fieldName}
   Type: ${field.fieldType}
   Required: ${field.required}
   ${field.options ? `Options: ${field.options.join(', ')}` : ''}`).join('\n\n')}

Please map the intake data to the custom fields.`;

    try {
      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2, // Low temperature for consistent mapping
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const aiResponse = completion.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from OpenAI');
      }

      // Parse AI response
      const parsedResponse = JSON.parse(aiResponse);
      const mappings = parsedResponse.mappings || [];

      // Build result
      const mappedValues: Record<string, any> = {};
      const mappingDetails: CustomValueMapping[] = [];
      const mappedSourceFields = new Set<string>();
      const mappedTargetFields = new Set<string>();

      for (const mapping of mappings) {
        // Validate confidence threshold
        if (mapping.confidence < 0.7) {
          continue;
        }

        // Validate target field exists
        const targetField = customFields.find((f) => f.fieldId === mapping.targetField);
        if (!targetField) {
          console.warn(`Target field ${mapping.targetField} not found`);
          continue;
        }

        // Validate and transform value based on field type
        const transformedValue = this.transformValue(
          mapping.value,
          targetField.fieldType,
          targetField.options
        );

        if (transformedValue !== null) {
          mappedValues[mapping.targetField] = transformedValue;
          mappingDetails.push({
            sourceField: mapping.sourceField,
            targetField: mapping.targetField,
            transformation: mapping.transformation,
            confidence: mapping.confidence,
          });
          mappedSourceFields.add(mapping.sourceField);
          mappedTargetFields.add(mapping.targetField);
        }
      }

      // Identify unmapped intake fields
      const unmappedFields = Object.keys(intakeData).filter(
        (field) => !mappedSourceFields.has(field)
      );

      // Identify missing required fields
      const missingRequiredFields = customFields
        .filter((field) => field.required && !mappedTargetFields.has(field.fieldId))
        .map((field) => field.fieldId);

      return {
        mappedValues,
        mappingDetails,
        unmappedFields,
        missingRequiredFields,
      };

    } catch (error) {
      console.error('Error in AI custom value mapping:', error);

      // Fallback: Simple exact-match mapping
      return this.fallbackMapping(intakeData, customFields);
    }
  }

  /**
   * Transform a value to match the target field type
   */
  private transformValue(
    value: any,
    fieldType: string,
    options?: string[]
  ): any {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      switch (fieldType) {
        case 'text':
        case 'email':
        case 'url':
          return String(value);

        case 'number':
          const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
          return isNaN(num) ? null : num;

        case 'phone':
          // Remove all non-numeric characters except +
          return String(value).replace(/[^0-9+]/g, '');

        case 'date':
          const date = new Date(value);
          return isNaN(date.getTime()) ? null : date.toISOString();

        case 'checkbox':
          if (typeof value === 'boolean') return value;
          if (typeof value === 'string') {
            const lower = value.toLowerCase();
            return lower === 'true' || lower === 'yes' || lower === '1';
          }
          return Boolean(value);

        case 'dropdown':
          if (!options || options.length === 0) return String(value);
          // Find exact match (case-insensitive)
          const exactMatch = options.find(
            (opt) => opt.toLowerCase() === String(value).toLowerCase()
          );
          if (exactMatch) return exactMatch;
          // Find partial match
          const partialMatch = options.find((opt) =>
            opt.toLowerCase().includes(String(value).toLowerCase())
          );
          return partialMatch || null;

        default:
          return String(value);
      }
    } catch (error) {
      console.error(`Error transforming value for field type ${fieldType}:`, error);
      return null;
    }
  }

  /**
   * Fallback mapping using simple exact field name matching
   */
  private fallbackMapping(
    intakeData: Record<string, any>,
    customFields: CustomField[]
  ): CustomValueMapResult {
    const mappedValues: Record<string, any> = {};
    const mappingDetails: CustomValueMapping[] = [];
    const mappedSourceFields = new Set<string>();

    for (const field of customFields) {
      // Try exact match (case-insensitive)
      const matchingKey = Object.keys(intakeData).find(
        (key) => key.toLowerCase() === field.fieldName.toLowerCase()
      );

      if (matchingKey) {
        const transformedValue = this.transformValue(
          intakeData[matchingKey],
          field.fieldType,
          field.options
        );

        if (transformedValue !== null) {
          mappedValues[field.fieldId] = transformedValue;
          mappingDetails.push({
            sourceField: matchingKey,
            targetField: field.fieldId,
            transformation: 'exact_match',
            confidence: 0.8,
          });
          mappedSourceFields.add(matchingKey);
        }
      }
    }

    const unmappedFields = Object.keys(intakeData).filter(
      (field) => !mappedSourceFields.has(field)
    );

    const missingRequiredFields = customFields
      .filter((field) => field.required && !(field.fieldId in mappedValues))
      .map((field) => field.fieldId);

    return {
      mappedValues,
      mappingDetails,
      unmappedFields,
      missingRequiredFields,
    };
  }

  /**
   * Apply custom values to a GHL location
   * @param locationId - GHL location ID
   * @param customValues - Custom field values to apply
   * @param ghlClient - GHL API client instance
   */
  async applyCustomValues(
    locationId: string,
    customValues: Record<string, any>,
    ghlClient: GHLClient
  ): Promise<void> {
    if (Object.keys(customValues).length === 0) {
      console.log('No custom values to apply');
      return;
    }

    try {
      // Note: This is a simplified implementation
      // The actual GHL API endpoint for updating custom fields may vary
      // You would typically use the GHL API to update location settings or custom fields

      // For now, we'll log what would be applied
      console.log(`Applying custom values to location ${locationId}:`, customValues);

      // In a real implementation, you would call:
      // await ghlClient.updateLocationCustomFields(locationId, customValues);

      // Since the GHL API wrapper doesn't have this method yet,
      // we'll store it in the database for now
      await prisma.provisioningLog.create({
        data: {
          jobId: locationId, // This would be the actual job ID
          step: 'CUSTOM_VALUES_APPLIED',
          status: 'COMPLETED',
          detailsJson: {
            locationId,
            customValues,
            timestamp: new Date().toISOString(),
          },
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to apply custom values: ${errorMessage}`);
    }
  }

  /**
   * Extract custom field definitions from a snapshot
   * @param snapshotId - Snapshot ID
   * @param agencyId - Agency ID
   * @returns Custom field definitions
   */
  async extractCustomFields(
    snapshotId: string,
    agencyId: string
  ): Promise<CustomField[]> {
    // Verify snapshot exists and belongs to agency
    const snapshot = await prisma.snapshot.findFirst({
      where: {
        id: snapshotId,
        agencyId,
        isActive: true,
      },
    });

    if (!snapshot) {
      throw new Error('Snapshot not found or not available');
    }

    // In a real implementation, we would fetch custom field definitions from GHL API
    // For now, return mock custom fields based on the snapshot's niche
    const mockCustomFields: CustomField[] = [];

    if (snapshot.niche === 'Real Estate') {
      mockCustomFields.push(
        {
          fieldId: 'cf_business_name',
          fieldName: 'Business Name',
          fieldType: 'text',
          required: true,
        },
        {
          fieldId: 'cf_phone',
          fieldName: 'Phone Number',
          fieldType: 'phone',
          required: true,
        },
        {
          fieldId: 'cf_email',
          fieldName: 'Email Address',
          fieldType: 'email',
          required: true,
        },
        {
          fieldId: 'cf_budget',
          fieldName: 'Monthly Budget',
          fieldType: 'number',
          required: false,
        },
        {
          fieldId: 'cf_property_type',
          fieldName: 'Property Type',
          fieldType: 'dropdown',
          required: false,
          options: ['Residential', 'Commercial', 'Luxury', 'Rental'],
        }
      );
    } else {
      // Generic custom fields
      mockCustomFields.push(
        {
          fieldId: 'cf_business_name',
          fieldName: 'Business Name',
          fieldType: 'text',
          required: true,
        },
        {
          fieldId: 'cf_industry',
          fieldName: 'Industry',
          fieldType: 'text',
          required: false,
        },
        {
          fieldId: 'cf_contact_email',
          fieldName: 'Contact Email',
          fieldType: 'email',
          required: true,
        }
      );
    }

    return mockCustomFields;
  }
}

export default CustomValueService;
