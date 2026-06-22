// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T03 — local agent CLI detection
// ─────────────────────────────────────────────────────────────────────────
//
// Probe the official agent CLIs the first-open modal offers (Claude Code,
// Codex). Detection has to survive the builder being launched from a context
// with a stripped PATH — e.g. a desktop launcher that never sourced the user's
// shell rc, so version managers like mise/asdf/nvm haven't installed their shim
// directories. Three layers in order:
//
//   1. The in-process PATH (cheap, exact).
//   2. A small allow-list of common install locations.
//   3. The user's login shell via `$SHELL -lic 'command -v <bin>'`, which fully
//      sources the interactive PATH. (Cuttable per the spec to layers 1–2.)
//
// Then a `--version` probe against the resolved absolute path.
//
// SAFETY: shell:false everywhere a binary is run; the only `$SHELL` invocation
// passes a single-quoted binary name we control (never user input). No secret
// is read or logged. Clean-room for seeker.new; informed by Riptide's
// `agents.ts`, not copied.

import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import type { AgentId } from './adapters/types';

export interface AgentDescriptor {
  id: AgentId;
  label: string;
  binary: string;
  recommended: boolean;
}

export interface AgentProbeResult extends AgentDescriptor {
  detected: boolean;
  /** Absolute path to the resolved binary, or null when not found. */
  path: string | null;
  version: string | null;
}

export const AGENT_DESCRIPTORS: AgentDescriptor[] = [
  { id: 'claude-code', label: 'Claude Code', binary: 'claude', recommended: true },
  { id: 'codex', label: 'Codex', binary: 'codex', recommended: false },
];

const PROBE_TIMEOUT_MS = 4_000;

export async function probeAgents(): Promise<AgentProbeResult[]> {
  return Promise.all(AGENT_DESCRIPTORS.map(probeOne));
}

export async function probeAgent(id: AgentId): Promise<AgentProbeResult | null> {
  const desc = AGENT_DESCRIPTORS.find((d) => d.id === id);
  return desc ? probeOne(desc) : null;
}

async function probeOne(desc: AgentDescriptor): Promise<AgentProbeResult> {
  const resolvedPath =
    resolveOnPath(desc.binary) ?? resolveInCommonDirs(desc.binary) ?? (await resolveViaLoginShell(desc.binary));

  if (!resolvedPath) {
    return { ...desc, detected: false, path: null, version: null };
  }

  // Version-probe the resolved absolute path — it doesn't depend on PATH being
  // set up in the spawned env, which matters when the binary was found via the
  // common-dirs or login-shell layer.
  const versionRes = await runCapture(resolvedPath, ['--version']);
  const version = versionRes.ok ? parseVersion(versionRes.stdout) : null;

  return { ...desc, detected: versionRes.ok, path: resolvedPath, version };
}

function resolveOnPath(binary: string): string | null {
  const PATH = process.env.PATH ?? '';
  const sep = process.platform === 'win32' ? ';' : ':';
  for (const dir of PATH.split(sep)) {
    if (!dir) {
      continue;
    }
    const candidate = path.join(dir, binary);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveInCommonDirs(binary: string): string | null {
  if (process.platform === 'win32') {
    return null;
  }
  const home = homedir();
  const candidates = [
    `${home}/.local/share/mise/shims`,
    `${home}/.asdf/shims`,
    `${home}/.local/bin`,
    `${home}/.cargo/bin`,
    `${home}/.bun/bin`,
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
  ];
  for (const dir of candidates) {
    const candidate = path.join(dir, binary);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function resolveViaLoginShell(binary: string): Promise<string | null> {
  if (process.platform === 'win32') {
    return null;
  }
  const shell = process.env.SHELL || '/bin/bash';
  // The only argument interpolated is a single-quoted, hard-coded binary name
  // (never user input); shell:false on the spawn itself.
  const res = await runCapture(shell, ['-lic', `command -v ${shellQuote(binary)}`]);
  if (!res.ok) {
    return null;
  }
  const out = res.stdout.trim().split('\n').pop()?.trim() ?? '';
  if (!out || !path.isAbsolute(out)) {
    return null;
  }
  return isExecutable(out) ? out : null;
}

function isExecutable(p: string): boolean {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

interface CaptureResult {
  ok: boolean;
  stdout: string;
}

function runCapture(bin: string, args: string[]): Promise<CaptureResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finalize = (result: CaptureResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(bin, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      finalize({ ok: false, stdout: '' });
      return;
    }

    const out: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => out.push(chunk));
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finalize({ ok: false, stdout: Buffer.concat(out).toString('utf8') });
    }, PROBE_TIMEOUT_MS);
    timer.unref?.();

    child.once('error', () => {
      clearTimeout(timer);
      finalize({ ok: false, stdout: '' });
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      finalize({ ok: code === 0, stdout: Buffer.concat(out).toString('utf8') });
    });
  });
}

function parseVersion(s: string): string | null {
  const m = s.match(/\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/);
  return m ? m[0] : null;
}
