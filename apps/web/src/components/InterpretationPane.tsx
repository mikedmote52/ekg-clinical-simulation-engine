'use client';

import React from 'react';
import { CheckCircle, Info } from 'lucide-react';
import { useEkgStore } from '../store/ekgStore';
import type { AlternateModel } from '../types/visualizationParams';

export function InterpretationPane() {
  const { vizParams, activeAlternateModel, applyAlternateModel } = useEkgStore();

  if (!vizParams) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-8 min-h-[200px] flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 animate-pulse">
        <div className="text-slate-500">Run interpretation to see findings</div>
      </div>
    );
  }

  const { display_contract, primary_diagnosis, differentials, uncertainty } = vizParams;
  const evidenceSupported = display_contract?.evidence_supported ?? [];
  const modeledAssumptions = display_contract?.modeled_assumption ?? [];
  const alternates = uncertainty?.alternate_models ?? [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-6 space-y-6">
        {/* Primary diagnosis */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Primary diagnosis
          </h2>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{primary_diagnosis}</p>
        </div>

        {/* Section 1: Evidence supported */}
        <section id="evidence-supported">
          <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4" />
            Supported by ECG evidence
          </h3>
          <ul className="space-y-1">
            {evidenceSupported.length === 0 ? (
              <li className="text-slate-500 text-sm">None listed</li>
            ) : (
              evidenceSupported.map((finding, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 rounded px-2 py-1 -mx-2"
                >
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  {finding}
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Section 2: Modeled assumptions */}
        <section id="modeled-assumption">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-2">
            <Info className="w-4 h-4" />
            Explanatory model — not directly measured
          </h3>
          <ul className="space-y-1">
            {modeledAssumptions.length === 0 ? (
              <li className="text-slate-500 text-sm">None listed</li>
            ) : (
              modeledAssumptions.map((finding, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 group relative"
                  title="Cannot be directly inferred from ECG alone"
                >
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  {finding}
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Differentials */}
        {differentials && differentials.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Differentials
            </h3>
            <div className="space-y-2">
              {differentials.map((d) => (
                <DifferentialCard key={d.id} differential={d} />
              ))}
            </div>
          </section>
        )}

        {/* Alternate models */}
        {alternates.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Alternate models
            </h3>
            <div className="flex flex-wrap gap-2">
              {activeAlternateModel && (
                <button
                  type="button"
                  onClick={() => applyAlternateModel(null)}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700"
                >
                  Return to best-fit
                </button>
              )}
              {alternates.map((alt) => (
                <button
                  key={alt.id}
                  type="button"
                  onClick={() => applyAlternateModel(alt)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    activeAlternateModel === alt.id
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                      : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Show: {alt.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DifferentialCard({
  differential,
}: {
  differential: { id: string; label: string; probability_tier: string; supporting_criteria?: string[]; discriminating_tests?: string[] };
}) {
  const [expanded, setExpanded] = React.useState(false);
  const tierColors: Record<string, string> = {
    high: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-medium text-slate-800 dark:text-slate-200">{differential.label}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded ${tierColors[differential.probability_tier] ?? tierColors.low}`}
        >
          {differential.probability_tier}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400 space-y-1">
          {differential.supporting_criteria?.length ? (
            <div>
              <strong>Supporting:</strong>{' '}
              {differential.supporting_criteria.join('; ')}
            </div>
          ) : null}
          {differential.discriminating_tests?.length ? (
            <div>
              <strong>Discriminating tests:</strong>{' '}
              {differential.discriminating_tests.join('; ')}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
