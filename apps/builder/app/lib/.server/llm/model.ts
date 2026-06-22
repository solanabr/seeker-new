import { createAnthropic } from '@ai-sdk/anthropic';

export const DEFAULT_MODEL = 'claude-haiku-4-5';

/**
 * The AI-SDK model factory shared by the `cloud` (managed env key) and `byok`
 * (user-supplied key) provider modes. `agent-runtime` does not use this — it
 * spawns the official CLI instead (see `agents/adapters/`).
 */
export function getAnthropicModel(apiKey: string, model: string = DEFAULT_MODEL) {
  const anthropic = createAnthropic({
    apiKey,
  });

  return anthropic(model);
}
