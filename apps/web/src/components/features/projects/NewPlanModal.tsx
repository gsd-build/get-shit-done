'use client';

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { createPlan } from '@/lib/api';
import { BASE_CATEGORIES, detectCategoryFromIntent } from './categoryModel';

interface NewPlanModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customCategories?: string[];
  onCreated?: () => void;
}

const CONFIDENCE_THRESHOLD = 0.65;

export function NewPlanModal({
  projectId,
  open,
  onOpenChange,
  customCategories = [],
  onCreated,
}: NewPlanModalProps) {
  const [title, setTitle] = useState('');
  const [intent, setIntent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    return Array.from(new Set([...BASE_CATEGORIES, ...customCategories]));
  }, [customCategories]);

  const suggestion = useMemo(() => detectCategoryFromIntent(intent), [intent]);

  const suggestionCategory =
    suggestion.confidence >= CONFIDENCE_THRESHOLD ? suggestion.category : 'general';

  const confidenceLabel =
    suggestion.confidence >= CONFIDENCE_THRESHOLD ? 'Detected' : 'Low confidence';

  const handleUseSuggested = () => {
    setSelectedCategory(suggestionCategory);
    setCategoryConfirmed(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !categoryConfirmed || submitting) return;
    setSubmitting(true);
    setError(null);
    const trimmedIntent = intent.trim();
    const response = await createPlan(projectId, {
      title: title.trim(),
      category: selectedCategory,
      ...(trimmedIntent ? { intent: trimmedIntent } : {}),
    });
    setSubmitting(false);
    if (!response.success) {
      setError(response.error?.message || 'Failed to create plan');
      return;
    }
    setTitle('');
    setIntent('');
    setSelectedCategory('general');
    setCategoryConfirmed(false);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card p-6 rounded-lg shadow-lg max-w-lg w-[95vw] z-50">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              New Plan
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Fix plan route mismatch"
                className="w-full min-h-11 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Intent</label>
              <textarea
                value={intent}
                onChange={(e) => {
                  setIntent(e.target.value);
                  setCategoryConfirmed(false);
                }}
                placeholder="Describe what this plan should do..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
              />
              <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  {confidenceLabel}: <strong>{suggestionCategory}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleUseSuggested}
                  className="text-primary hover:underline"
                >
                  Use detected category
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCategoryConfirmed(false);
                }}
                className="w-full min-h-11 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={categoryConfirmed}
                  onChange={(e) => setCategoryConfirmed(e.target.checked)}
                />
                Confirm category selection
              </label>
            </div>

            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!title.trim() || !categoryConfirmed || submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
