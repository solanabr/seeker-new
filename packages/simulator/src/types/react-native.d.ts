/**
 * Minimal ambient types for `react-native`.
 *
 * The bundler aliases `react-native` → `react-native-web`, so at runtime these
 * imports resolve to RNW's implementations. RN ships its own types (and the old
 * `@types/react-native` is deprecated + heavy), so — mirroring the focused
 * `react-native-web.d.ts` shim — we declare only the primitives the simulator's
 * heroui-native shim and dev harness actually import. Props are intentionally
 * loose (`any`): the simulator does not type-check the rendered RN tree, it just
 * needs the imports to resolve.
 */
declare module 'react-native' {
  import type { ComponentType, ReactNode } from 'react';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type RNComponent = ComponentType<any>;

  export const View: RNComponent;
  export const Text: RNComponent;
  export const ScrollView: RNComponent;
  export const Pressable: RNComponent;
  export const TouchableOpacity: RNComponent;
  export const ActivityIndicator: RNComponent;
  export const Image: RNComponent;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type ViewProps = Record<string, any> & { children?: ReactNode };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type TextProps = Record<string, any> & { children?: ReactNode };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type ScrollViewProps = Record<string, any> & { children?: ReactNode };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type ViewStyle = Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type TextStyle = Record<string, any>;

  export const StyleSheet: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create<T extends Record<string, any>>(styles: T): T;
    flatten(style: unknown): Record<string, unknown>;
    readonly hairlineWidth: number;
    absoluteFill: object;
  };

  export const Platform: {
    OS: 'ios' | 'android' | 'web' | string;
    select<T>(spec: Record<string, T>): T | undefined;
  };

  export const Alert: {
    alert(title: string, message?: string): void;
  };
}
