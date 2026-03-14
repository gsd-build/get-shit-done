'use client';

import type { DiscussDecision } from '@/stores/discussStore';

interface DecisionOptionsPanelProps {
  decisions: DiscussDecision[];
  disabled?: boolean;
  onChooseOption: (decisionId: string, optionId: string) => void;
  onAcceptAllDefaults: () => void;
}

export function DecisionOptionsPanel({
  decisions,
  disabled = false,
  onChooseOption,
  onAcceptAllDefaults,
}: DecisionOptionsPanelProps) {
  if (decisions.length === 0) {
    return null;
  }

  return (
    <section className="border border-border rounded-lg bg-card overflow-hidden" data-testid="decision-options-panel">
      <div className="px-4 py-3 border-b border-border font-medium">Recommended Decisions</div>
      <div className="p-4 space-y-4">
        {decisions.map((decision) => {
          const rankedOptions = [...decision.options].sort((a, b) => {
            if (!!a.recommended === !!b.recommended) return 0;
            return a.recommended ? -1 : 1;
          });

          return (
            <div key={decision.id} className="border border-border rounded-md p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">{decision.question}</p>
              <div className="flex flex-wrap gap-2">
                {rankedOptions.map((option, index) => {
                  const selected = decision.selectedOptionId === option.id;
                  const label = `${index + 1}. ${option.label}${option.recommended ? ' (Recommended)' : ''}`;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onChooseOption(decision.id, option.id)}
                      disabled={disabled}
                      className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-foreground hover:bg-muted'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="pt-1">
          <button
            type="button"
            onClick={onAcceptAllDefaults}
            disabled={disabled}
            className="px-4 py-2 text-sm rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Accept all defaults
          </button>
        </div>
      </div>
    </section>
  );
}
