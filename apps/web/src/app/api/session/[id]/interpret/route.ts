import { NextRequest } from 'next/server';

/**
 * Stub for backend POST /api/session/:id/interpret
 * Returns VisualizationParameterJSON.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  if (!sessionId) {
    return Response.json({ message: 'Session ID required' }, { status: 400 });
  }
  // Stub VisualizationParameterJSON for testing
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
      evidence_supported: ['Normal sinus rhythm', 'Heart rate 72 bpm', 'PR interval 160 ms', 'QRS duration 90 ms'],
      modeled_assumption: ['AV node delay timing inferred from PR segment', 'Ventricular activation pattern assumed from QRS morphology'],
    },
    uncertainty: { alternate_models: [] },
    intervals: { pr_ms: 160, qrs_ms: 90, qt_ms: 380 },
    primary_diagnosis: 'Normal sinus rhythm',
    differentials: [
      { id: '1', label: 'Sinus arrhythmia', probability_tier: 'low', supporting_criteria: [], discriminating_tests: ['Respiratory variation in RR'] },
    ],
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
