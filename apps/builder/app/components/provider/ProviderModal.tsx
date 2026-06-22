// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T05 — first-open provider modal
// ─────────────────────────────────────────────────────────────────────────
//
// Lets the user pick how generation runs: on their local agent subscription
// (Claude Code / Codex, detected on this machine), on their own API key, or on
// the hosted key. Mirrors the UX of Riptide's first-run wizard — detected
// agents render as selectable cards (disabled + "not detected on PATH" when
// absent, version shown when present); degrade gracefully to API key / hosted
// when nothing is detected (e.g. a hosted deployment that can't spawn local
// CLIs). The byok key is posted to an HttpOnly server session, never stored in
// localStorage.

import { memo, useCallback, useEffect, useState } from 'react';
import { Dialog, DialogTitle } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';
import { type ProviderAgentId, type ProviderMode, type ProviderPreference } from '~/lib/provider-preference';

interface AgentProbe {
  id: ProviderAgentId;
  label: string;
  binary: string;
  recommended: boolean;
  detected: boolean;
  path: string | null;
  version: string | null;
}

const AGENT_TAGLINE: Record<ProviderAgentId, string> = {
  'claude-code': 'Runs your build on your Claude Code subscription.',
  codex: 'Runs your build on your Codex CLI subscription.',
};

interface ProviderModalProps {
  initial: ProviderPreference | null;
  onSave: (pref: ProviderPreference) => void;
  onClose?: () => void;
  dismissible?: boolean;
}

export const ProviderModal = memo(({ initial, onSave, onClose, dismissible }: ProviderModalProps) => {
  const [agents, setAgents] = useState<AgentProbe[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [mode, setMode] = useState<ProviderMode>(initial?.mode ?? 'agent-runtime');
  const [agentId, setAgentId] = useState<ProviderAgentId>(initial?.agentId ?? 'claude-code');
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAgentsLoading(true);
    fetch('/api/agents')
      .then((res) => res.json() as Promise<{ agents: AgentProbe[] }>)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setAgents(data.agents ?? []);
        // Default the agent selection to the first detected one.
        const firstDetected = data.agents?.find((a) => a.detected);
        if (firstDetected && !initial?.agentId) {
          setAgentId(firstDetected.id);
        }
        // If nothing is detected and the user hasn't already chosen
        // agent-runtime, steer the default to byok so the modal is usable.
        if (!firstDetected && !initial) {
          setMode('byok');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAgents([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAgentsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  useEffect(() => {
    fetch('/api/provider-key')
      .then((res) => res.json() as Promise<{ hasKey: boolean }>)
      .then((data) => setHasStoredKey(Boolean(data.hasKey)))
      .catch(() => {});
  }, []);

  const selectedAgent = agents.find((a) => a.id === agentId) ?? null;
  const anyAgentDetected = agents.some((a) => a.detected);

  const canSave =
    mode === 'cloud' ||
    (mode === 'byok' && (apiKey.trim().length > 0 || hasStoredKey)) ||
    (mode === 'agent-runtime' && Boolean(selectedAgent?.detected));

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      if (mode === 'byok' && apiKey.trim().length > 0) {
        // Stow the key in the HttpOnly server session; never persist it client-side.
        const res = await fetch('/api/provider-key', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        });
        if (!res.ok) {
          throw new Error('Could not save the API key. Try again.');
        }
      }

      const pref: ProviderPreference = mode === 'agent-runtime' ? { mode, agentId } : { mode };

      onSave(pref);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong saving your choice.');
    } finally {
      setSaving(false);
    }
  }, [mode, agentId, apiKey, onSave]);

  return (
    <Dialog
      className="max-w-[560px]"
      onBackdrop={dismissible ? onClose : undefined}
      onClose={dismissible ? onClose : undefined}
    >
      <DialogTitle>How should seeker.new build your app?</DialogTitle>

      <div className="px-5 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        <p className="text-sm text-[rgba(193,205,217,0.82)]">
          Generation can run on a coding agent already installed on your machine, on your own API key, or on the hosted
          key. You can change this anytime.
        </p>

        {/* agent-runtime */}
        <ProviderOption
          active={mode === 'agent-runtime'}
          title="Use a local agent subscription"
          subtitle="No API key needed — runs on a CLI you're already signed in to."
          onSelect={() => setMode('agent-runtime')}
        >
          {agentsLoading ? (
            <div className="text-xs text-bolt-elements-textTertiary py-2">Looking for installed agents…</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-1">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  tagline={AGENT_TAGLINE[agent.id] ?? agent.label}
                  selected={mode === 'agent-runtime' && agentId === agent.id}
                  onSelect={() => {
                    if (agent.detected) {
                      setMode('agent-runtime');
                      setAgentId(agent.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
          {!agentsLoading && !anyAgentDetected && (
            <div className="text-xs text-bolt-elements-textTertiary mt-2">
              No local agents detected on this machine. Use your API key or the hosted key instead.
            </div>
          )}
        </ProviderOption>

        {/* byok */}
        <ProviderOption
          active={mode === 'byok'}
          title="Use your own API key"
          subtitle={hasStoredKey ? 'A key is already saved for this session.' : 'Paste an Anthropic API key.'}
          onSelect={() => setMode('byok')}
        >
          {mode === 'byok' && (
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={hasStoredKey ? 'Saved — paste a new key to replace it' : 'sk-ant-…'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(8,11,16,0.9)] px-3 py-2 text-sm text-[rgba(232,240,247,0.96)] placeholder:text-[rgba(193,205,217,0.45)] focus:border-[rgba(159,212,239,0.5)] focus:outline-none"
            />
          )}
        </ProviderOption>

        {/* cloud */}
        <ProviderOption
          active={mode === 'cloud'}
          title="Use the hosted key"
          subtitle="The default — seeker.new runs generation for you."
          onSelect={() => setMode('cloud')}
        />

        {error && <div className="text-sm text-[rgba(255,140,136,0.96)]">{error}</div>}
      </div>

      <div className="px-5 py-4 border-t border-[rgba(255,255,255,0.1)] flex items-center justify-end gap-2">
        {dismissible && (
          <button
            className="inline-flex h-[35px] items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-transparent px-4 text-sm text-[rgba(232,240,247,0.96)] hover:bg-[rgba(255,255,255,0.05)]"
            onClick={onClose}
          >
            Cancel
          </button>
        )}
        <button
          className={classNames(
            'inline-flex h-[35px] items-center justify-center rounded-full bg-[rgba(207,244,229,0.92)] px-4 text-sm font-medium text-[#12211b] hover:opacity-90',
            { 'opacity-50 cursor-not-allowed': !canSave || saving },
          )}
          disabled={!canSave || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </Dialog>
  );
});

interface ProviderOptionProps {
  active: boolean;
  title: string;
  subtitle: string;
  onSelect: () => void;
  children?: React.ReactNode;
}

function ProviderOption({ active, title, subtitle, onSelect, children }: ProviderOptionProps) {
  return (
    <div
      className={classNames('cursor-pointer rounded-2xl border p-3 transition-colors', {
        'border-[rgba(159,212,239,0.45)] bg-[rgba(8,11,16,0.85)] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_22px_rgba(159,212,239,0.08)]':
          active,
        'border-[rgba(255,255,255,0.1)] bg-[rgba(15,18,24,0.42)] hover:border-[rgba(159,212,239,0.45)]': !active,
      })}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        <div
          className={classNames('mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border', {
            'border-[rgba(159,212,239,0.9)] bg-[rgba(159,212,239,0.9)]': active,
            'border-[rgba(255,255,255,0.16)]': !active,
          })}
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-[rgba(232,240,247,0.96)]">{title}</div>
          <div className="text-xs text-[rgba(193,205,217,0.7)]">{subtitle}</div>
        </div>
      </div>
      {children && <div className="pl-6">{children}</div>}
    </div>
  );
}

interface AgentCardProps {
  agent: AgentProbe;
  tagline: string;
  selected: boolean;
  onSelect: () => void;
}

function AgentCard({ agent, tagline, selected, onSelect }: AgentCardProps) {
  const disabled = !agent.detected;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={classNames('relative rounded-2xl border p-3 text-left transition-colors', {
        'border-[rgba(159,212,239,0.45)] bg-[rgba(8,11,16,0.9)]': selected,
        'border-[rgba(255,255,255,0.1)] bg-[rgba(15,18,24,0.42)]': !selected,
        'opacity-55 cursor-not-allowed': disabled,
        'hover:border-[rgba(159,212,239,0.45)]': !disabled && !selected,
      })}
    >
      {agent.recommended && agent.detected && (
        <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wide text-[rgba(159,212,239,0.9)]">
          Recommended
        </span>
      )}
      <div className="text-sm font-medium text-[rgba(232,240,247,0.96)]">{agent.label}</div>
      <div className="mt-0.5 text-xs text-[rgba(193,205,217,0.7)]">{tagline}</div>
      <div className="mt-1 font-mono text-[10px] text-[rgba(193,205,217,0.6)]">
        {agent.detected ? (agent.version ? `detected · v${agent.version}` : 'detected') : 'not detected on PATH'}
      </div>
    </button>
  );
}
