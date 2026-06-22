// Sprint 5 · T02 — provider-resolution unit tests over all three modes.
// No network, no spawn: the AI SDK and the agent adapter are mocked so we
// assert resolution + the locked `.toAIStream()` seam contract only.
import { describe, expect, it, vi } from 'vitest';

const streamTextMock = vi.hoisted(() => vi.fn());
const getAdapterMock = vi.hoisted(() => vi.fn());
const adapterRunToDataStreamMock = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  streamText: streamTextMock,
  convertToCoreMessages: (m: unknown) => m,
}));

vi.mock('./agents/adapters', () => ({
  getAdapter: getAdapterMock,
  adapterRunToDataStream: adapterRunToDataStreamMock,
}));

// Read the key off the passed env only, so the test does not depend on the
// dev shell's ANTHROPIC_API_KEY.
vi.mock('./api-key', () => ({
  getAPIKey: (env: { ANTHROPIC_API_KEY?: string }) => env?.ANTHROPIC_API_KEY,
}));

import { resolveProvider, type GenerationInput } from './provider';

const ENV = { ANTHROPIC_API_KEY: 'managed-env-key' } as unknown as Env;

function genInput(): GenerationInput {
  return {
    messages: [{ role: 'user', content: 'Build PayFriend' }],
    system: 'SYSTEM',
    maxTokens: 8192,
    cwd: '/tmp/project',
  };
}

describe('resolveProvider — cloud (managed env key, the existing path)', () => {
  it('defaults to cloud and streams through the AI SDK with the env key', async () => {
    streamTextMock.mockReset().mockReturnValue({ toAIStream: () => new ReadableStream() });

    const provider = resolveProvider(ENV);
    expect(provider.mode).toBe('cloud');
    expect(provider.supportsContinuation).toBe(true);

    const result = await provider.generate(genInput());
    expect(typeof result.toAIStream).toBe('function');
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    // The bolt system prompt + messages reach the SDK call.
    expect(streamTextMock.mock.calls[0][0]).toMatchObject({ system: 'SYSTEM' });
  });

  it('throws when no managed key is configured', () => {
    expect(() => resolveProvider({} as unknown as Env, { mode: 'cloud' })).toThrow(/managed/i);
  });
});

describe('resolveProvider — byok (user-supplied key)', () => {
  it('streams through the AI SDK using the passed key', async () => {
    streamTextMock.mockReset().mockReturnValue({ toAIStream: () => new ReadableStream() });

    const provider = resolveProvider(ENV, { mode: 'byok', apiKey: 'user-key' });
    expect(provider.mode).toBe('byok');
    expect(provider.supportsContinuation).toBe(true);

    const result = await provider.generate(genInput());
    expect(typeof result.toAIStream).toBe('function');
    expect(streamTextMock).toHaveBeenCalledTimes(1);
  });

  it('throws when byok is selected without a key', () => {
    expect(() => resolveProvider(ENV, { mode: 'byok' })).toThrow(/api key/i);
  });
});

describe('resolveProvider — agent-runtime (local subscription, no SDK)', () => {
  it('resolves to the adapter bridge and never calls the AI SDK', async () => {
    streamTextMock.mockReset();
    const fakeStream = new ReadableStream<Uint8Array>();
    getAdapterMock.mockReset().mockReturnValue({ agentId: 'claude-code', label: 'Claude Code' });
    adapterRunToDataStreamMock.mockReset().mockReturnValue(fakeStream);

    const provider = resolveProvider(ENV, {
      mode: 'agent-runtime',
      agentId: 'claude-code',
      binaryPath: '/home/user/.local/bin/claude',
    });
    expect(provider.mode).toBe('agent-runtime');
    // agent-runtime returns the whole turn in one shot — no continuation loop.
    expect(provider.supportsContinuation).toBe(false);

    const result = await provider.generate(genInput());
    expect(result.toAIStream()).toBe(fakeStream);
    expect(streamTextMock).not.toHaveBeenCalled();

    // The system prompt is delivered via --system-prompt, not the stdin prompt.
    const passed = adapterRunToDataStreamMock.mock.calls[0][1];
    expect(passed.systemPrompt).toBe('SYSTEM');
    expect(passed.binaryPath).toBe('/home/user/.local/bin/claude');
    expect(passed.prompt).toContain('Build PayFriend');
  });

  it('throws on an unknown agent id', async () => {
    getAdapterMock.mockReset().mockReturnValue(null);
    const provider = resolveProvider(ENV, { mode: 'agent-runtime', agentId: 'claude-code', binaryPath: '/abs/claude' });
    await expect(provider.generate(genInput())).rejects.toThrow(/unknown agent-runtime/i);
  });

  it('throws when the binary path is missing (detection must run first)', async () => {
    getAdapterMock.mockReset().mockReturnValue({ agentId: 'claude-code', label: 'Claude Code' });
    const provider = resolveProvider(ENV, { mode: 'agent-runtime', agentId: 'claude-code' });
    await expect(provider.generate(genInput())).rejects.toThrow(/binary path/i);
  });
});
