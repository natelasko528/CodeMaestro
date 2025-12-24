'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Sparkles, Eye } from 'lucide-react';
import type { Snapshot } from '@/lib/types';

interface SnapshotSelectorProps {
  snapshots: Snapshot[];
  selectedSnapshots?: string[];
  onSelectionChange?: (ids: string[]) => void;
  suggestedIds?: string[];
  searchPlaceholder?: string;
  multiSelect?: boolean;
}

export function SnapshotSelector({
  snapshots,
  selectedSnapshots = [],
  onSelectionChange,
  suggestedIds = [],
  searchPlaceholder = 'Search snapshots...',
  multiSelect = false,
}: SnapshotSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(snapshots.map((s) => s.category)));

  const filteredSnapshots = snapshots.filter((snapshot) => {
    const matchesSearch =
      snapshot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snapshot.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snapshot.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = !selectedCategory || snapshot.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleSelect = (id: string) => {
    if (!onSelectionChange) return;

    if (multiSelect) {
      const newSelection = selectedSnapshots.includes(id)
        ? selectedSnapshots.filter((sid) => sid !== id)
        : [...selectedSnapshots, id];
      onSelectionChange(newSelection);
    } else {
      onSelectionChange([id]);
    }
  };

  const isSelected = (id: string) => selectedSnapshots.includes(id);
  const isSuggested = (id: string) => suggestedIds.includes(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
          >
            {category.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSnapshots.map((snapshot) => (
          <Card
            key={snapshot.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isSelected(snapshot.id) ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleSelect(snapshot.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{snapshot.name}</CardTitle>
                  {snapshot.description && (
                    <CardDescription className="mt-1 line-clamp-2">
                      {snapshot.description}
                    </CardDescription>
                  )}
                </div>
                {isSuggested(snapshot.id) && (
                  <Badge variant="default" className="ml-2">
                    <Sparkles className="mr-1 h-3 w-3" />
                    AI
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {snapshot.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {snapshot.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{snapshot.tags.length - 3}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{snapshot.customFieldsCount} fields</span>
                  <span>{snapshot.usageCount} uses</span>
                </div>

                {snapshot.features.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-700">Features:</p>
                    <ul className="space-y-0.5 text-xs text-gray-600">
                      {snapshot.features.slice(0, 3).map((feature, index) => (
                        <li key={index}>• {feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSnapshots.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-500">No snapshots found</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory(null);
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
