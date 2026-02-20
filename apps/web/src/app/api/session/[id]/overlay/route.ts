import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || '';

/**
 * GET /api/session/:id/overlay — proxy to FastAPI backend.
 * Returns debug overlay image as PNG.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  if (!sessionId) {
    return Response.json({ message: 'Session ID required' }, { status: 400 });
  }

  // If no backend configured, return placeholder
  if (!BACKEND_URL) {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    return new Response(png, {
      headers: { 'Content-Type': 'image/png' },
    });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/session/${sessionId}/overlay`);
    if (!res.ok) {
      return Response.json({ message: 'Overlay not available' }, { status: res.status });
    }
    const blob = await res.blob();
    return new Response(blob, {
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch overlay';
    return Response.json({ message }, { status: 502 });
  }
}
