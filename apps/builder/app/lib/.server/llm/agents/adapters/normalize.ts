// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T04 — adapter error classification + redaction
// ─────────────────────────────────────────────────────────────────────────
//
// Each adapter calls into these so the provider seam sees one canonical
// AgentError regardless of which CLI it spawned.
//
// OFFICIAL SUBSCRIPTION AUTH ONLY. On `login_required` we surface the official
// login URL and stop — we never attempt an alternate auth, and `claude.ai` /
// `chatgpt.com` appear here ONLY as those official login URLs. No web-session,
// cookie, or token handling exists anywhere in this module.
//
// Clean-room for seeker.new; the regex catalog is informed by Riptide's
// `normalize.ts`, not copied wholesale.

import { homedir } from 'node:os';

import type { AgentError, AgentId } from './types';

const HOME = homedir();
const HOME_RE = new RegExp(escapeRegex(HOME), 'g');

const LOGIN_RE: Record<AgentId, RegExp[]> = {
  'claude-code': [
    /please run [`'"]?claude login/i,
    /not\s+(?:logged|authenticated)/i,
    /login\s+required/i,
    /unauthorized/i,
    /authentication\s+required/i,
    /invalid\s+api\s+key/i,
    /no\s+(?:anthropic\s+)?api\s+key/i,
  ],
  codex: [
    /please run [`'"]?codex login/i,
    /codex\s+login/i,
    /sign\s+in\s+(?:to|with)/i,
    /no\s+(?:openai\s+)?api\s+key/i,
    /unauthorized/i,
  ],
};

// Official login URLs only. Never a reverse-engineered web session.
const LOGIN_URL: Record<AgentId, string> = {
  'claude-code': 'https://claude.ai/login',
  codex: 'https://platform.openai.com/login',
};

const RATE_LIMIT_RE =
  /(?:rate[-\s]?limit(?:ed)?|\b429\b|too\s+many\s+requests|quota|usage\s+limit\s+reached|usage\s+cap\s+reached|5[-\s]?hour\s+limit\s+reached|weekly\s+limit\s+reached)/i;

export function loginUrlFor(agentId: AgentId): string {
  return LOGIN_URL[agentId];
}

export function redact(text: string): string {
  if (!text) {
    return text;
  }
  return text.replace(HOME_RE, '~');
}

export function classifyError(input: {
  agentId: AgentId;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdoutTail: string;
  stderrTail: string;
  spawnError: string | null;
  aborted: boolean;
  timedOut: boolean;
  finalText: string;
}): AgentError | null {
  const { agentId, exitCode, signal, stdoutTail, stderrTail, spawnError, aborted, timedOut, finalText } = input;

  if (spawnError) {
    return { family: 'spawn_failed', message: redact(spawnError), raw: redact(stderrTail) };
  }
  if (aborted) {
    return { family: 'nonzero_exit', message: 'agent run was aborted', raw: redact(stderrTail) };
  }
  if (timedOut) {
    return { family: 'nonzero_exit', message: 'agent run hit the per-turn timeout', raw: redact(stderrTail) };
  }

  const haystack = `${stdoutTail}\n${stderrTail}\n${finalText}`;
  const succeeded = exitCode === 0 && signal === null;

  // login_required can appear even on a "successful" exit — the CLI sometimes
  // replies with a friendly auth message instead of failing — so check it
  // regardless of exit code.
  for (const re of LOGIN_RE[agentId]) {
    if (re.test(haystack)) {
      return {
        family: 'login_required',
        message: `the ${agentId} CLI is not authenticated — sign in to your subscription`,
        loginUrl: LOGIN_URL[agentId],
        raw: succeeded ? undefined : redact(stderrTail),
      };
    }
  }

  if (succeeded) {
    return null;
  }

  if (RATE_LIMIT_RE.test(haystack)) {
    return { family: 'rate_limited', message: `${agentId} usage/rate limit reached`, raw: redact(stderrTail) };
  }

  return {
    family: 'nonzero_exit',
    message:
      signal !== null ? `${agentId} exited with signal ${signal}` : `${agentId} exited with code ${exitCode ?? -1}`,
    raw: redact(stderrTail),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
