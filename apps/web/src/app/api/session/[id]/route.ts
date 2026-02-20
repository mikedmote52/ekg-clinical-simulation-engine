import { NextRequest } from 'next/server';

/**
 * Stub for backend GET /api/session/:id
 * Returns digitization result and optionally viz_params.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  if (!sessionId) {
    return Response.json({ message: 'Session ID required' }, { status: 400 });
  }
  // Stub response
  const digitization = {
    per_lead_confidence: [
      { lead_id: 'I', confidence: 0.95 },
      { lead_id: 'II', confidence: 0.92 },
      { lead_id: 'III', confidence: 0.88 },
      { lead_id: 'aVR', confidence: 0.9 },
      { lead_id: 'aVL', confidence: 0.91 },
      { lead_id: 'aVF', confidence: 0.93 },
      { lead_id: 'V1', confidence: 0.94 },
      { lead_id: 'V2', confidence: 0.96 },
      { lead_id: 'V3', confidence: 0.95 },
      { lead_id: 'V4', confidence: 0.94 },
      { lead_id: 'V5', confidence: 0.92 },
      { lead_id: 'V6', confidence: 0.93 },
    ],
    warnings: [] as string[],
    ready_for_interpretation: true,
  };
  return Response.json({ digitization });
}
