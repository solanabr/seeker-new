// Sprint 5 · T04 — LIVE harness. Spawns the real local `claude` CLI through the
// production adapter (claudeAdapter + adapterRunToDataStream) and asserts a real
// turn streams normalized deltas + AI-SDK data-stream bytes. Gated behind
// RUN_LIVE_AGENT=1 so CI never spawns a process or spends subscription budget.
//
//   RUN_LIVE_AGENT=1 pnpm exec vitest --run agents/adapters/live-turn.test.ts
//
// OFFICIAL SUBSCRIPTION AUTH ONLY — if `claude` is not logged in, the adapter
// surfaces login_required + the official URL; it never works around auth.
import { describe, expect, it } from 'vitest';
import { claudeAdapter } from './claude';
import { adapterRunToDataStream } from './data-stream';
import { probeAgent } from '../detect';
import type { AgentDelta } from './types';

const LIVE = process.env.RUN_LIVE_AGENT === '1';

describe.skipIf(!LIVE)('claudeAdapter — live local-Claude turn', () => {
  it('streams normalized deltas and AI-SDK data-stream bytes', async () => {
    const probe = await probeAgent('claude-code');
    expect(probe?.detected).toBe(true);
    const binaryPath = probe!.path!;

    const deltas: AgentDelta[] = [];
    const stream = adapterRunToDataStream(claudeAdapter, {
      binaryPath,
      systemPrompt: 'You are a concise product copywriter. Reply with the description text only.',
      prompt: 'User: In one sentence, describe a Solana Mobile payment app called PayFriend.',
      cwd: process.cwd(),
      model: 'claude-haiku-4-5',
      onDelta: (d) => deltas.push(d),
    });

    const decoder = new TextDecoder();
    let wire = '';
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      wire += decoder.decode(value);
    }

    // eslint-disable-next-line no-console
    console.log('normalized deltas:', JSON.stringify(deltas, null, 2));
    // eslint-disable-next-line no-console
    console.log('AI-SDK data-stream bytes:\n' + wire);

    // A text delta arrived and the wire carries a 0:"…" text part + a d:{…} finish.
    expect(deltas.some((d) => d.kind === 'text')).toBe(true);
    expect(wire).toMatch(/^0:"/m);
    expect(wire).toMatch(/\nd:\{"finishReason"/);
    // No stream error part (3:) on a healthy authenticated turn.
    expect(wire).not.toMatch(/\n3:/);
  }, 120_000);
});
