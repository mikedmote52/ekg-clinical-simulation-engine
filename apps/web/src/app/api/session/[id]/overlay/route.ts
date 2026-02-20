import { NextRequest } from 'next/server';

/**
 * Stub for backend GET /api/session/:id/overlay
 * Returns overlay image. Real backend would return the debug overlay image.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  if (!sessionId) {
    return Response.json({ message: 'Session ID required' }, { status: 400 });
  }
  // Return a minimal 1x1 transparent PNG as placeholder
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  return new Response(png, {
    headers: { 'Content-Type': 'image/png' },
  });
}
