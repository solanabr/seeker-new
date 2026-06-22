/**
 * On-chain program this app calls.
 *
 * `programId` is the address of the app's Solana program after it is deployed to
 * devnet. The ship pipeline rewrites it (and refreshes the generated client under
 * `features/counter/program-client`) when the program is deployed, so the running
 * app always points at the freshly deployed program. The default below is the
 * counter program already live on devnet, so the feature works out of the box.
 */
export const ProgramConfig = {
  /** Deployed program address. Rewritten by the ship pipeline after deploy. */
  programId: '4dQJbKb7PdNYLJVjdqEhh1TceLEzhy62BG2iZf93SVX6',
  /** Cluster the program is deployed to (devnet only). */
  cluster: 'devnet' as const,
  /** Human label shown in the UI. */
  label: 'Solana Devnet',
  /** RPC endpoint the app reads program state from. */
  rpcUrl: 'https://api.devnet.solana.com',
}
