/**
 * better-auth-solana/client shim — `siwsClient` plugin no-op plus a
 * `createSIWSInput` stand-in that returns a plain SIWS message object for the
 * mock wallet to "sign". Keeps the wallet sign-in flow runnable in the preview
 * without a backend. See the better-auth-react shim for the why.
 */

export function siwsClient(_options?: unknown) {
  return { id: 'siws-solana' };
}

export function createSIWSInput(input: {
  address: string;
  challenge?: string;
  statement?: string;
  domain?: string;
  uri?: string;
}) {
  return {
    domain: input.domain ?? 'localhost',
    address: input.address,
    statement: input.statement ?? 'Sign in',
    uri: input.uri ?? 'https://localhost',
    version: '1',
    chainId: 'solana:devnet',
    nonce: input.challenge ?? 'preview-mock-nonce',
    issuedAt: '1970-01-01T00:00:00.000Z',
  };
}

export default { siwsClient, createSIWSInput };
