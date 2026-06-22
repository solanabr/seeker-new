/**
 * seeker-simulator — public API surface.
 *
 * Callers depend on the {@link RenderingBackend} interface, the `<Simulator>`
 * component, and the wallet seam — never on a concrete engine internal. The
 * react-native-web engine (`WebRenderBackend`) is exported as one implementation;
 * a future cloud Android emulator engine slots in behind the same interface.
 */

// Device-frame component.
export { Simulator } from './Simulator';
export type { SimulatorProps } from './Simulator';

// The swappable rendering contract + supporting types.
export type {
  RenderingBackend,
  BackendId,
  BackendEventMap,
  DeviceProfile,
  SafeAreaInsets,
  AppSource,
  Unsubscribe,
} from './backend/RenderingBackend';
export { SEEKER_DEVICE } from './backend/RenderingBackend';

// The react-native-web engine — one implementation of RenderingBackend.
export { WebRenderBackend } from './backend/WebRenderBackend';
export type { WebRenderBackendOptions } from './backend/WebRenderBackend';

// The iframe engine — renders a preview URL (`bundle-url`) behind the same
// interface. Carries no react-native-web; safe to import into a web-only host.
export { IframeBackend } from './backend/IframeBackend';
export type { IframeBackendOptions } from './backend/IframeBackend';

// Mock-wallet seam.
export type { WalletBridge, WalletRequest } from './wallet/WalletBridge';

// Mock MWA engine (T03) — intercepts the template's wallet calls, resolves them
// locally against an ephemeral keypair, no cluster / no real secrets.
export { MockMwaProvider, UserRejectedError } from './wallet/MockMwaProvider';
export type {
  MockAccount,
  MockMwaOptions,
  MockRequestType,
  MockWalletPhase,
  MockWalletRequest,
  MockWalletResult,
  MockWalletState,
} from './wallet/MockMwaProvider';

// Mock `@wallet-ui/react-native-kit` (the interception seam) — also exported so
// callers/tests can register a controller and read the hook directly.
export {
  MobileWalletProvider,
  useMobileWallet,
  setActiveMockMwa,
  getActiveMockMwa,
  createSolanaDevnet,
  createSolanaTestnet,
  createSolanaMainnet,
  createSolanaLocalnet,
} from './wallet/mock-wallet-ui-kit';
export type {
  AppIdentity,
  SolanaCluster,
  MobileWalletProviderProps,
} from './wallet/mock-wallet-ui-kit';

// Seeker approval-sheet UI (T04) + the one-call wiring helper.
export { ApprovalSheet } from './wallet/ApprovalSheet';
export type { ApprovalSheetProps } from './wallet/ApprovalSheet';
export { createMockWallet } from './wallet/createMockWallet';
export type { MockWallet } from './wallet/createMockWallet';
