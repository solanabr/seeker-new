// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T04 — adapter registry
// ─────────────────────────────────────────────────────────────────────────
//
// Claude Code is the wired adapter; `codex` is a registry slot whose run() is
// not implemented this sprint (see codex.ts). Callers resolve an adapter by id
// and get `null` for any unsupported agent.

import { claudeAdapter } from './claude';
import { codexAdapter } from './codex';
import type { AgentAdapter, AgentId } from './types';

const REGISTRY: Record<AgentId, AgentAdapter> = {
  'claude-code': claudeAdapter,
  codex: codexAdapter,
};

export function getAdapter(agentId: string): AgentAdapter | null {
  return (REGISTRY as Record<string, AgentAdapter | undefined>)[agentId] ?? null;
}

export function isSupportedAgentId(agentId: string): agentId is AgentId {
  return agentId === 'claude-code' || agentId === 'codex';
}

export { claudeAdapter } from './claude';
export { codexAdapter } from './codex';
export { adapterRunToDataStream } from './data-stream';
export type { AgentAdapter, AgentId, AgentDelta, AgentError, AdapterRunInput, AdapterRunResult } from './types';
