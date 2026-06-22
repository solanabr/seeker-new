// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T05 — persisted provider choice (client-safe, no `.server` deps)
// ─────────────────────────────────────────────────────────────────────────
//
// PRD §8.5 / BL-10: the first-open modal lets the user run generation on the
// hosted key (`cloud`), their own API key (`byok`), or their local agent
// subscription (`agent-runtime`). This module is the single source of truth for
// that choice on the client. It persists ONLY non-secret fields:
//
//   • mode      — which provider runs the turn
//   • agentId   — agent-runtime: which official CLI (resolved to an absolute
//                 path SERVER-SIDE at generation time; the client never sends a
//                 path to spawn)
//   • model     — optional model id override
//
// The byok API key is NEVER stored here. It is posted to an HttpOnly server
// session (`/api/provider-key`) so it never lands in localStorage in plaintext
// and is never readable from JS. See `app/lib/.server/provider-session.ts`.

export type ProviderMode = 'cloud' | 'byok' | 'agent-runtime';
export type ProviderAgentId = 'claude-code' | 'codex';

export interface ProviderPreference {
  mode: ProviderMode;
  /** agent-runtime only — which official CLI to spawn. */
  agentId?: ProviderAgentId;
  /** optional model id override (validated downstream). */
  model?: string | null;
}

const STORAGE_KEY = 'seeker.new:provider';

/** Fired on the window after a successful save so other islands can react. */
export const PROVIDER_CHANGED_EVENT = 'seeker:provider-changed';

export function readProviderPreference(): ProviderPreference | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ProviderPreference>;
    if (parsed.mode !== 'cloud' && parsed.mode !== 'byok' && parsed.mode !== 'agent-runtime') {
      return null;
    }
    const pref: ProviderPreference = { mode: parsed.mode };
    if (parsed.agentId === 'claude-code' || parsed.agentId === 'codex') {
      pref.agentId = parsed.agentId;
    }
    if (typeof parsed.model === 'string') {
      pref.model = parsed.model;
    }
    return pref;
  } catch {
    return null;
  }
}

export function writeProviderPreference(pref: ProviderPreference): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
    window.dispatchEvent(new CustomEvent(PROVIDER_CHANGED_EVENT, { detail: pref }));
  } catch {
    // Storage may be unavailable (private mode / quota). The in-memory choice
    // still drives this session; it just won't survive a reload.
  }
}

export function clearProviderPreference(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(PROVIDER_CHANGED_EVENT, { detail: null }));
  } catch {
    // no-op
  }
}

/** Short, product-facing label for the active provider (header chip, etc.). */
export function providerLabel(pref: ProviderPreference | null): string {
  if (!pref) {
    return 'Not set';
  }
  switch (pref.mode) {
    case 'cloud':
      return 'Hosted';
    case 'byok':
      return 'Your API key';
    case 'agent-runtime':
      return pref.agentId === 'codex' ? 'Codex subscription' : 'Claude Code subscription';
  }
}
