// Sprint 5 · T06 — server-side provider-config resolution.
// The trust boundary: the byok key comes from the session (never the body), and
// the agent-runtime absolute path is re-resolved server-side from the agentId
// (never trusted from the client). Detection + session are mocked — no spawn.
import { describe, expect, it, vi } from 'vitest';

const probeAgentMock = vi.hoisted(() => vi.fn());
const readByokKeyMock = vi.hoisted(() => vi.fn());

vi.mock('./agents/detect', () => ({ probeAgent: probeAgentMock }));
vi.mock('../provider-session', () => ({ readByokKey: readByokKeyMock }));

import { resolveServerProviderConfig, ProviderConfigError } from './resolve-provider-config';

const req = () => new Request('http://localhost/api/chat', { method: 'POST' });

describe('resolveServerProviderConfig', () => {
  it('returns undefined for cloud (managed-key default)', async () => {
    expect(await resolveServerProviderConfig(req(), { mode: 'cloud' })).toBeUndefined();
    expect(await resolveServerProviderConfig(req(), undefined)).toBeUndefined();
  });

  it('byok: reads the key from the session, not the request body', async () => {
    readByokKeyMock.mockReset().mockResolvedValue('sk-ant-session');
    const config = await resolveServerProviderConfig(req(), { mode: 'byok', model: 'claude-haiku-4-5' });
    expect(config).toEqual({ mode: 'byok', apiKey: 'sk-ant-session', model: 'claude-haiku-4-5' });
  });

  it('byok: throws a product-facing error when no key is stored', async () => {
    readByokKeyMock.mockReset().mockResolvedValue(undefined);
    await expect(resolveServerProviderConfig(req(), { mode: 'byok' })).rejects.toBeInstanceOf(ProviderConfigError);
  });

  it('agent-runtime: re-resolves the absolute path server-side from the agentId', async () => {
    probeAgentMock.mockReset().mockResolvedValue({
      id: 'claude-code',
      label: 'Claude Code',
      detected: true,
      path: '/home/user/.local/bin/claude',
      version: '2.1.185',
    });
    const config = await resolveServerProviderConfig(req(), { mode: 'agent-runtime', agentId: 'claude-code' });
    expect(config).toEqual({
      mode: 'agent-runtime',
      agentId: 'claude-code',
      binaryPath: '/home/user/.local/bin/claude',
      model: null,
    });
    expect(probeAgentMock).toHaveBeenCalledWith('claude-code');
  });

  it('agent-runtime: ignores any client-supplied path (only agentId is used)', async () => {
    probeAgentMock.mockReset().mockResolvedValue({
      id: 'claude-code',
      label: 'Claude Code',
      detected: true,
      path: '/trusted/server/path/claude',
      version: '2.1.185',
    });
    // A tampered body could carry an evil binaryPath; it must never reach spawn.
    const tampered = { mode: 'agent-runtime', agentId: 'claude-code', binaryPath: '/evil/rm' } as never;
    const config = await resolveServerProviderConfig(req(), tampered);
    expect(config).toMatchObject({ binaryPath: '/trusted/server/path/claude' });
  });

  it('agent-runtime: throws when the agent is not detected', async () => {
    probeAgentMock.mockReset().mockResolvedValue({ id: 'claude-code', label: 'Claude Code', detected: false, path: null });
    await expect(
      resolveServerProviderConfig(req(), { mode: 'agent-runtime', agentId: 'claude-code' }),
    ).rejects.toBeInstanceOf(ProviderConfigError);
  });

  it('agent-runtime: throws on an unknown agent id', async () => {
    await expect(
      resolveServerProviderConfig(req(), { mode: 'agent-runtime', agentId: 'nope' as never }),
    ).rejects.toBeInstanceOf(ProviderConfigError);
  });
});
