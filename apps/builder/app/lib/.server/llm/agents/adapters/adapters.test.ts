// Sprint 5 · T04 — adapter unit tests. No network, no spawn: argv shape, the
// flag allowlist, stream-json parse, error classification, and the data-stream
// encoder. The real local-Claude turn is exercised separately (live harness).
import { describe, expect, it } from 'vitest';
import { assertClaudeFlagsAllowed, buildClaudeArgv, claudeAdapter, consumeLine } from './claude';
import { codexAdapter } from './codex';
import { getAdapter, isSupportedAgentId } from './index';
import { classifyError, loginUrlFor, redact } from './normalize';
import { dataStreamPartError, dataStreamPartFinish, dataStreamPartText } from './data-stream';
import type { AgentDelta } from './types';

describe('buildClaudeArgv — least-privilege flag set', () => {
  it('emits headless stream-json flags + the stdin positional, no skip-permissions', () => {
    expect(buildClaudeArgv()).toEqual(['--print', '-', '--output-format', 'stream-json', '--verbose']);
  });

  it('delivers the bolt system prompt via --system-prompt', () => {
    const argv = buildClaudeArgv({ systemPrompt: 'You are the bolt generator.' });
    expect(argv).toContain('--system-prompt');
    expect(argv[argv.indexOf('--system-prompt') + 1]).toBe('You are the bolt generator.');
  });

  it('appends a valid --model but drops injection-shaped model strings', () => {
    expect(buildClaudeArgv({ model: 'claude-haiku-4-5' })).toContain('claude-haiku-4-5');
    expect(buildClaudeArgv({ model: '; rm -rf /' })).not.toContain('--model');
    expect(buildClaudeArgv({ model: 'default' })).not.toContain('--model');
  });

  it('never contains --dangerously-skip-permissions', () => {
    expect(buildClaudeArgv({ model: 'claude-haiku-4-5' })).not.toContain('--dangerously-skip-permissions');
  });
});

describe('assertClaudeFlagsAllowed — defense-in-depth before spawn', () => {
  it('accepts the built argv (incl. a system prompt that happens to start with a dash)', () => {
    expect(() => assertClaudeFlagsAllowed(buildClaudeArgv({ systemPrompt: '-weird but allowed as a value' }))).not.toThrow();
    expect(() => assertClaudeFlagsAllowed(buildClaudeArgv({ model: 'claude-haiku-4-5' }))).not.toThrow();
  });

  it('rejects an unexpected flag injected into argv', () => {
    expect(() => assertClaudeFlagsAllowed(['--print', '-', '--dangerously-skip-permissions'])).toThrow(/disallowed flag/);
    expect(() => assertClaudeFlagsAllowed(['--print', '-', '--allowedTools', 'Bash'])).toThrow(/disallowed flag/);
  });
});

describe('claudeAdapter.run — pre-spawn guards', () => {
  it('refuses a relative binary path (absolute-path contract)', async () => {
    const result = await claudeAdapter.run({ binaryPath: 'claude', prompt: 'hi', cwd: '/tmp' });
    expect(result.error?.family).toBe('internal');
    expect(result.error?.message).toMatch(/absolute/);
    expect(result.exitCode).toBeNull();
  });
});

describe('consumeLine — stream-json → normalized deltas', () => {
  it('parses system/init, assistant text, and result usage/cost', () => {
    const deltas: AgentDelta[] = [];
    const state = { sessionId: null, model: '', assistantTexts: [], usage: null, costUsd: null, finalResultText: null };
    consumeLine(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'sess-1', model: 'claude-haiku-4-5' }), state, (d) => deltas.push(d));
    consumeLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'PayFriend' }] } }), state, (d) => deltas.push(d));
    consumeLine(JSON.stringify({ type: 'result', usage: { input_tokens: 10, output_tokens: 3 }, total_cost_usd: 0.01 }), state, (d) => deltas.push(d));

    expect(deltas).toEqual([
      { kind: 'session', sessionId: 'sess-1' },
      { kind: 'text', text: 'PayFriend' },
      { kind: 'usage', inputTokens: 10, outputTokens: 3 },
      { kind: 'cost', usd: 0.01 },
    ]);
  });

  it('drops tool_use blocks (pure-text generation turn) and ignores non-JSON noise', () => {
    const deltas: AgentDelta[] = [];
    const state = { sessionId: null, model: '', assistantTexts: [], usage: null, costUsd: null, finalResultText: null };
    consumeLine('not json at all', state, (d) => deltas.push(d));
    consumeLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] } }), state, (d) => deltas.push(d));
    expect(deltas).toEqual([]);
  });
});

describe('classifyError — login_required surfaces the official URL', () => {
  it('classifies an unauthenticated claude run as login_required with the official login URL', () => {
    const err = classifyError({
      agentId: 'claude-code',
      exitCode: 1,
      signal: null,
      stdoutTail: '',
      stderrTail: 'Invalid API key · Please run `claude login`',
      spawnError: null,
      aborted: false,
      timedOut: false,
      finalText: '',
    });
    expect(err?.family).toBe('login_required');
    expect(err?.loginUrl).toBe('https://claude.ai/login');
  });

  it('classifies a rate-limit message and a clean exit', () => {
    const rl = classifyError({
      agentId: 'claude-code',
      exitCode: 1,
      signal: null,
      stdoutTail: '',
      stderrTail: 'Claude usage limit reached',
      spawnError: null,
      aborted: false,
      timedOut: false,
      finalText: '',
    });
    expect(rl?.family).toBe('rate_limited');

    const ok = classifyError({
      agentId: 'claude-code',
      exitCode: 0,
      signal: null,
      stdoutTail: '',
      stderrTail: '',
      spawnError: null,
      aborted: false,
      timedOut: false,
      finalText: 'all good',
    });
    expect(ok).toBeNull();
  });

  it('official login URLs are the only claude.ai / openai reference', () => {
    expect(loginUrlFor('claude-code')).toBe('https://claude.ai/login');
    expect(loginUrlFor('codex')).toBe('https://platform.openai.com/login');
  });

  it('redacts the home directory from raw stderr', () => {
    const home = process.env.HOME ?? '';
    if (home) {
      expect(redact(`${home}/.config/secret`)).toBe('~/.config/secret');
    }
  });
});

describe('data-stream encoder — matches api.chat.ts wire format', () => {
  it('encodes text / finish / error parts', () => {
    expect(dataStreamPartText('hello "world"')).toBe('0:"hello \\"world\\""\n');
    expect(dataStreamPartFinish({ inputTokens: 10, outputTokens: 3 })).toBe(
      'd:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":3}}\n',
    );
    expect(dataStreamPartError('login required')).toBe('3:"login required"\n');
  });
});

describe('adapter registry', () => {
  it('resolves the claude adapter and the codex slot, null otherwise', () => {
    expect(getAdapter('claude-code')).toBe(claudeAdapter);
    expect(getAdapter('codex')).toBe(codexAdapter);
    expect(getAdapter('gemini')).toBeNull();
    expect(isSupportedAgentId('claude-code')).toBe(true);
    expect(isSupportedAgentId('gemini')).toBe(false);
  });

  it('the codex slot returns a clear not-implemented error rather than spawning', async () => {
    const result = await codexAdapter.run({ binaryPath: '/abs/codex', prompt: 'hi', cwd: '/tmp' });
    expect(result.error?.family).toBe('internal');
    expect(result.error?.message).toMatch(/not implemented/i);
  });
});
