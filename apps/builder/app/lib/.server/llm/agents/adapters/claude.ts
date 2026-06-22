// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T04 — Claude Code adapter (official subscription auth only)
// ─────────────────────────────────────────────────────────────────────────
//
// Invocation (least-privilege flag set, locked in the T01 GO/NO-GO note §2):
//   claude --print - --output-format stream-json --verbose
//          [--system-prompt <prompt>] [--model <id>]
//
// Prompt is delivered via stdin (the `-` positional after `--print`). The bolt
// system prompt is delivered via `--system-prompt` (T01 GO/NO-GO §3.1: spawned
// `claude` carries its own coding-agent system prompt and refuses bare
// "echo this string" prompts as injection, so generation must be a real
// instruction). Output is parsed line-by-line as the documented stream-json
// events: system/init, assistant, result.
//
// `--dangerously-skip-permissions` is intentionally NOT used and NOT in the
// allowlist: a pure-text generation turn completes exit 0 under the default
// permission mode (the bolt turn emits `<boltArtifact>` *as text*; it never
// drives Claude Code's own host tools, so no permission prompt is reached).
//
// OFFICIAL SUBSCRIPTION AUTH ONLY — never a reverse-engineered web session.
// Clean-room for seeker.new (bolt.diy MIT lineage); promoted from the T01 spike.

import { runAgent } from './spawn';
import { classifyError } from './normalize';
import type { AdapterRunInput, AdapterRunResult, AgentAdapter, AgentDelta, AgentUsage } from './types';

const ALLOWED_FLAGS = new Set(['--print', '--output-format', '--verbose', '--model', '--system-prompt']);

const VALID_MODEL_RE = /^[A-Za-z0-9._-]+$/;

export function buildClaudeArgv(opts: { model?: string | null; systemPrompt?: string } = {}): string[] {
  const args = ['--print', '-', '--output-format', 'stream-json', '--verbose'];
  if (opts.systemPrompt && opts.systemPrompt.trim().length > 0) {
    args.push('--system-prompt', opts.systemPrompt);
  }
  if (opts.model && opts.model !== 'default' && VALID_MODEL_RE.test(opts.model)) {
    args.push('--model', opts.model);
  }
  return args;
}

/**
 * Defense-in-depth: every flag-shaped argv entry must be in ALLOWED_FLAGS
 * before we spawn. Throws on an unexpected flag so the run aborts pre-spawn.
 * Flag *values* (the strings that follow `--system-prompt` / `--model`) are not
 * flag-shaped and are skipped here; the model value is regex-validated in
 * buildClaudeArgv, and the system prompt is passed as a single argv entry
 * (shell:false → no word-splitting, no interpolation).
 */
export function assertClaudeFlagsAllowed(args: string[]): void {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('-')) {
      continue;
    }
    if (a === '-') {
      continue; // the stdin positional after --print, not a flag
    }
    // A value that follows --system-prompt may itself start with '-' (rare, but
    // a prompt could). Skip the entry immediately after a value-taking flag.
    const prev = args[i - 1];
    if (prev === '--system-prompt' || prev === '--model') {
      continue;
    }
    if (!ALLOWED_FLAGS.has(a)) {
      throw new Error(`claude adapter produced disallowed flag: ${a}`);
    }
  }
}

interface ParseState {
  sessionId: string | null;
  model: string;
  assistantTexts: string[];
  usage: AgentUsage | null;
  costUsd: number | null;
  finalResultText: string | null;
}

// Parse one stream-json line → push normalized deltas. Unknown event types
// (hook_*, rate_limit_event, …) are ignored defensively — the CLI emits far
// more than the three we read, and the set drifts across versions.
export function consumeLine(line: string, state: ParseState, onDelta: (d: AgentDelta) => void): void {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  let evt: Record<string, unknown>;
  try {
    evt = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return; // non-JSON noise on stdout — ignore
  }
  const type = asString(evt.type);

  if (type === 'system' && asString(evt.subtype) === 'init') {
    const id = asString(evt.session_id);
    if (id && id !== state.sessionId) {
      state.sessionId = id;
      onDelta({ kind: 'session', sessionId: id });
    }
    const model = asString(evt.model);
    if (model) {
      state.model = model;
    }
    return;
  }

  if (type === 'assistant') {
    const message = asObject(evt.message);
    const content = Array.isArray(message?.content) ? (message!.content as unknown[]) : [];
    for (const entry of content) {
      const block = asObject(entry);
      if (!block) {
        continue;
      }
      // Pure-text generation turn: only text blocks become deltas. tool_use
      // blocks are intentionally dropped (seeker.new's turn is text-only).
      if (asString(block.type) === 'text') {
        const text = asString(block.text);
        if (text) {
          state.assistantTexts.push(text);
          onDelta({ kind: 'text', text });
        }
      }
    }
    return;
  }

  if (type === 'result') {
    const usageObj = asObject(evt.usage);
    if (usageObj) {
      const usage: AgentUsage = {
        inputTokens: asNumber(usageObj.input_tokens) ?? 0,
        outputTokens: asNumber(usageObj.output_tokens) ?? 0,
      };
      state.usage = usage;
      onDelta({ kind: 'usage', ...usage });
    }
    const cost = asNumber(evt.total_cost_usd);
    if (cost !== null) {
      state.costUsd = cost;
      onDelta({ kind: 'cost', usd: cost });
    }
    const finalText = asString(evt.result);
    if (finalText) {
      state.finalResultText = finalText;
    }
  }
}

export const claudeAdapter: AgentAdapter = {
  agentId: 'claude-code',
  label: 'Claude Code',
  buildArgv(input) {
    return buildClaudeArgv(input);
  },
  async run(input: AdapterRunInput): Promise<AdapterRunResult> {
    const args = buildClaudeArgv({ model: input.model, systemPrompt: input.systemPrompt });
    try {
      assertClaudeFlagsAllowed(args);
    } catch (err) {
      return emptyResult({ family: 'internal', message: (err as Error).message });
    }

    const state: ParseState = {
      sessionId: null,
      model: '',
      assistantTexts: [],
      usage: null,
      costUsd: null,
      finalResultText: null,
    };

    let spawnResult;
    try {
      spawnResult = await runAgent({
        binaryPath: input.binaryPath,
        args,
        cwd: input.cwd,
        stdin: input.prompt,
        abortSignal: input.abortSignal,
        timeoutMs: input.timeoutMs,
        onStdoutLine: (line) => consumeLine(line, state, (d) => input.onDelta?.(d)),
      });
    } catch (err) {
      // runAgent throws only on the absolute-path guard.
      return emptyResult({ family: 'internal', message: (err as Error).message });
    }

    const finalText = state.finalResultText ?? state.assistantTexts.join('\n\n').trim();
    const error = classifyError({
      agentId: 'claude-code',
      exitCode: spawnResult.exitCode,
      signal: spawnResult.signal,
      stdoutTail: spawnResult.stdoutTail,
      stderrTail: spawnResult.stderrTail,
      spawnError: spawnResult.spawnError,
      aborted: spawnResult.aborted,
      timedOut: spawnResult.timedOut,
      finalText,
    });

    return {
      sessionId: state.sessionId,
      finalText,
      usage: state.usage,
      costUsd: state.costUsd,
      exitCode: spawnResult.exitCode,
      error,
    };
  },
};

function emptyResult(error: AdapterRunResult['error']): AdapterRunResult {
  return { sessionId: null, finalText: '', usage: null, costUsd: null, exitCode: null, error };
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
