// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T06 — resolve the client's provider choice into a server config
// ─────────────────────────────────────────────────────────────────────────
//
// The client persists only a non-secret preference (`{ mode, agentId, model }`)
// and sends it on every turn. This module turns that into the `ProviderConfig`
// the generation seam consumes, applying the trust boundary:
//
//   • byok          — the API key is read from the HttpOnly server session,
//                     NEVER from the request body (the client never sends it).
//   • agent-runtime — the absolute binary path is re-resolved SERVER-SIDE via
//                     detection from the agentId. The client never supplies a
//                     spawnable path, so a tampered body can't point the spawn
//                     at an arbitrary executable.
//   • cloud         — no config; the seam falls back to the managed env key.
//
// On a misconfiguration (byok with no stored key, agent not installed) we throw
// a `ProviderConfigError` whose message is product-facing and safe to surface.

import { probeAgent } from './agents/detect';
import { isSupportedAgentId } from './agents/adapters';
import { readByokKey } from '../provider-session';
import type { ProviderConfig } from './provider';
import type { ProviderPreference } from '~/lib/provider-preference';

export class ProviderConfigError extends Error {}

/**
 * Resolve the persisted client preference into a server `ProviderConfig`.
 * Returns `undefined` for the `cloud` default (the existing managed-key path).
 */
export async function resolveServerProviderConfig(
  request: Request,
  preference: ProviderPreference | undefined,
): Promise<ProviderConfig | undefined> {
  const mode = preference?.mode ?? 'cloud';

  if (mode === 'cloud') {
    return undefined;
  }

  if (mode === 'byok') {
    const apiKey = await readByokKey(request);
    if (!apiKey) {
      throw new ProviderConfigError(
        'No API key on file. Open the provider menu in the header and paste your Anthropic API key.',
      );
    }
    return { mode: 'byok', apiKey, model: preference?.model ?? null };
  }

  // agent-runtime
  const agentId = preference?.agentId;
  if (!agentId || !isSupportedAgentId(agentId)) {
    throw new ProviderConfigError('Select a local agent in the provider menu before generating.');
  }

  const probe = await probeAgent(agentId);
  if (!probe?.detected || !probe.path) {
    throw new ProviderConfigError(
      `${probe?.label ?? agentId} is not detected on this machine. Install/sign in to it, or switch to your API key or the hosted key.`,
    );
  }

  return {
    mode: 'agent-runtime',
    agentId,
    binaryPath: probe.path,
    model: preference?.model ?? null,
  };
}
