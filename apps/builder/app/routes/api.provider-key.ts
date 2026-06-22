import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { clearByokKey, commitByokKey, readByokKey } from '~/lib/.server/provider-session';

/**
 * Sprint 5 · T05 — byok API key endpoint.
 *
 * POST   { apiKey }  → store the key in the HttpOnly server session.
 * DELETE             → forget the stored key.
 * GET                → report only whether a key is on file (never the key).
 *
 * The key is never logged, never echoed back, and never written to
 * localStorage — it lives only in the signed, HttpOnly cookie session.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return json({ hasKey: Boolean(await readByokKey(request)) });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === 'DELETE') {
    const cookie = await clearByokKey(request);
    return json({ ok: true, hasKey: false }, { headers: { 'Set-Cookie': cookie } });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method not allowed' }, { status: 405 });
  }

  let apiKey: unknown;
  try {
    ({ apiKey } = await request.json<{ apiKey?: unknown }>());
  } catch {
    return json({ ok: false, error: 'invalid request body' }, { status: 400 });
  }

  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return json({ ok: false, error: 'apiKey is required' }, { status: 400 });
  }

  // NOTE: never log `apiKey`. It goes straight into the HttpOnly session.
  const cookie = await commitByokKey(request, apiKey.trim());
  return json({ ok: true, hasKey: true }, { headers: { 'Set-Cookie': cookie } });
}
