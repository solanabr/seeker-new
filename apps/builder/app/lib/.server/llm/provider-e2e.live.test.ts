// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T06 — END-TO-END live harness through the real provider seam
// ─────────────────────────────────────────────────────────────────────────
//
// Drives the production `streamText(...)` generation entry — the exact seam
// `api.chat.ts` calls — for two modes and captures the AI-SDK data-stream bytes
// the builder UI consumes. This proves R5.1/R5.2: one generation entry honors
// the chosen provider, and both modes stream identically.
//
//   agent-runtime (local Claude Code, NO ANTHROPIC_API_KEY):
//     RUN_LIVE_AGENT=1 pnpm exec vitest --run provider-e2e.live
//
//   byok (user-supplied key, through the same seam):
//     RUN_LIVE_BYOK=1 ANTHROPIC_API_KEY=sk-ant-... pnpm exec vitest --run provider-e2e.live
//
// OFFICIAL SUBSCRIPTION AUTH ONLY for agent-runtime — if `claude` is not signed
// in, the seam surfaces login_required + the official URL; it never works around
// auth. The byok key is read from the process env here only to exercise the seam.

import { describe, expect, it } from 'vitest';
import { streamText, type Messages } from './stream-text';
import { probeAgent } from './agents/detect';
import type { ProviderConfig } from './provider';

const RUN_AGENT = process.env.RUN_LIVE_AGENT === '1';
const RUN_BYOK = process.env.RUN_LIVE_BYOK === '1' && Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM = 'You are a concise product copywriter for a Solana mobile app builder. Reply with the requested text only, no preamble.';
const MESSAGES: Messages = [
  { role: 'user', content: 'In one sentence, describe a Solana Mobile payments app called PayFriend.' },
];

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let wire = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    wire += decoder.decode(value);
  }
  return wire;
}

describe.skipIf(!RUN_AGENT)('streamText seam — agent-runtime (local Claude, no API key)', () => {
  it('routes the turn to the spawned CLI and streams AI-SDK data-stream bytes', async () => {
    expect(process.env.ANTHROPIC_API_KEY, 'this run must have NO ANTHROPIC_API_KEY').toBeFalsy();

    const probe = await probeAgent('claude-code');
    expect(probe?.detected, 'claude must be installed + signed in').toBe(true);

    const config: ProviderConfig = {
      mode: 'agent-runtime',
      agentId: 'claude-code',
      binaryPath: probe!.path!,
      model: 'claude-haiku-4-5',
    };

    const result = await streamText(MESSAGES, {} as Env, { system: SYSTEM }, config);
    const wire = await drain(result.toAIStream());

    // eslint-disable-next-line no-console
    console.log('\n=== agent-runtime (no API key) — AI-SDK data-stream ===\n' + wire);

    expect(wire).toMatch(/^0:"/m); // at least one text part
    expect(wire).toMatch(/\nd:\{"finishReason"/); // a finish part
    expect(wire).not.toMatch(/\n3:/); // no stream error on a healthy authed turn
  }, 120_000);
});

describe.skipIf(!RUN_BYOK)('streamText seam — byok (user-supplied key)', () => {
  it('routes the turn to the AI SDK with the passed key and streams the same protocol', async () => {
    const config: ProviderConfig = {
      mode: 'byok',
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: 'claude-haiku-4-5',
    };

    const result = await streamText(MESSAGES, {} as Env, { system: SYSTEM }, config);
    const wire = await drain(result.toAIStream());

    // eslint-disable-next-line no-console
    console.log('\n=== byok (user key) — AI-SDK data-stream ===\n' + wire);

    expect(wire).toMatch(/0:"/); // text part(s)
    expect(wire).not.toMatch(/\n3:/); // no stream error
  }, 120_000);
});
