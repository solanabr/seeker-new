/**
 * Web shim for `expo-router` — preview-only.
 *
 * `expo-router` is Metro/native-only (file-based routing + a native navigator),
 * so it cannot resolve under the react-native-web preview bundle. Generated
 * screens still import it (`Link`, `useRouter`, `router`, and layouts use
 * `Stack`/`Tabs`). This shim makes those imports resolve and renders the screen's
 * own UI; navigation is intentionally inert because a preview shows a single
 * landing screen, not a full navigable app (full navigation/fidelity is the
 * cloud-emulator backend's job).
 *
 * Scope: exactly the surface the beeman template + generated apps use —
 * `Stack`(+`.Screen`), `Tabs`(+`.Screen`), `Slot`, `Link`, `Redirect`, `router`,
 * `useRouter`, and the read hooks. Keep it minimal; extend only when a real
 * generated app needs more.
 *
 * It renders through `react-native` (aliased to react-native-web by the preset),
 * so it never pulls in a native dependency.
 */

import { createElement, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const noop = () => undefined;

function passthrough({ children }: AnyProps): ReactNode {
  // Layouts/navigators just render whatever they wrap in the preview.
  return (children ?? null) as ReactNode;
}

function screen(): null {
  // `<Stack.Screen>` / `<Tabs.Screen>` are route config, not UI.
  return null;
}

/** `<Stack>` / `<Tabs>` — render children; `.Screen` is a no-op config element. */
export const Stack = Object.assign(passthrough, { Screen: screen });
export const Tabs = Object.assign(passthrough, { Screen: screen });

/** `<Slot>` — renders the nested route's children. */
export function Slot({ children }: AnyProps): ReactNode {
  return (children ?? null) as ReactNode;
}

/**
 * `<Redirect>` — a navigation directive, not UI. In a single-screen preview the
 * target screen is mounted directly, so this renders nothing (and logs, so a
 * blank phone from an un-customized `app/index.tsx` redirect is explained).
 */
export function Redirect({ href }: { href?: unknown }): null {
  if (typeof console !== 'undefined') {
    console.info(
      `[expo-router shim] <Redirect href="${String(
        href,
      )}"> is inert in preview — mount the target screen directly to preview it.`,
    );
  }
  return null;
}

/** `<Link>` — render its content as pressable text; navigation is inert. */
export function Link({ children, asChild: _asChild, href: _href, ...rest }: AnyProps): ReactNode {
  void _asChild;
  void _href;
  return createElement(
    Pressable,
    { ...rest, onPress: noop },
    typeof children === 'string' ? createElement(Text, null, children) : (children as ReactNode),
  );
}

/** Imperative router — inert no-ops (a preview does not navigate). */
export const router = {
  push: noop,
  replace: noop,
  navigate: noop,
  back: noop,
  canGoBack: () => false,
  setParams: noop,
  dismiss: noop,
  dismissAll: noop,
};

export function useRouter() {
  return router;
}

export function usePathname(): string {
  return '/';
}

export function useSegments(): string[] {
  return [];
}

export function useLocalSearchParams<T extends Record<string, string> = Record<string, string>>(): T {
  return {} as T;
}

export function useGlobalSearchParams<T extends Record<string, string> = Record<string, string>>(): T {
  return {} as T;
}

export function useNavigation() {
  return { navigate: noop, goBack: noop, setOptions: noop, addListener: () => noop };
}

export function useFocusEffect(): void {
  // No focus lifecycle in a static preview.
}

/** Type-only export some files reference; harmless at runtime. */
export type Href = string;
