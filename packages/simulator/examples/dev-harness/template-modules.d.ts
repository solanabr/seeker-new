/**
 * Ambient declaration for the vendored template source imported via `@template/*`.
 *
 * The dev harness renders REAL beeman template components (resolved at bundle
 * time by the `@template/` Vite alias). Those files pull in the full Expo / RN /
 * uniwind / better-auth dependency graph, which is not installed in the simulator
 * repo and is not meant to be type-checked here — type-following into them would
 * flood `tsc` with unresolved-module errors that say nothing about the simulator.
 *
 * Declaring `@template/*` as an untyped module keeps `pnpm typecheck` scoped to
 * the simulator's own source while Vite still resolves and renders the real
 * component implementations in the browser.
 */
declare module '@template/*' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any;
  export = mod;
}
