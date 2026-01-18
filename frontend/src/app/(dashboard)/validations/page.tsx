'use client';

import { useState } from 'react';
import { ValidationList } from '@/components/features/validations/validation-list';
import { useTriggerValidation } from '@/hooks/use-validations';
import { Button } from '@/components/ui/button';

export default function ValidationsPage() {
  const [showRunDialog, setShowRunDialog] = useState(false);
  const triggerValidation = useTriggerValidation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Validation Runs</h2>
          <p className="text-muted-foreground">
            Data quality validation execution history and results
          </p>
        </div>
        <Button onClick={() => setShowRunDialog(true)}>
          Run Validation
        </Button>
      </div>

      <ValidationList />

      {/* Run validation dialog - triggered from both header button and list */}
      {showRunDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Run Validation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select a dataset to validate. All active rules for the dataset will be evaluated.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const datasetId = formData.get('datasetId') as string;
                if (datasetId) {
                  try {
                    await triggerValidation.mutateAsync({ dataset_id: datasetId });
                    setShowRunDialog(false);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to trigger validation');
                  }
                }
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Dataset ID</label>
                <input
                  type="text"
                  name="datasetId"
                  placeholder="Enter dataset UUID"
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the UUID of the dataset to validate
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRunDialog(false)}
                  disabled={triggerValidation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={triggerValidation.isPending}>
                  {triggerValidation.isPending ? 'Starting...' : 'Run Validation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
