export type ActionType = 'file' | 'shell' | 'scaffold';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
  summary?: string;
  background?: boolean;
  waitForPort?: number;
}

export interface ScaffoldAction extends BaseAction {
  type: 'scaffold';
  summary?: string;
}

export type BoltAction = FileAction | ShellAction | ScaffoldAction;

export type BoltActionData = BoltAction | BaseAction;
