import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateObjectMock = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
}));

vi.mock('~/lib/.server/llm/api-key', () => ({
  getAPIKey: () => 'test-api-key',
}));

vi.mock('~/lib/.server/llm/model', () => ({
  getAnthropicModel: () => 'test-model',
}));

import { createProjectPlan } from './ai-orchestrator';

describe('createProjectPlan programSpec normalization', () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it('keeps plain wallet prompts frontend-only when the planner omits a program', async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: planDraft({
        projectName: 'Wallet Guide',
        summary: 'A wallet guide app.',
      }),
    });

    const plan = await createProjectPlan(testEnv(), 'Build a plain wallet guide with balances.');

    expect(plan.programSpec).toBeUndefined();
  });

  it('attaches a clamped programSpec when the planner returns an on-chain program block', async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: planDraft({
        projectName: 'Check Streak',
        summary: 'A check-in app with on-chain streaks.',
        program: {
          needsProgram: true,
          archetype: 'vote',
          state: { name: 'Streak', field: 'days' },
          accounts: ['authority'],
          instructions: ['initialize', 'check_in'],
          rationale: 'Stores each user streak on chain',
        },
      }),
    });

    const plan = await createProjectPlan(
      testEnv(),
      'Build a check-in app that stores user streaks on chain.',
    );

    expect(plan.programSpec).toEqual({
      needsProgram: true,
      archetype: 'counter',
      state: { name: 'Streak', field: 'days' },
      accounts: ['authority'],
      instructions: ['initialize', 'check_in'],
      rationale: 'Stores each user streak on chain.',
    });
  });
});

function planDraft(overrides: Record<string, unknown> = {}) {
  return {
    projectName: 'Example App',
    summary: 'A focused Solana mobile app.',
    appDescription: 'A focused Solana mobile app.',
    appTagline: 'Ship on Solana.',
    initialScreens: ['Home'],
    entities: ['wallet'],
    integrations: ['Wallet'],
    newFiles: [],
    dependencies: [],
    ...overrides,
  };
}

function testEnv(): Env {
  return { ANTHROPIC_API_KEY: 'test-api-key' } as Env;
}
