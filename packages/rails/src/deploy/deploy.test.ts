import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readProgramArtifact } from './deploy.js';

function withAnchorToml(content: string): string {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'seeker-rails-anchor-'));
  writeFileSync(join(fixtureDir, 'Anchor.toml'), content);
  return fixtureDir;
}

function assertProgramArtifact(content: string, expected: string): void {
  const fixtureDir = withAnchorToml(content);
  try {
    assert.equal(readProgramArtifact(fixtureDir), expected);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

assertProgramArtifact(
  `
[toolchain]

[programs.devnet]
seeker_counter = "4dQJbKb7PdNYLJVjdqEhh1TceLEzhy62BG2iZf93SVX6"

[provider]
cluster = "devnet"
`,
  'seeker_counter',
);

assertProgramArtifact(
  `
[toolchain]

[programs.devnet]
# comment with a z should not terminate the devnet section
final_counter = "Counter111111111111111111111111111111111111"
`,
  'final_counter',
);
