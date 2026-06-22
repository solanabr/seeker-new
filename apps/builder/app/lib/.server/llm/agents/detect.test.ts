// Sprint 5 · T03 — detection runs the real probe against this machine. It must
// never throw: present agents come back with an absolute path + version,
// absent ones with detected:false. This is the CI-safe shape gate; the human
// gate is reading the logged probe output below.
import { describe, expect, it } from 'vitest';
import { AGENT_DESCRIPTORS, probeAgents } from './detect';
import path from 'node:path';

describe('probeAgents — local agent detection', () => {
  it('returns one well-formed result per descriptor without throwing', async () => {
    const results = await probeAgents();
    expect(results).toHaveLength(AGENT_DESCRIPTORS.length);

    for (const r of results) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.label).toBe('string');
      expect(typeof r.detected).toBe('boolean');
      if (r.detected) {
        // A detected agent must carry an ABSOLUTE path (never a bare name).
        expect(r.path && path.isAbsolute(r.path)).toBe(true);
      } else {
        expect(r.path).toBeNull();
        expect(r.version).toBeNull();
      }
    }

    // Surface the real probe so the human gate can eyeball path + version.
    // eslint-disable-next-line no-console
    console.log('probeAgents:', JSON.stringify(results, null, 2));
  });
});
