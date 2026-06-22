// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T04 — spawn primitive for detected agent CLIs
// ─────────────────────────────────────────────────────────────────────────
//
// Trust contract (asserted by tests, mirrors the T01 spike):
//   • shell:false, no PATH lookup — the caller supplies an absolute binaryPath.
//   • Prompt is delivered via stdin; argv carries only flags the adapter has
//     already validated against its own ALLOWED_FLAGS set.
//   • Lifetime is bounded by an AbortSignal + a hard timeout: SIGTERM first,
//     SIGKILL after a grace window.
//   • Existing env is inherited (the CLI needs HOME for its credential store)
//     but no secret is ever injected, printed, or logged.
//
// Clean-room for seeker.new (bolt.diy MIT lineage); informed by Riptide's
// `spawn.ts`, not copied.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';

const STDERR_TAIL_BYTES = 4 * 1024;
const STDOUT_TAIL_BYTES = 4 * 1024;
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_GRACE_MS = 2_500;

export interface SpawnInput {
  binaryPath: string;
  args: string[];
  cwd: string;
  stdin: string;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
  graceMs?: number;
  onStdoutLine: (line: string) => void;
  onStderrChunk?: (chunk: string) => void;
}

export interface SpawnResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  aborted: boolean;
  spawnError: string | null;
  stderrTail: string;
  stdoutTail: string;
}

export async function runAgent(input: SpawnInput): Promise<SpawnResult> {
  if (!path.isAbsolute(input.binaryPath)) {
    // The absolute-path contract is load-bearing: a relative name would let
    // PATH resolution decide what runs. Refuse before spawning.
    throw new Error(`agent binary path must be absolute: ${input.binaryPath}`);
  }

  // Inherit env (HOME → the CLI's credential store) but neutralize color and
  // interactive prompts. No secret is injected here.
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') {
      env[k] = v;
    }
  }
  env.FORCE_COLOR = '0';
  env.NO_COLOR = '1';
  env.CI = '1';

  let proc: ChildProcessWithoutNullStreams;
  try {
    proc = spawn(input.binaryPath, input.args, {
      cwd: input.cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as ChildProcessWithoutNullStreams;
  } catch (err) {
    return {
      exitCode: null,
      signal: null,
      timedOut: false,
      aborted: false,
      spawnError: (err as Error).message,
      stderrTail: '',
      stdoutTail: '',
    };
  }

  let stderrTail = '';
  let stdoutTail = '';
  let timedOut = false;
  let aborted = false;

  const stdoutLines = createInterface({ input: proc.stdout, crlfDelay: Infinity });
  stdoutLines.on('line', (line: string) => {
    stdoutTail = appendTail(stdoutTail, `${line}\n`, STDOUT_TAIL_BYTES);
    try {
      input.onStdoutLine(line);
    } catch {
      // Adapter callbacks must never crash the read loop.
    }
  });

  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', (chunk: string) => {
    stderrTail = appendTail(stderrTail, chunk, STDERR_TAIL_BYTES);
    if (input.onStderrChunk) {
      try {
        input.onStderrChunk(chunk);
      } catch {
        // Same — never let user callbacks break IO.
      }
    }
  });

  // Deliver the prompt then close stdin so the CLI stops waiting on EOF.
  try {
    proc.stdin.write(input.stdin);
    proc.stdin.end();
  } catch {
    // If stdin is already closed the CLI exits nonzero; handled below.
  }

  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const graceMs = input.graceMs ?? DEFAULT_GRACE_MS;
  const cleanup: Array<() => void> = [];

  const timer = setTimeout(() => {
    timedOut = true;
    void sendTermThenKill(proc, graceMs);
  }, timeoutMs);
  timer.unref?.();
  cleanup.push(() => clearTimeout(timer));

  if (input.abortSignal) {
    const onAbort = () => {
      aborted = true;
      void sendTermThenKill(proc, graceMs);
    };
    if (input.abortSignal.aborted) {
      onAbort();
    } else {
      input.abortSignal.addEventListener('abort', onAbort, { once: true });
      cleanup.push(() => input.abortSignal?.removeEventListener('abort', onAbort));
    }
  }

  const closed = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null; spawnError: string | null }>(
    (resolve) => {
      proc.once('error', (err) => {
        stderrTail = appendTail(stderrTail, `\nspawn error: ${err.message}`, STDERR_TAIL_BYTES);
        resolve({ exitCode: null, signal: null, spawnError: err.message });
      });
      proc.once('close', (code, signal) => resolve({ exitCode: code, signal, spawnError: null }));
    },
  );

  for (const fn of cleanup) {
    fn();
  }

  return {
    exitCode: closed.exitCode,
    signal: closed.signal,
    timedOut,
    aborted,
    spawnError: closed.spawnError,
    stderrTail,
    stdoutTail,
  };
}

async function sendTermThenKill(proc: ChildProcessWithoutNullStreams, graceMs: number): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) {
    return;
  }
  try {
    proc.kill('SIGTERM');
  } catch {
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        // already gone
      }
      resolve();
    }, graceMs);
    timer.unref?.();
    proc.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function appendTail(prev: string, chunk: string, capBytes: number): string {
  const next = prev + chunk;
  if (Buffer.byteLength(next, 'utf8') <= capBytes) {
    return next;
  }
  const buf = Buffer.from(next, 'utf8');
  return buf.subarray(buf.length - capBytes).toString('utf8');
}
