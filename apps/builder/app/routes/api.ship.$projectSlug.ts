import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getProjectDir, injectProgram } from '~/lib/.server/seeker/template-engine';

/**
 * One-click Ship — runs the headless rails pipeline (faucet → build → deploy →
 * publish-seam) for the current project, server-side, and streams progress to the
 * UI. On success it wires the deployed program ID + the freshly generated client
 * back into the generated app, then surfaces the program ID + devnet explorer link
 * + the publish-seam status.
 *
 * Rails runs server-side because the Solana/Anchor toolchain can't run in the
 * WebContainer (same constraint as project generation). Devnet only — there is no
 * mainnet option here.
 */

const RAILS_DIR = fileURLToPath(new URL('../../../../packages/rails/', import.meta.url));

/** A progress event streamed to the Ship panel (newline-delimited JSON). */
type ShipEvent =
  | { type: 'stage'; stage: string; status: 'start' | 'done' }
  | { type: 'log'; message: string }
  | { type: 'result'; result: ShipSummary }
  | { type: 'error'; message: string };

interface ShipSummary {
  cluster: string;
  programId: string;
  explorer: string;
  deployer: string;
  publish: { status: string; note?: string };
}

export async function action({ params }: ActionFunctionArgs) {
  const projectSlug = params.projectSlug;

  if (!projectSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug)) {
    return new Response('Invalid project slug', { status: 400 });
  }

  const projectDir = getProjectDir(projectSlug);
  if (!existsSync(projectDir)) {
    return new Response('Project not found', { status: 404 });
  }

  // The app's Anchor program workspace lives beside the generated app. Render it
  // on first ship; reuse it after so re-ships upgrade the same program in place.
  const workspaceDir = `${projectDir}-program`;
  const tsx = `${RAILS_DIR}node_modules/.bin/tsx`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ShipEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        // 1) Render the program workspace if it does not exist yet.
        if (!existsSync(workspaceDir)) {
          emit({ type: 'stage', stage: 'render', status: 'start' });
          emit({ type: 'log', message: `Preparing program workspace…` });
          await runRails(tsx, ['src/cli.ts', 'render', workspaceDir], emit);
          emit({ type: 'stage', stage: 'render', status: 'done' });
        }

        // 2) Run the full ship pipeline (faucet → build → deploy → client → publish-seam).
        emit({ type: 'stage', stage: 'ship', status: 'start' });
        const stdout = await runRails(
          tsx,
          ['src/cli.ts', 'ship', workspaceDir, '--emit-client'],
          emit,
        );
        const result = parseShipResult(stdout);
        emit({ type: 'stage', stage: 'ship', status: 'done' });

        // 3) Wire the deployed program + generated client back into the app.
        emit({ type: 'stage', stage: 'inject', status: 'start' });
        const clientDir = `${workspaceDir}/clients/ts/src/generated`;
        await injectProgram(projectSlug, {
          programId: result.programId,
          clientDir: existsSync(clientDir) ? clientDir : undefined,
        });
        emit({ type: 'stage', stage: 'inject', status: 'done' });

        emit({
          type: 'result',
          result: {
            cluster: result.cluster,
            programId: result.programId,
            explorer: result.explorer,
            deployer: result.deployer,
            publish: result.publish ?? { status: 'pending' },
          },
        });
      } catch (error) {
        emit({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** Spawn a rails CLI command, stream its output as log events, resolve stdout. */
function runRails(
  tsx: string,
  args: string[],
  emit: (event: ShipEvent) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(tsx, args, { cwd: RAILS_DIR, env: process.env });
    let stdout = '';

    const onLines = (chunk: Buffer) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) {
          emit({ type: 'log', message: line });
        }
      }
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      onLines(chunk);
    });
    child.stderr.on('data', onLines);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`rails ${args[1]} exited with code ${code}`));
      }
    });
  });
}

interface RailsShipResult {
  cluster: string;
  programId: string;
  explorer: string;
  deployer: string;
  publish?: { status: string; note?: string };
}

/**
 * The rails CLI prints the ShipResult as pretty JSON on its final output. Match
 * the last *top-level* opening brace (a `{` alone at the start of a line) so the
 * nested `{` of pretty-printed objects don't trip the parse.
 */
function parseShipResult(stdout: string): RailsShipResult {
  const idx = stdout.lastIndexOf('\n{\n');
  const candidate = idx === -1 ? stdout : stdout.slice(idx + 1);
  try {
    return JSON.parse(candidate) as RailsShipResult;
  } catch {
    throw new Error('Could not parse rails ship result.');
  }
}
