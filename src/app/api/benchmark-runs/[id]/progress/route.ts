/**
 * GET /api/benchmark-runs/[id]/progress
 *
 * Server-Sent Events (SSE) endpoint for real-time benchmark progress.
 * Clients connect to this endpoint to receive live updates during benchmark execution.
 *
 * SSE Format:
 * - Clients send GET request with benchmark run ID
 * - Server holds connection open and sends events as they occur
 * - Events: progress, log, complete, error
 */

import { NextRequest } from 'next/server';
import { getEmitter } from '@/lib/realtime';

/**
 * Force dynamic rendering - this route needs to handle streaming
 */
export const dynamic = 'force-dynamic';

/**
 * GET handler for SSE endpoint
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: runId } = await params;

  console.info(`[SSE] New connection for benchmark run: ${runId}`);

  // Get the SSE emitter for this run
  const emitter = getEmitter(runId);

  // Create a ReadableStream for Server-Sent Events
  const stream = emitter.getStream();

  // Return SSE response with proper headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
