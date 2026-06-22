// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T04 — agent-runtime adapter types (shared, node-free)
// ─────────────────────────────────────────────────────────────────────────
//
// The normalized delta shape locked by the T01 GO/NO-GO note (§1, Layer A).
// Every CLI adapter parses *its own* stream-json wire format down to this
// union; downstream code (the data-stream encoder, the provider seam) never
// sees raw stream-json — only `AgentDelta`. This is what keeps
// `stream-text.ts` provider-agnostic.
//
// Clean-room for seeker.new (bolt.diy MIT lineage). The shape is *informed by*
// Riptide's adapter pattern, not copied — Riptide's union carries tool-use and
// cache-token deltas that seeker.new's pure-text generation turn drops.
//
// No `node:*` imports here so this file stays safe to reference from tests.

export type AgentId = 'claude-code' | 'codex';

export type AgentDelta =
  | { kind: 'session'; sessionId: string }
  | { kind: 'text'; text: string }
  | { kind: 'usage'; inputTokens: number; outputTokens: number }
  | { kind: 'cost'; usd: number };

export type AgentErrorFamily =
  | 'login_required'
  | 'rate_limited'
  | 'nonzero_exit'
  | 'spawn_failed'
  | 'internal';

export interface AgentError {
  family: AgentErrorFamily;
  message: string;
  /** Set only when family === 'login_required'. Official login URL only. */
  loginUrl?: string;
  /** Redacted stderr tail (home → ~). Never contains secrets. */
  raw?: string;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AdapterRunInput {
  /** Absolute path to the agent binary (from detection). Never a bare name. */
  binaryPath: string;
  /** The user-message content delivered to the CLI over stdin. */
  prompt: string;
  /** The bolt system prompt, mapped to the CLI's `--system-prompt` flag. */
  systemPrompt?: string;
  /** Spawn cwd; the caller anchors it. */
  cwd: string;
  /** Optional model id; validated by the adapter before it reaches argv. */
  model?: string | null;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
  /** Receive normalized deltas as they arrive (drives the data-stream bridge). */
  onDelta?: (delta: AgentDelta) => void;
}

export interface AdapterRunResult {
  sessionId: string | null;
  finalText: string;
  usage: AgentUsage | null;
  costUsd: number | null;
  exitCode: number | null;
  error: AgentError | null;
}

/**
 * One interface every official-runtime CLI adapter implements. `buildArgv` is
 * pure (no spawn) so the flag allowlist can be unit-tested without a process;
 * `run` spawns the CLI headless and streams normalized deltas.
 */
export interface AgentAdapter {
  agentId: AgentId;
  label: string;
  /** Build the headless argv. The prompt is NOT here — it is delivered via stdin. */
  buildArgv(input: { model?: string | null; systemPrompt?: string }): string[];
  run(input: AdapterRunInput): Promise<AdapterRunResult>;
}
