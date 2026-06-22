/**
 * @orpc/client shim — simulator-boundary stand-in (no network).
 *
 * `createORPCClient(link)` normally returns a typed RPC proxy that fetches from
 * the backend. In the preview there is no backend, so this returns a deep proxy
 * whose leaf calls resolve to `undefined`. Most data reaches screens through the
 * TanStack-query utils shim; this covers any direct `client.x.y()` calls.
 */

function makeClientProxy(): unknown {
  const leaf = async () => undefined;
  return new Proxy(leaf, {
    get: () => makeClientProxy(),
    apply: async () => undefined,
  });
}

export function createORPCClient(_link?: unknown) {
  return makeClientProxy();
}

export default { createORPCClient };
