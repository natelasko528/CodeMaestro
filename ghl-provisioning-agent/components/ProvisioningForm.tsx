'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Snapshot, SnapshotRecommendation } from '@/lib/types';

interface ProvisioningFormProps {
  snapshots?: Snapshot[];
  suggestedSnapshots?: SnapshotRecommendation[];
}

export function ProvisioningForm({ snapshots = [], suggestedSnapshots = [] }: ProvisioningFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SnapshotRecommendation[]>(suggestedSnapshots);

  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    industry: '',
    website: '',
    snapshotId: '',
    useAI: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.snapshotId && !formData.useAI) {
      newErrors.snapshotId = 'Please select a snapshot or enable AI selection';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getAISuggestions = async () => {
    if (!formData.businessName || !formData.industry) {
      toast({
        title: 'Missing information',
        description: 'Please provide business name and industry for AI recommendations',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/snapshots/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeData: {
            businessName: formData.businessName,
            industry: formData.industry,
            contactName: formData.contactName,
            email: formData.email,
            phone: formData.phone,
            website: formData.website,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI recommendations');

      const data = await response.json();
      setAiSuggestions(data.recommendations || []);

      if (data.recommendations?.[0]) {
        setFormData((prev) => ({ ...prev, snapshotId: data.recommendations[0].snapshotId }));
      }

      toast({
        title: 'AI Analysis Complete',
        description: `Found ${data.recommendations?.length || 0} recommended snapshots`,
      });
    } catch (error) {
      toast({
        title: 'Analysis failed',
        description: 'Unable to get AI recommendations. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Validation error',
        description: 'Please fix the errors in the form',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId: 'agency_123', // This would come from auth context
          intakeData: {
            businessName: formData.businessName,
            contactName: formData.contactName,
            email: formData.email,
            phone: formData.phone,
            industry: formData.industry,
            website: formData.website,
          },
          snapshotId: formData.useAI ? undefined : formData.snapshotId,
          options: {
            useAISnapshotSelection: formData.useAI,
            useAICustomValueMapping: true,
            sendWelcomeEmail: true,
          },
        }),
      });

      if (!response.ok) throw new Error('Provisioning request failed');

      const data = await response.json();

      toast({
        title: 'Provisioning started',
        description: `Job ${data.jobId} created successfully`,
      });

      router.push(`/jobs/${data.jobId}`);
    } catch (error) {
      toast({
        title: 'Provisioning failed',
        description: 'Unable to create provisioning job. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>Enter the details for the new sub-account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessName">
                Business Name <span className="text-error">*</span>
              </Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                placeholder="Acme Corp"
              />
              {errors.businessName && (
                <p className="text-xs text-error">{errors.businessName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-error">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@acme.com"
              />
              {errors.email && <p className="text-xs text-error">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData({ ...formData, industry: value })}
              >
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real-estate">Real Estate</SelectItem>
                  <SelectItem value="automotive">Automotive</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="legal">Legal Services</SelectItem>
                  <SelectItem value="fitness">Fitness & Wellness</SelectItem>
                  <SelectItem value="restaurants">Restaurants</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://acme.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Snapshot Selection</CardTitle>
              <CardDescription>Choose a template for the sub-account</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={getAISuggestions}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get AI Recommendations
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiSuggestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">AI Recommendations:</p>
              {aiSuggestions.slice(0, 3).map((suggestion, index) => (
                <div
                  key={suggestion.snapshotId}
                  className="rounded-lg border border-gray-200 p-3 hover:border-primary cursor-pointer"
                  onClick={() => setFormData({ ...formData, snapshotId: suggestion.snapshotId })}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{suggestion.snapshotName}</p>
                        {index === 0 && (
                          <Badge variant="default">
                            <Sparkles className="mr-1 h-3 w-3" />
                            Best Match
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          {Math.round(suggestion.confidenceScore * 100)}% confidence
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{suggestion.reasoning}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="snapshot">Manual Selection</Label>
            <Select
              value={formData.snapshotId}
              onValueChange={(value) => setFormData({ ...formData, snapshotId: value })}
            >
              <SelectTrigger id="snapshot">
                <SelectValue placeholder="Select a snapshot" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((snapshot) => (
                  <SelectItem key={snapshot.id} value={snapshot.id}>
                    {snapshot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.snapshotId && <p className="text-xs text-error">{errors.snapshotId}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Provision Job'
          )}
        </Button>
      </div>
    </form>
  );
}
