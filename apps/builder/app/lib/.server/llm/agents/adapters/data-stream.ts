// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T04 — normalized deltas → AI-SDK data-stream bytes
// ─────────────────────────────────────────────────────────────────────────
//
// The load-bearing bridge proven in the T01 spike. The output ReadableStream
// is byte-identical in protocol to what `streamWorkbenchArtifact` /
// `streamTextMessage` already emit in `api.chat.ts`, and to the AI SDK's
// `result.toAIStream()`. So the builder consumes an agent-runtime turn with
// ZERO client or transport change.
//
//   text   → `0:${JSON.stringify(text)}\n`
//   finish → `d:${JSON.stringify({ finishReason, usage })}\n`
//   error  → `3:${JSON.stringify(message)}\n`   // login_required carries the URL
//
// `session` / `cost` deltas are captured (telemetry/limits) but NOT emitted —
// the client protocol has no slot for them.

import type { AdapterRunInput, AgentAdapter, AgentUsage } from './types';

export function dataStreamPartText(text: string): string {
  return `0:${JSON.stringify(text)}\n`;
}

export function dataStreamPartFinish(usage: AgentUsage | null, finishReason = 'stop'): string {
  return `d:${JSON.stringify({
    finishReason,
    usage: { promptTokens: usage?.inputTokens ?? 0, completionTokens: usage?.outputTokens ?? 0 },
  })}\n`;
}

export function dataStreamPartError(message: string): string {
  return `3:${JSON.stringify(message)}\n`;
}

/**
 * Spawn an agent adapter and return a ReadableStream in the AI-SDK data-stream
 * protocol. This is the value the agent-runtime provider's `.toAIStream()`
 * returns — interchangeable with the SDK result at the `api.chat.ts` call site
 * (`stream.switchSource(result.toAIStream())`).
 */
export function adapterRunToDataStream(adapter: AgentAdapter, input: AdapterRunInput): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let usage: AgentUsage | null = null;
      const result = await adapter.run({
        ...input,
        onDelta: (d) => {
          input.onDelta?.(d);
          if (d.kind === 'text') {
            controller.enqueue(encoder.encode(dataStreamPartText(d.text)));
          } else if (d.kind === 'usage') {
            usage = { inputTokens: d.inputTokens, outputTokens: d.outputTokens };
          }
        },
      });

      if (result.error && result.finalText.length === 0) {
        // Surface auth/rate/exit failures into the stream instead of silently
        // closing. login_required carries the official login URL.
        const suffix =
          result.error.family === 'login_required' && result.error.loginUrl ? ` (${result.error.loginUrl})` : '';
        controller.enqueue(encoder.encode(dataStreamPartError(`[${result.error.family}] ${result.error.message}${suffix}`)));
      }

      controller.enqueue(encoder.encode(dataStreamPartFinish(usage ?? result.usage, result.error ? 'error' : 'stop')));
      controller.close();
    },
  });
}
