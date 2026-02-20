import { NextRequest } from 'next/server';

/**
 * Stub for backend /api/ingest.
 * Replace with your real backend or proxy to it.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return Response.json({ message: 'No file provided' }, { status: 400 });
    }
    // Stub: return a mock session_id. Real backend would process the file.
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return Response.json({ session_id: sessionId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    return Response.json({ message }, { status: 500 });
  }
}
