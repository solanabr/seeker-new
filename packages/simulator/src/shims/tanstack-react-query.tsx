/**
 * @tanstack/react-query shim — simulator-boundary stand-in.
 *
 * The generated app wires a real oRPC + TanStack Query data layer that talks to a
 * Hono/oRPC backend (Drizzle/Turso). That backend cannot run inside the preview's
 * WebContainer, and — crucially — the preview renders the app's entry screen
 * WITHOUT the app's own `<QueryClientProvider>` (the simulator wraps the entry in
 * the mock wallet provider instead). The real hooks would therefore throw
 * "No QueryClient set". This shim provides a provider-less, network-less TanStack
 * surface: queries and mutations resolve to placeholder data so screens render
 * their loaded/empty state. Pairs with the oRPC shims, which build the
 * query/mutation option objects these hooks consume. See the README shim table.
 */

import type { ReactNode } from 'react';

type AnyOptions = Record<string, unknown>;

const noop = () => {};
const asyncUndefined = async () => undefined;

export class QueryClient {
  constructor(_config?: unknown) {}
  invalidateQueries = async () => {};
  resetQueries = async () => {};
  cancelQueries = async () => {};
  refetchQueries = async () => {};
  setQueryData = () => undefined;
  getQueryData = () => undefined;
  ensureQueryData = asyncUndefined;
  prefetchQuery = async () => {};
  removeQueries = noop;
  clear = noop;
  mount = noop;
  unmount = noop;
  getQueryCache = () => new QueryCache();
  getMutationCache = () => new MutationCache();
  getDefaultOptions = () => ({});
  setDefaultOptions = noop;
}

export class QueryCache {
  constructor(_config?: unknown) {}
  find = () => undefined;
  findAll = () => [];
  subscribe = () => noop;
  clear = noop;
}

export class MutationCache {
  constructor(_config?: unknown) {}
  find = () => undefined;
  findAll = () => [];
  subscribe = () => noop;
  clear = noop;
}

export function QueryClientProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

const queryResult = {
  data: undefined as unknown,
  error: null,
  isLoading: false,
  isPending: false,
  isFetching: false,
  isRefetching: false,
  isError: false,
  isSuccess: true,
  status: 'success' as const,
  fetchStatus: 'idle' as const,
  refetch: async () => ({ data: undefined }),
};

export function useQuery(_options?: AnyOptions) {
  return { ...queryResult };
}

export function useQueries(options?: { queries?: AnyOptions[] }) {
  return (options?.queries ?? []).map(() => ({ ...queryResult }));
}

export function useInfiniteQuery(_options?: AnyOptions) {
  return {
    ...queryResult,
    data: { pages: [], pageParams: [] },
    fetchNextPage: asyncUndefined,
    fetchPreviousPage: asyncUndefined,
    hasNextPage: false,
    hasPreviousPage: false,
    isFetchingNextPage: false,
    isFetchingPreviousPage: false,
  };
}

export function useMutation(_options?: AnyOptions) {
  return {
    data: undefined as unknown,
    error: null,
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle' as const,
    mutate: noop,
    mutateAsync: asyncUndefined,
    reset: noop,
  };
}

const sharedClient = new QueryClient();
export function useQueryClient() {
  return sharedClient;
}

export function useIsFetching() {
  return 0;
}
export function useIsMutating() {
  return 0;
}
export const keepPreviousData = (prev: unknown) => prev;

export default {
  QueryClient,
  QueryCache,
  MutationCache,
  QueryClientProvider,
  useQuery,
  useQueries,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useIsFetching,
  useIsMutating,
  keepPreviousData,
};
