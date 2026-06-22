/**
 * Seeker preview web entry. Mounts this app's real provider tree + home screen
 * (`app/index.tsx` under `components/app-providers`) inside the mock Mobile Wallet
 * Adapter, so the full wallet flow (connect → approval → sign → tx-result) runs in
 * the browser. Renders frameless — the Seeker device frame is drawn by the builder
 * around this page's URL.
 *
 * The kit-expo-minimal entry screen does NOT mount its own providers (the app's
 * `_layout.tsx` does, via Expo Router, which the preview does not run). So we wrap
 * `HomeScreen` in the app's own `AppProviders` here. `AppProviders` renders the
 * `@wallet-ui/react-native-kit` `MobileWalletProvider` — which the simulator aliases
 * to the mock kit — so `provideWallet: false`: the wallet seam is already supplied.
 */

import { mountSimulatorPreview } from './sim/preset/web-entry';
import { AppProviders } from '../components/app-providers';
import HomeScreen from '../app/index';

function AppRoot() {
  return (
    <AppProviders>
      <HomeScreen />
    </AppProviders>
  );
}

mountSimulatorPreview({
  AppRoot,
  appKey: 'seeker-preview',
  // AppProviders already mounts the (aliased) MobileWalletProvider.
  provideWallet: false,
});
