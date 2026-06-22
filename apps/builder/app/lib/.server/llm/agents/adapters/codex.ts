// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T04 — Codex adapter (registry slot, impl cut for this sprint)
// ─────────────────────────────────────────────────────────────────────────
//
// Sprint 5 ships Claude Code only; per the scope cuts the Codex stream-json
// parser is deliberately not implemented. This slot keeps the registry shape
// honest — `agent-runtime` can list a `codex` agent in detection, but selecting
// it returns a clear `internal` error until the parser lands. The intended
// invocation (for whoever fills this in) is:
//
//   codex exec --json --skip-git-repo-check [--model <id>] -
//
// with the prompt on stdin (the trailing `-`), parsing the `--json` event
// stream down to the same `AgentDelta` union the Claude adapter emits.
//
// OFFICIAL SUBSCRIPTION AUTH ONLY — never a reverse-engineered web session.

import type { AdapterRunInput, AdapterRunResult, AgentAdapter } from './types';

// The argv this adapter *would* build — exported so the shape is reviewable and
// the flag allowlist is documented even though run() is not yet wired.
const VALID_MODEL_RE = /^[A-Za-z0-9._-]+$/;

export function buildCodexArgv(opts: { model?: string | null } = {}): string[] {
  const args = ['exec', '--json', '--skip-git-repo-check'];
  if (opts.model && opts.model !== 'default' && VALID_MODEL_RE.test(opts.model)) {
    args.push('--model', opts.model);
  }
  args.push('-');
  return args;
}

export const codexAdapter: AgentAdapter = {
  agentId: 'codex',
  label: 'Codex',
  buildArgv(input) {
    return buildCodexArgv(input);
  },
  async run(_input: AdapterRunInput): Promise<AdapterRunResult> {
    return {
      sessionId: null,
      finalText: '',
      usage: null,
      costUsd: null,
      exitCode: null,
      error: {
        family: 'internal',
        message: 'the Codex adapter is not implemented in this build — choose Claude Code or an API key',
      },
    };
  },
};
