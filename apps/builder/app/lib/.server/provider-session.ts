// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T05 — byok API key server session (no plaintext in localStorage)
// ─────────────────────────────────────────────────────────────────────────
//
// The byok API key must reach the generation path on every turn but must NEVER
// be persisted in plaintext where avoidable (spec R4.4). So the client posts it
// once to `/api/provider-key`, which stows it in a SERVER-SIDE session — the
// key lives only in server memory; the HttpOnly cookie carries just an opaque
// session id (no base64-recoverable secret), is unreadable from JS, is never
// written to localStorage, and is never logged. `api.chat.ts` reads the key
// back server-side per turn.
//
// A memory-backed store fits the self-host model: the key is held only for the
// running process and is cleared on restart (the user re-enters it), which is
// strictly safer than persisting it. Set `SESSION_SECRET` for a stable cookie
// signing key; the dev fallback only keeps local development working.

import { createMemorySessionStorage } from '@remix-run/cloudflare';
import { env } from 'node:process';

const SESSION_SECRET = env.SESSION_SECRET || 'seeker-new-dev-session-secret';
const BYOK_KEY = 'byokApiKey';

const storage = createMemorySessionStorage({
  cookie: {
    name: '__seeker_provider',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env.NODE_ENV === 'production',
    secrets: [SESSION_SECRET],
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

function cookieHeader(request: Request): string | null {
  return request.headers.get('Cookie');
}

/** Read the stored byok key for this session, or undefined when none is set. */
export async function readByokKey(request: Request): Promise<string | undefined> {
  const session = await storage.getSession(cookieHeader(request));
  const value = session.get(BYOK_KEY);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Persist the byok key into the session; returns the Set-Cookie header value. */
export async function commitByokKey(request: Request, apiKey: string): Promise<string> {
  const session = await storage.getSession(cookieHeader(request));
  session.set(BYOK_KEY, apiKey);
  return storage.commitSession(session);
}

/** Clear the stored byok key; returns the Set-Cookie header value. */
export async function clearByokKey(request: Request): Promise<string> {
  const session = await storage.getSession(cookieHeader(request));
  session.unset(BYOK_KEY);
  return storage.commitSession(session);
}
