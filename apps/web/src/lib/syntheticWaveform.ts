/**
 * Generates a synthetic 12-lead ECG waveform from interval/phase data when the
 * backend does not provide vizParams.waveforms. For display only — not clinical.
 */

const LEAD_ORDER = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

/** Relative amplitudes per lead for a simple P-QRS-T template (lead II–like normalized) */
const LEAD_AMPLITUDE: Record<string, number> = {
  I: 0.6, II: 1, III: 0.5, aVR: -0.5, aVL: 0.3, aVF: 0.7,
  V1: 0.2, V2: 0.4, V3: 0.6, V4: 0.8, V5: 0.7, V6: 0.5,
};

export interface PhaseBounds {
  p_wave?: { start_ms: number; end_ms: number };
  pr_segment?: { start_ms: number; end_ms: number };
  qrs?: { start_ms: number; end_ms: number };
  st_segment?: { start_ms: number; end_ms: number };
  t_wave?: { start_ms: number; end_ms: number };
}

/**
 * Build synthetic time_ms and amplitude_mv for one lead over one cardiac cycle.
 * Uses phase_boundaries when present; otherwise derives from intervals.
 */
function buildSyntheticLead(
  leadId: string,
  cycleMs: number,
  phases: PhaseBounds,
  prMs: number,
  qrsMs: number,
  qtMs: number
): { time_ms: number[]; amplitude_mv: number[] } {
  const amp = LEAD_AMPLITUDE[leadId] ?? 0.5;
  const pointsPerMs = 4;
  const n = Math.max(2, Math.round(cycleMs * pointsPerMs));
  const time_ms: number[] = [];
  const amplitude_mv: number[] = [];

  const pStart = phases.p_wave?.start_ms ?? 0;
  const pEnd = phases.p_wave?.end_ms ?? 80;
  const qrsStart = phases.qrs?.start_ms ?? prMs;
  const qrsEnd = phases.qrs?.end_ms ?? (prMs + qrsMs);
  const tEnd = phases.t_wave?.end_ms ?? Math.min(qtMs + 80, cycleMs - 20);

  for (let i = 0; i <= n; i++) {
    const t = (i / n) * cycleMs;
    time_ms.push(t);

    let a = 0;
    if (t >= pStart && t <= pEnd) {
      const pProg = (t - pStart) / (pEnd - pStart || 1);
      a = 0.15 * amp * Math.sin(pProg * Math.PI);
    } else if (t > qrsStart && t < qrsEnd) {
      const qrsProg = (t - qrsStart) / (qrsEnd - qrsStart || 1);
      const q = qrsProg < 0.2 ? -0.1 * amp : 0;
      const r = qrsProg >= 0.2 && qrsProg < 0.5 ? 1.2 * amp : 0;
      const s = qrsProg >= 0.5 && qrsProg < 0.8 ? -0.2 * amp : 0;
      a = q + r + s;
    } else if (t > qrsEnd && t < tEnd) {
      const tProg = (t - qrsEnd) / (tEnd - qrsEnd || 1);
      a = 0.3 * amp * Math.sin(tProg * Math.PI);
    }
    amplitude_mv.push(a);
  }

  return { time_ms, amplitude_mv };
}

/**
 * Returns synthetic waveforms for all 12 leads when backend did not provide waveforms.
 * Caller should show a "Synthetic trace from intervals" label.
 */
export function getSyntheticWaveforms(
  cycleMs: number,
  phaseBoundaries?: PhaseBounds | null,
  intervals?: { pr_ms?: number; qrs_ms?: number; qt_ms?: number } | null
): Record<string, { time_ms: number[]; amplitude_mv: number[] }> {
  const phases = phaseBoundaries ?? {};
  const prMs = intervals?.pr_ms ?? 160;
  const qrsMs = intervals?.qrs_ms ?? 90;
  const qtMs = intervals?.qt_ms ?? 380;

  const out: Record<string, { time_ms: number[]; amplitude_mv: number[] }> = {};
  for (const id of LEAD_ORDER) {
    out[id] = buildSyntheticLead(id, cycleMs, phases, prMs, qrsMs, qtMs);
  }
  return out;
}
