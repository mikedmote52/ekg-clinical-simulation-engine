import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || '';

/**
 * POST /api/ingest — proxy to FastAPI backend.
 */
export async function POST(request: NextRequest) {
  try {
    // If no backend configured, fall back to stub
    if (!BACKEND_URL) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return Response.json({ message: 'No file provided' }, { status: 400 });
      }
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return Response.json({ session_id: sessionId });
    }

    // Proxy to FastAPI backend
    const formData = await request.formData();
    const res = await fetch(`${BACKEND_URL}/api/ingest`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    return Response.json({ message }, { status: 500 });
  }
}
