import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || '';

/**
 * GET /api/session/:id — proxy to FastAPI backend.
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

  // If no backend configured, fall back to stub
  if (!BACKEND_URL) {
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

  try {
    const res = await fetch(`${BACKEND_URL}/api/session/${sessionId}`);
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch session';
    return Response.json({ message }, { status: 502 });
  }
}
