import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { probeAgents } from '~/lib/.server/llm/agents/detect';

/**
 * Sprint 5 · T03 — local agent detection endpoint.
 *
 * Returns the probe results the first-open provider modal renders as selectable
 * agent cards: which official CLIs (`claude`, `codex`) are installed on this
 * machine, their absolute path, and parsed version. Absent agents come back
 * `detected: false` with no error so the modal can degrade gracefully (the
 * hosted Cloudflare deployment can't spawn local CLIs — agent-runtime is
 * self-host only).
 *
 * No secret is read or returned — only descriptor + path + version.
 */
export async function loader(_args: LoaderFunctionArgs) {
  try {
    const agents = await probeAgents();
    return json({ agents });
  } catch (error) {
    // Detection must never throw to the UI — report an empty set instead so the
    // modal falls back to byok/cloud.
    console.error('agent detection failed', error);
    return json({ agents: [] });
  }
}
