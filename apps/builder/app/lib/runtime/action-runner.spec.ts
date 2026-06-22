import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { describe, expect, it, vi } from 'vitest';
import { ActionRunner } from './action-runner';

describe('ActionRunner', () => {
  it('completes a background shell action when the requested port opens', async () => {
    let portListener: ((port: number, type: 'open' | 'close', url: string) => void) | undefined;
    const process = createProcess();
    const spawn = vi.fn(async () => process);
    const on = vi.fn((event: 'port', listener: NonNullable<typeof portListener>) => {
      if (event === 'port') {
        portListener = listener;
      }

      return vi.fn();
    });
    const webcontainer = {
      spawn,
      on,
    } as unknown as WebContainer;

    const runner = new ActionRunner(Promise.resolve(webcontainer));
    const actionData = {
      artifactId: 'artifact_1',
      messageId: 'message_1',
      actionId: '0',
      action: {
        type: 'shell' as const,
        content: 'cd preview && npm run dev',
        background: true,
        waitForPort: 5275,
      },
    };

    runner.addAction(actionData);
    runner.runAction(actionData);

    await waitFor(() => spawn.mock.calls.length > 0);
    expect(runner.actions.get()['0'].status).toBe('running');

    portListener?.(5275, 'open', 'http://localhost:5275');

    await waitFor(() => runner.actions.get()['0'].status === 'complete');
    expect(process.kill).not.toHaveBeenCalled();
  });
});

function createProcess(): WebContainerProcess {
  return {
    exit: new Promise<number>(() => {}),
    input: {} as WebContainerProcess['input'],
    output: {
      pipeTo: vi.fn(() => Promise.resolve()),
    } as unknown as WebContainerProcess['output'],
    kill: vi.fn(),
    resize: vi.fn(),
    stdout: {} as WebContainerProcess['stdout'],
    stderr: {} as WebContainerProcess['stderr'],
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Timed out waiting for condition');
}
