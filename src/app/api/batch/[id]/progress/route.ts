/**
 * Batch Progress SSE Endpoint
 *
 * Real-time progress updates for batch runs
 */

import { NextRequest } from 'next/server';
import { getEmitter } from '@/lib/realtime/sse';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const emitter = getEmitter(id);
  const stream = emitter.getStream();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
