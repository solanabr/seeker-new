/**
 * react-native-safe-area-context shim — simulator-boundary stand-in.
 *
 * The kit-expo-minimal home screen wraps its content in `SafeAreaView` from
 * `react-native-safe-area-context`. The real package's web build pulls in native
 * measurement plumbing that is fragile under the preview's plain react-native-web +
 * Vite setup. In the frameless preview there is no device notch to inset around, so
 * we map the safe-area surface to zero-inset passthroughs: `SafeAreaView` → `View`,
 * the providers → fragments, and the insets/frame hooks → zeros. Screens render
 * identically, just without artificial padding the device frame already accounts for.
 */

import { createContext, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

const INSETS = { top: 0, bottom: 0, left: 0, right: 0 };
const FRAME = { x: 0, y: 0, width: 0, height: 0 };

export function SafeAreaView({ edges: _edges, ...rest }: ViewProps & { edges?: unknown }) {
  return <View {...rest} />;
}

export function SafeAreaProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export const SafeAreaInsetsContext = createContext(INSETS);
export const SafeAreaFrameContext = createContext(FRAME);

export function useSafeAreaInsets() {
  return INSETS;
}

export function useSafeAreaFrame() {
  return FRAME;
}

export function withSafeAreaInsets<T>(Component: T): T {
  return Component;
}

export const initialWindowMetrics = { insets: INSETS, frame: FRAME };
