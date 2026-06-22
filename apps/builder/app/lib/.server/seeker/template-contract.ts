/**
 * The trusted template's REAL wallet/Solana surface, shared by every code-gen
 * prompt (initial customization + follow-up edits).
 *
 * Without this, the model reconstructs an older Solana Mobile scaffold from
 * training data — importing `useAuthorization` / `useConnection` from
 * `../src/utils/*` and wiring `@solana-mobile/mobile-wallet-adapter` directly,
 * none of which exist in this template (the app then fails to compile/run). PRD
 * §7.1: always start from the trusted template; the AI never invents the
 * foundation.
 *
 * Every fact here is verified against `apps/templates/kit-expo-minimal` (the
 * official Solana `kit-expo-minimal` template: a flat, single Expo app). Keep it
 * in sync if the template's wallet surface changes.
 */
export const WALLET_CONTRACT = [
  'TEMPLATE WALLET/SOLANA CONTRACT — use ONLY this surface; never invent another:',
  '- This is a flat, single Expo app (Expo Router). There is NO `apps/mobile`, `apps/web`, or `apps/api`, no backend, and no monorepo. The `@/` import alias maps to the PROJECT ROOT (e.g. `@/features/...`, `@/constants/...`).',
  '- The wallet hook is `useMobileWallet` from `@wallet-ui/react-native-kit`:',
  "    import { useMobileWallet } from '@wallet-ui/react-native-kit'",
  '    const { account, connect, disconnect, signMessage, signTransaction, signAndSendTransaction, signIn, chain, client } = useMobileWallet()',
  '  `account` is `{ label: string; address: string }` when connected, otherwise undefined. `connect()` authorizes; `disconnect()` signs out.',
  '- The wallet + network + query providers are ALREADY mounted in `@/components/app-providers` (`AppProviders`), wired from `_layout.tsx`. Do NOT add or import a provider, connection, or adapter yourself.',
  '- For on-chain reads use the wallet client RPC via the existing hook `useAccountGetBalance({ address })` from `@/features/account/use-account-get-balance` (it calls `useMobileWallet().client.rpc`). Do NOT open your own `@solana/web3.js` `Connection`.',
  '- Reuse the existing building blocks: `@/features/account/account-feature-index` (Account screen: connect/disconnect/balance/sign-message/sign-in), `@/features/network/network-feature-index` (network select + version/genesis), and the individual `@/features/account/*` / `@/features/network/*` components. The current network comes from `useNetwork()` in `@/features/network/use-network`.',
  "- This app's on-chain program is wired through `@/features/counter/counter-feature-index` (`CounterFeatureIndex`): it reads program state live from devnet and sends an instruction through the wallet flow, using the generated client in `@/features/counter/program-client` and the program address in `@/constants/program-config`. If the home screen already renders `<CounterFeatureIndex />`, KEEP it — it is how the app calls its deployed program. Do not edit `@/constants/program-config` (the ship pipeline writes the deployed program ID there).",
  '- Style with React Native `StyleSheet`. Reuse `appStyles` from `@/constants/app-styles` (`screen`, `stack`, `card`, `title`). This template does NOT use NativeWind / `className`.',
  '- App identity (name, networks) lives in `@/constants/app-config` (`AppConfig`).',
  'HARD PROHIBITIONS (these do NOT exist in this template and will break the app):',
  '- NEVER import `useAuthorization`, `useConnection`, or anything from `../src/utils/*` or a `src/` directory — there is no `src/` dir.',
  '- NEVER import `@solana-mobile/mobile-wallet-adapter-protocol*` or wire MWA directly. The only wallet seam is `@wallet-ui/react-native-kit`.',
  '- NEVER import from a backend/oRPC/`better-auth` layer or a companion web app — none exist here.',
].join('\n');
