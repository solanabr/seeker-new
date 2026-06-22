/**
 * Emit a `@solana/kit` TypeScript client for a built program.
 *
 * Path (locked in the T01 spike): `anchor idl build` → Codama
 * (`@codama/renderers-js`, `kitImportStrategy: rootOnly`) → a client whose only
 * runtime peer is `@solana/kit`, matching the kit-expo-minimal template.
 *
 * Codama and the Anchor IDL toolchain run inside the **generated workspace**
 * (they are devDependencies of that throwaway output), invoked here via spawn.
 * `@seeker/rails` itself adds **no** production npm dependency — this keeps the
 * package headless and standalone-extractable.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PROGRAM_ARTIFACT } from './renderArchetype.js';

export interface GenerateClientOptions {
  /** Anchor artifact / IDL stem (defaults to the fixed generated crate name). */
  programArtifact?: string;
  /** Skip `pnpm install` (assume the workspace's devDeps are present). */
  skipInstall?: boolean;
  log?: (message: string) => void;
}

export interface GenerateClientResult {
  /** Path to the built Anchor IDL JSON. */
  idlPath: string;
  /** Directory holding the generated `@solana/kit` client source. */
  clientDir: string;
}

function run(command: string, args: string[], cwd: string, log: (m: string) => void): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    log(`$ ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      log(s.trimEnd());
    });
    child.stderr.on('data', (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      log(s.trimEnd());
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`));
    });
  });
}

/** Extract the IDL JSON object from `anchor idl build` stdout. */
function extractIdlJson(stdout: string): string {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Could not parse IDL JSON from 'anchor idl build' output");
  }
  const slice = stdout.slice(start, end + 1);
  // Validate it really is JSON before we hand it to Codama.
  JSON.parse(slice);
  return slice;
}

/**
 * Build the IDL and render the `@solana/kit` client into the generated
 * workspace, returning the IDL path + generated client directory.
 */
export async function generateClient(
  workspaceDir: string,
  opts: GenerateClientOptions = {},
): Promise<GenerateClientResult> {
  const { programArtifact = PROGRAM_ARTIFACT, skipInstall = false, log = console.log } = opts;

  if (!existsSync(workspaceDir)) {
    throw new Error(`Generated workspace not found at ${workspaceDir}`);
  }

  // 1) Build the Anchor IDL. `anchor idl build` (v1.x) writes the IDL JSON to
  //    stdout; capture it and persist it where codama.json points
  //    (target/idl/<artifact>.json) so it is both the Codama input and a
  //    returned artifact.
  const idlStdout = await run('anchor', ['idl', 'build'], workspaceDir, log);
  const idlPath = resolve(workspaceDir, 'target', 'idl', `${programArtifact}.json`);
  mkdirSync(dirname(idlPath), { recursive: true });
  writeFileSync(idlPath, extractIdlJson(idlStdout), 'utf8');
  log(`idl: ${idlPath}`);

  // 2) Install the workspace's Codama toolchain (devDeps of the throwaway
  //    output, never of rails) unless it is already present.
  if (!skipInstall && !existsSync(resolve(workspaceDir, 'node_modules'))) {
    await run('pnpm', ['install'], workspaceDir, log);
  }

  // 3) Render the @solana/kit client via the workspace's own Codama script.
  await run('pnpm', ['run', 'generate:client'], workspaceDir, log);

  const clientDir = resolve(workspaceDir, 'clients', 'ts', 'src', 'generated');
  if (!existsSync(clientDir)) {
    throw new Error(`Codama did not emit a client at ${clientDir}`);
  }
  log(`client: ${clientDir}`);

  return { idlPath, clientDir };
}
