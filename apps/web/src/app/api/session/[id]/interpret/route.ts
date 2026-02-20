import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || '';

/**
 * POST /api/session/:id/interpret — proxy to FastAPI backend.
 * Returns VisualizationParameterJSON with real waveforms.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  if (!sessionId) {
    return Response.json({ message: 'Session ID required' }, { status: 400 });
  }

  // If no backend configured, fall back to stub
  if (!BACKEND_URL) {
    const vizParams = {
      cardiac_cycle_duration_ms: 800,
      activation_sequence: [
        { structure_id: 'sa_node', onset_ms: 0, duration_ms: 50 },
        { structure_id: 'atria', onset_ms: 30, duration_ms: 80 },
        { structure_id: 'av_node', onset_ms: 120, duration_ms: 80 },
        { structure_id: 'his_bundle', onset_ms: 200, duration_ms: 30 },
        { structure_id: 'left_bundle', onset_ms: 230, duration_ms: 40 },
        { structure_id: 'right_bundle', onset_ms: 230, duration_ms: 40 },
        { structure_id: 'ventricles', onset_ms: 250, duration_ms: 100 },
      ],
      conduction_system: { sequence: [], lbbb: false },
      repolarization: { injury_current_regions: [] },
      display_contract: {
        evidence_supported: ['Normal sinus rhythm (stub — no backend connected)'],
        modeled_assumption: ['All values are placeholders until backend is connected'],
      },
      uncertainty: { alternate_models: [] },
      intervals: { pr_ms: 160, qrs_ms: 90, qt_ms: 380 },
      primary_diagnosis: 'Normal sinus rhythm (stub)',
      differentials: [],
      phase_boundaries: {
        p_wave: { start_ms: 0, end_ms: 80 },
        pr_segment: { start_ms: 80, end_ms: 160 },
        qrs: { start_ms: 160, end_ms: 250 },
        st_segment: { start_ms: 250, end_ms: 350 },
        t_wave: { start_ms: 350, end_ms: 500 },
      },
    };
    return Response.json(vizParams);
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/session/${sessionId}/interpret`, {
      method: 'POST',
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Interpretation failed';
    return Response.json({ message }, { status: 502 });
  }
}
