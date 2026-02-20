'use client';

import React from 'react';
import { UploadPane } from '../../components/UploadPane';
import { DigitizerPreviewPane } from '../../components/DigitizerPreviewPane';
import { ECGSignalPane } from '../../components/ECGSignalPane';
import { HeartModelPane } from '../../components/HeartModelPane';
import { InterpretationPane } from '../../components/InterpretationPane';
import { HonestContractBadge } from '../../components/HonestContractBadge';
import { useEkgStore } from '../../store/ekgStore';

function hasRealWaveforms(vizParams: { waveforms?: Record<string, { time_ms: number[]; amplitude_mv: number[] }> } | null): boolean {
  if (!vizParams?.waveforms || typeof vizParams.waveforms !== 'object') return false;
  const first = Object.values(vizParams.waveforms)[0];
  return Boolean(first?.time_ms?.length && first?.amplitude_mv?.length);
}

export default function ECGInterpretationPage() {
  const { sessionId, uploadStatus, vizParams } = useEkgStore();

  const showUpload = uploadStatus === 'idle' || uploadStatus === 'error';
  const showDigitizer = sessionId && (uploadStatus === 'digitizing' || uploadStatus === 'ready');
  const showMainContent = vizParams != null;
  const isDemoStub = showMainContent && !hasRealWaveforms(vizParams);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          ECG Interpretation & 3D Heart Visualization
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Educational tool — evidence-based interpretation with explanatory model
        </p>
      </header>

      <HonestContractBadge />

      {isDemoStub && (
        <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-300 dark:border-amber-700 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 text-center">
          Using demo interpretation (no real backend). Connect your interpretation API for accurate, ECG-specific results.
        </div>
      )}

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {showUpload && (
          <section className="mb-8">
            <UploadPane />
          </section>
        )}

        {showDigitizer && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">
              Digitizer preview
            </h2>
            <DigitizerPreviewPane />
          </section>
        )}

        <div
          className={`grid gap-6 ${showMainContent ? 'lg:grid-cols-2' : 'grid-cols-1'}`}
        >
          {showMainContent && (
            <>
              <section>
                <h2 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">
                  ECG signal
                </h2>
                <ECGSignalPane />
              </section>
              <section>
                <h2 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">
                  Heart model
                </h2>
                <HeartModelPane />
              </section>
            </>
          )}
        </div>

        {showMainContent && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">
              Interpretation
            </h2>
            <InterpretationPane />
          </section>
        )}

        {!showMainContent && !showUpload && !showDigitizer && (
          <div className="py-12 text-center text-slate-500">
            Loading…
          </div>
        )}
      </main>
    </div>
  );
}
