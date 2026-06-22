import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { map, type MapStore } from 'nanostores';
import { deviceRunStore } from '~/lib/stores/device-run';
import type { BoltAction } from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';

const logger = createScopedLogger('ActionRunner');

const BACKGROUND_PROCESS_READY_TIMEOUT = 90_000;

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();

  actions: ActionsMap = map({});

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      // action already added
      return;
    }

    const abortController = new AbortController();

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      this.#updateAction(actionId, { status: 'running' });
    });
  }

  async runAction(data: ActionCallbackData) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return;
    }

    this.#updateAction(actionId, { ...action, ...data.action, executed: true });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId);
      })
      .catch((error) => {
        console.error('Action failed:', error);
      });
  }

  async #executeAction(actionId: string) {
    const action = this.actions.get()[actionId];

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          await this.#runShellAction(action);
          break;
        }
        case 'file': {
          await this.#runFileAction(action);
          break;
        }
        case 'scaffold': {
          await this.#runScaffoldAction(action);
          break;
        }
      }

      this.#updateAction(actionId, { status: action.abortSignal.aborted ? 'aborted' : 'complete' });
    } catch (error) {
      this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runShellAction(action: ActionState) {
    if (action.type !== 'shell') {
      unreachable('Expected shell action');
    }

    const webcontainer = await this.#webcontainer;

    const process = await webcontainer.spawn('jsh', ['-c', action.content], {
      env: { npm_config_yes: true },
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });

    void process.output
      .pipeTo(
        new WritableStream({
          write(data) {
            deviceRunStore.registerProcessOutput(data);
            console.log(data);
          },
        }),
      )
      .catch((error) => {
        logger.debug('Process output stream closed', error);
      });

    if (action.background) {
      if (action.waitForPort) {
        await this.#waitForBackgroundProcessReady(webcontainer, process, action.waitForPort, action.abortSignal);
      }

      return;
    }

    const exitCode = await process.exit;

    logger.debug(`Process terminated with code ${exitCode}`);
  }

  async #waitForBackgroundProcessReady(
    webcontainer: WebContainer,
    process: WebContainerProcess,
    port: number,
    abortSignal: AbortSignal,
  ) {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe: () => void = () => undefined;
      let onAbort: () => void = () => undefined;

      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        unsubscribe();
        abortSignal.removeEventListener('abort', onAbort);
        clearTimeout(timeout);
        timeout = undefined;
        callback();
      };

      onAbort = () => finish(resolve);

      unsubscribe = webcontainer.on('port', (eventPort, type) => {
        if (eventPort === port && type === 'open') {
          finish(resolve);
        }
      });

      timeout = setTimeout(() => {
        process.kill();
        finish(() => reject(new Error(`Timed out waiting for preview server on port ${port}`)));
      }, BACKGROUND_PROCESS_READY_TIMEOUT);

      abortSignal.addEventListener('abort', onAbort, { once: true });

      process.exit
        .then((exitCode) => {
          finish(() => reject(new Error(`Preview server exited before opening port ${port} (exit ${exitCode})`)));
        })
        .catch((error) => {
          finish(() => reject(error instanceof Error ? error : new Error(String(error))));
        });
    });
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') {
      unreachable('Expected file action');
    }

    const webcontainer = await this.#webcontainer;

    let folder = getDirname(action.filePath);

    // remove trailing slashes
    folder = folder.replace(/\/+$/g, '');

    if (folder !== '.') {
      try {
        await webcontainer.fs.mkdir(folder, { recursive: true });
        logger.debug('Created folder', folder);
      } catch (error) {
        logger.error('Failed to create folder\n\n', error);
      }
    }

    try {
      await webcontainer.fs.writeFile(action.filePath, action.content);
      logger.debug(`File written ${action.filePath}`);
    } catch (error) {
      logger.error('Failed to write file\n\n', error);
    }
  }

  async #runScaffoldAction(action: ActionState) {
    if (action.type !== 'scaffold') {
      unreachable('Expected scaffold action');
    }

    const files = parseScaffoldFiles(action.content);

    for (const file of files) {
      if (action.abortSignal.aborted) {
        return;
      }

      await this.#runFileAction({
        ...action,
        type: 'file',
        filePath: file.path,
        content: file.content,
      });
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState });
  }
}

function parseScaffoldFiles(content: string) {
  const parsed = JSON.parse(content) as Array<{ path: string; content: string }>;

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid scaffold payload');
  }

  return parsed;
}

function getDirname(filePath: string) {
  const normalized = filePath.replace(/\/+$/g, '');
  const lastSlash = normalized.lastIndexOf('/');

  if (lastSlash === -1) {
    return '.';
  }

  const dirname = normalized.slice(0, lastSlash);

  return dirname.length > 0 ? dirname : '/';
}
