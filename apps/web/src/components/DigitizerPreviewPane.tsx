'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useEkgStore } from '../store/ekgStore';
import { getSession, getOverlayUrl, triggerInterpretation, ApiError } from '../lib/apiClient';

export function DigitizerPreviewPane() {
  const {
    sessionId,
    uploadStatus,
    digitizationResult,
    originalImagePreviewUrl,
    setUploadStatus,
    setDigitizationResult,
    setVizParams,
  } = useEkgStore();
  const originalImageUrl = originalImagePreviewUrl;
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null);
  const overlayUrlRef = React.useRef<string | null>(null);
  const [correctionPanelOpen, setCorrectionPanelOpen] = useState(false);
  const [warningsDismissed, setWarningsDismissed] = useState<Set<string>>(new Set());
  const [interpreting, setInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || uploadStatus !== 'digitizing') return;

    let cancelled = false;
    (async () => {
      try {
        const res = await getSession(sessionId);
        if (cancelled) return;
        setDigitizationResult(res.digitization);
        if (res.viz_params) setVizParams(res.viz_params);
        setUploadStatus('ready');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : 'Failed to load digitization result.';
        setUploadStatus('error', msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, uploadStatus, setDigitizationResult, setVizParams, setUploadStatus]);

  useEffect(() => {
    if (!sessionId || uploadStatus !== 'ready') return;
    getOverlayUrl(sessionId)
      .then((u) => {
        if (overlayUrlRef.current) URL.revokeObjectURL(overlayUrlRef.current);
        overlayUrlRef.current = u;
        setOverlayImageUrl(u);
      })
      .catch(() => {});
    return () => {
      if (overlayUrlRef.current) {
        URL.revokeObjectURL(overlayUrlRef.current);
        overlayUrlRef.current = null;
      }
    };
  }, [sessionId, uploadStatus]);

  const handleInterpret = useCallback(async () => {
    if (!sessionId || !digitizationResult?.ready_for_interpretation) return;
    setInterpreting(true);
    setInterpretError(null);
    try {
      const params = await triggerInterpretation(sessionId);
      setVizParams(params);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Interpretation failed.';
      setInterpretError(msg);
    } finally {
      setInterpreting(false);
    }
  }, [sessionId, digitizationResult?.ready_for_interpretation, setVizParams]);

  const dismissWarning = useCallback((w: string) => {
    setWarningsDismissed((prev) => new Set(Array.from(prev).concat(w)));
  }, []);

  if (!sessionId || (uploadStatus !== 'ready' && uploadStatus !== 'digitizing')) {
    return null;
  }

  if (uploadStatus === 'digitizing') {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center min-h-[200px]">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 dark:text-slate-300">Digitizing ECG...</p>
      </div>
    );
  }

  const warnings = digitizationResult?.warnings ?? [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50">
        <div>
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Original</h3>
          <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
            {originalImageUrl ? (
              <img src={originalImageUrl} alt="Original ECG" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-slate-500">Original image</span>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Debug overlay</h3>
          <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
            {overlayImageUrl ? (
              <img src={overlayImageUrl} alt="Overlay" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-slate-500">Loading overlay...</span>
            )}
          </div>
        </div>
      </div>

      {digitizationResult?.per_lead_confidence && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {digitizationResult.per_lead_confidence.map(({ lead_id, confidence }) => (
            <span
              key={lead_id}
              className={`
                inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                ${confidence >= 0.9 ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : ''}
                ${confidence >= 0.7 && confidence < 0.9 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' : ''}
                ${confidence < 0.7 ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : ''}
              `}
            >
              {lead_id}: {Math.round(confidence * 100)}%
            </span>
          ))}
        </div>
      )}

      {warnings.filter((w) => !warningsDismissed.has(w)).length > 0 && (
        <div className="px-4 pb-2 space-y-2">
          {warnings
            .filter((w) => !warningsDismissed.has(w))
            .map((w) => (
              <div
                key={w}
                className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
              >
                <span className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {w}
                </span>
                <button
                  type="button"
                  onClick={() => dismissWarning(w)}
                  className="text-amber-600 hover:text-amber-800 dark:text-amber-400"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="p-4 flex flex-wrap gap-2 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setCorrectionPanelOpen((x) => !x)}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
        >
          Looks wrong? Adjust
          {correctionPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          type="button"
          disabled={!digitizationResult?.ready_for_interpretation || interpreting}
          onClick={handleInterpret}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {interpreting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Interpreting...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Interpret this ECG
            </>
          )}
        </button>
      </div>

      {correctionPanelOpen && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Correction panel: drag lead box boundaries and re-trigger digitization. (Placeholder – backend integration required.)
          </p>
        </div>
      )}

      {interpretError && (
        <p className="px-4 pb-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {interpretError}
        </p>
      )}
    </div>
  );
}
