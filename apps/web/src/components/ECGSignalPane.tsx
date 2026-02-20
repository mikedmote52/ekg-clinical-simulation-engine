'use client';

import React, { useRef, useCallback, useMemo, useState } from 'react';
import { useEkgStore } from '../store/ekgStore';
import { getSyntheticWaveforms } from '../lib/syntheticWaveform';

const LEAD_ORDER = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

const GRID_1MM = '#f5c6c6';
const GRID_5MM = '#e8a0a0';

function hasRealWaveforms(waveforms: Record<string, { time_ms: number[]; amplitude_mv: number[] }> | undefined): boolean {
  if (!waveforms || typeof waveforms !== 'object') return false;
  const first = Object.values(waveforms)[0];
  return Boolean(first?.time_ms?.length && first?.amplitude_mv?.length);
}

export function ECGSignalPane() {
  const {
    vizParams,
    playbackTime,
    setPlaybackTime,
    activeLeads,
    toggleLead,
  } = useEkgStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverPoint, setHoverPoint] = useState<{ timeMs: number; amplitudeMv: number; leadId: string } | null>(null);

  const cycleMs = vizParams?.cardiac_cycle_duration_ms ?? 1000;
  const intervals = vizParams?.intervals ?? {};
  const phaseBoundaries = vizParams?.phase_boundaries ?? {};

  const { leadData, isSynthetic } = useMemo(() => {
    const waveforms = vizParams?.waveforms ?? {};
    const real = hasRealWaveforms(waveforms);
    if (real) {
      return {
        leadData: LEAD_ORDER.map((id) => ({
          id,
          data: waveforms[id] ?? { time_ms: [], amplitude_mv: [] },
        })).filter((l) => l.data.time_ms.length > 0 || l.data.amplitude_mv.length > 0),
        isSynthetic: false,
      };
    }
    const synthetic = getSyntheticWaveforms(cycleMs, phaseBoundaries, intervals);
    return {
      leadData: LEAD_ORDER.map((id) => ({ id, data: synthetic[id] })),
      isSynthetic: true,
    };
  }, [vizParams?.waveforms, cycleMs, phaseBoundaries, intervals]);

  const handleClickOrDrag = useCallback(
    (e: React.MouseEvent, type: 'click' | 'drag') => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const timeMs = pct * cycleMs;
      setPlaybackTime(timeMs);
    },
    [cycleMs, setPlaybackTime]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const pct = x / rect.width;
      const timeMs = pct * cycleMs;
      setHoverPoint({ timeMs, amplitudeMv: 0, leadId: leadData[0]?.id ?? '' });
    },
    [cycleMs, leadData]
  );

  const handleMouseLeave = useCallback(() => setHoverPoint(null), []);

  if (!vizParams) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-8 min-h-[400px] flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 animate-pulse">
        <div className="text-slate-500">No ECG data — run interpretation first</div>
      </div>
    );
  }

  const cursorX = (playbackTime / cycleMs) * 100;

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-[#f5e6d3] dark:bg-[#2d2519]"
      style={{ minHeight: 400 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="p-4 relative">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">12-Lead ECG</h3>

        {/* Paper-style grid */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none opacity-60"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${GRID_1MM} 1px, transparent 1px),
              linear-gradient(to bottom, ${GRID_1MM} 1px, transparent 1px),
              linear-gradient(to right, ${GRID_5MM} 1px, transparent 1px),
              linear-gradient(to bottom, ${GRID_5MM} 1px, transparent 1px)
            `,
            backgroundSize: '5% 5%, 5% 5%, 25% 25%, 25% 25%',
          }}
        />

        {isSynthetic && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-2 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
            Synthetic trace from intervals — connect backend with waveform data for real ECG
          </p>
        )}
        {/* Lead traces */}
        <div
          className="relative flex flex-col gap-1 pt-8 pb-4"
          onClick={(e) => handleClickOrDrag(e, 'click')}
          onMouseDown={() => {}}
        >
          {leadData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
              No waveform or interval data available
            </div>
          ) : (
            leadData.map(({ id, data }) => {
              const isActive = activeLeads.includes(id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => toggleLead(id)}
                >
                  <span
                    className={`text-xs w-8 font-mono ${isActive ? 'text-teal-600 font-bold' : 'text-slate-600'}`}
                  >
                    {id}
                  </span>
                  <svg
                    className="flex-1 h-6"
                    viewBox={`0 0 100 20`}
                    preserveAspectRatio="none"
                  >
                    {data.time_ms.length > 1 &&
                      data.time_ms.slice(0, -1).map((_, i) => {
                        const t0 = data.time_ms[i];
                        const t1 = data.time_ms[i + 1];
                        const a0 = data.amplitude_mv[i] ?? 0;
                        const a1 = data.amplitude_mv[i + 1] ?? 0;
                        const x0 = (t0 / cycleMs) * 100;
                        const x1 = (t1 / cycleMs) * 100;
                        const y0 = 10 - (a0 * 5);
                        const y1 = 10 - (a1 * 5);
                        return (
                          <line
                            key={i}
                            x1={x0}
                            y1={y0}
                            x2={x1}
                            y2={y1}
                            stroke="black"
                            strokeWidth="0.3"
                          />
                        );
                      })}
                  </svg>
                </div>
              );
            })
          )}
        </div>

        {/* Playback cursor */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
          style={{ left: `calc(1rem + ${cursorX}% * (100% - 2rem))` }}
        />

        {/* Caliper overlays placeholder - PR, QRS, QT */}
        {intervals.pr_ms != null && (
          <div className="text-xs text-slate-600 mt-2">
            PR: {intervals.pr_ms}ms | QRS: {intervals.qrs_ms ?? '—'}ms | QT: {intervals.qt_ms ?? '—'}ms
          </div>
        )}

        {hoverPoint && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-slate-800/90 text-white text-xs pointer-events-none z-20">
            {hoverPoint.timeMs.toFixed(0)} ms
          </div>
        )}
      </div>
    </div>
  );
}
