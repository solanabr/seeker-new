// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T02 — provider abstraction seam (cloud | byok | agent-runtime)
// ─────────────────────────────────────────────────────────────────────────
//
// PRD §8.5: generation runs behind ONE provider interface with three modes so
// the same build pipeline works hosted, on the user's key, or on their local
// agent subscription:
//
//   • cloud         — our managed env key (the hosted seeker.new). AI SDK.
//   • byok          — the user's own API key.                       AI SDK.
//   • agent-runtime — the user's local agent subscription (Claude Code / Codex)
//                     spawned headless via the official CLI.        adapter.
//
// The seam contract is the one locked in the T01 GO/NO-GO note (§1, Layer B):
// every provider yields a value exposing `toAIStream(): ReadableStream<Uint8Array>`
// in the AI-SDK data-stream protocol the builder UI already consumes. So
// `stream-text.ts` / `switchable-stream.ts` / `api.chat.ts` stay
// provider-agnostic downstream — they only ever call `.toAIStream()`.
//
//   • cloud / byok  → the AI SDK `streamText(...)` result (already has it).
//   • agent-runtime → `adapterRunToDataStream(...)`, wrapped as `{ toAIStream }`.
//
// OFFICIAL SUBSCRIPTION AUTH ONLY for agent-runtime — no secret is logged, and
// the agent path is spawned with shell:false / absolute path / flag allowlist
// inside the adapter. byok keys are passed through, never persisted here.

import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getAPIKey } from './api-key';
import { getAnthropicModel } from './model';
import { adapterRunToDataStream, getAdapter, type AgentId } from './agents/adapters';
import type { Messages, StreamingOptions } from './stream-text';

export type ProviderMode = 'cloud' | 'byok' | 'agent-runtime';

export interface ProviderConfig {
  mode: ProviderMode;
  /** byok: the user-supplied API key. Never logged, never persisted here. */
  apiKey?: string;
  /** agent-runtime: which official CLI to spawn. */
  agentId?: AgentId;
  /** agent-runtime: the absolute binary path resolved by detection (T03). */
  binaryPath?: string;
  /** Optional model id override (validated downstream). */
  model?: string | null;
}

/** The locked T01 seam contract. */
export interface GenerationStream {
  toAIStream(): ReadableStream<Uint8Array>;
}

export interface GenerationInput {
  messages: Messages;
  /** The effective system prompt (bolt system or a per-turn override). */
  system: string;
  maxTokens: number;
  /** Spawn cwd for agent-runtime; ignored by the AI SDK modes. */
  cwd: string;
  abortSignal?: AbortSignal;
  /** AI-SDK passthrough (onFinish, toolChoice, …); ignored by agent-runtime. */
  sdkOptions?: Omit<StreamingOptions, 'system' | 'maxTokens'>;
}

export interface Provider {
  readonly mode: ProviderMode;
  /**
   * Whether this provider supports the AI SDK multi-segment continuation loop
   * (`onFinish` → re-stream when finishReason === 'length'). True for the SDK
   * modes; false for agent-runtime, which returns the whole turn in one shot.
   */
  readonly supportsContinuation: boolean;
  generate(input: GenerationInput): Promise<GenerationStream>;
}

const ANTHROPIC_BETA_HEADER = 'max-tokens-3-5-sonnet-2024-07-15';

/**
 * Resolve the provider for a generation turn. With no config (the existing
 * code path) this is `cloud` on the managed env key — the env-key path keeps
 * working exactly as before. T05/T06 plumb the persisted user choice in here.
 */
export function resolveProvider(env: Env, config?: ProviderConfig): Provider {
  const mode = config?.mode ?? 'cloud';

  if (mode === 'agent-runtime') {
    return createAgentRuntimeProvider(config ?? { mode });
  }

  const apiKey = mode === 'byok' ? requireApiKey(config?.apiKey) : getAPIKey(env);
  if (!apiKey) {
    throw new Error(
      mode === 'byok'
        ? 'byok provider requires an API key'
        : 'cloud provider requires a managed ANTHROPIC_API_KEY',
    );
  }
  return createSdkProvider(mode, apiKey, config?.model ?? null);
}

function createSdkProvider(mode: 'cloud' | 'byok', apiKey: string, model: string | null): Provider {
  return {
    mode,
    supportsContinuation: true,
    async generate(input) {
      return _streamText({
        model: getAnthropicModel(apiKey, model ?? undefined),
        system: input.system,
        maxTokens: input.maxTokens,
        headers: { 'anthropic-beta': ANTHROPIC_BETA_HEADER },
        messages: convertToCoreMessages(input.messages),
        abortSignal: input.abortSignal,
        ...input.sdkOptions,
      });
    },
  };
}

function createAgentRuntimeProvider(config: ProviderConfig): Provider {
  return {
    mode: 'agent-runtime',
    supportsContinuation: false,
    async generate(input) {
      const adapter = getAdapter(config.agentId ?? '');
      if (!adapter) {
        throw new Error(`unknown agent-runtime agent: ${config.agentId ?? '(none)'}`);
      }
      if (!config.binaryPath) {
        throw new Error('agent-runtime requires a resolved absolute binary path (run detection first)');
      }
      const stream = adapterRunToDataStream(adapter, {
        binaryPath: config.binaryPath,
        prompt: renderConversation(input.messages),
        // The bolt system prompt is delivered as a real instruction via the
        // CLI's --system-prompt flag (T01 GO/NO-GO §3.1), not the user message.
        systemPrompt: input.system,
        cwd: input.cwd,
        model: config.model,
        abortSignal: input.abortSignal,
      });
      return { toAIStream: () => stream };
    },
  };
}

function requireApiKey(apiKey: string | undefined): string {
  if (!apiKey) {
    throw new Error('byok provider requires an API key');
  }
  return apiKey;
}

/**
 * Flatten the conversation into a single stdin prompt for an agent CLI. The
 * system prompt is delivered separately via --system-prompt, so this carries
 * only the user/assistant turns.
 */
function renderConversation(messages: Messages): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}
