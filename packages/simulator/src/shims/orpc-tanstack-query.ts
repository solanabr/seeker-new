/**
 * @orpc/tanstack-query shim — `createTanstackQueryUtils` stand-in.
 *
 * The real utils turn an oRPC client into per-procedure TanStack option builders
 * (`orpc.todo.list.queryOptions(input)`, `orpc.solana.getBalance.mutationOptions()`,
 * …). This returns a deep proxy with the same shape, where every leaf produces a
 * TanStack-compatible option object whose fn resolves to placeholder data. Pairs
 * with the TanStack Query shim, which consumes these option objects.
 */

function optionFactories(path: string[]) {
  return {
    queryKey: path,
    key: () => path,
    queryOptions: (input?: unknown) => ({
      queryKey: input === undefined ? path : [...path, input],
      queryFn: async () => undefined,
    }),
    infiniteOptions: (input?: unknown) => ({
      queryKey: input === undefined ? path : [...path, input],
      queryFn: async () => undefined,
      initialPageParam: undefined,
      getNextPageParam: () => undefined,
    }),
    mutationOptions: () => ({
      mutationKey: path,
      mutationFn: async () => undefined,
    }),
  };
}

function makeUtilsProxy(path: string[]): unknown {
  const base = optionFactories(path) as Record<string, unknown>;
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target)) {
        return makeUtilsProxy([...path, prop]);
      }
      return target[prop as string];
    },
  });
}

export function createTanstackQueryUtils(_client?: unknown, ..._rest: unknown[]) {
  return makeUtilsProxy([]);
}

export default { createTanstackQueryUtils };
