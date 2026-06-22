import { streamText as _streamText } from 'ai';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { resolveProvider, type GenerationStream, type ProviderConfig } from './provider';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

/**
 * Stream one generation turn through the resolved provider (cloud / byok /
 * agent-runtime). With no `providerConfig` this is the existing `cloud` path on
 * the managed env key — unchanged. The returned value always exposes
 * `.toAIStream()` (the T01-locked seam contract), so callers stay
 * provider-agnostic.
 */
export function streamText(
  messages: Messages,
  env: Env,
  options?: StreamingOptions,
  providerConfig?: ProviderConfig,
): Promise<GenerationStream> {
  const { system, maxTokens: _maxTokens, ...sdkOptions } = options ?? {};
  const provider = resolveProvider(env, providerConfig);

  return provider.generate({
    messages,
    system: typeof system === 'string' ? system : getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    cwd: process.cwd(),
    abortSignal: sdkOptions.abortSignal,
    sdkOptions,
  });
}
