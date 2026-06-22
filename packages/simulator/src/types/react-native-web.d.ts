/**
 * Minimal ambient types for `react-native-web`.
 *
 * react-native-web does not ship its own TypeScript types, and pulling in the
 * full `@types/react-native` surface is overkill for the rendering boundary we
 * use. This declares only the `AppRegistry` API the `WebRenderBackend` relies on
 * to bootstrap an RN/Expo app into a DOM root.
 *
 * T02 (render the real beeman template) may broaden this or replace it with the
 * upstream types once the full RN-web component surface is exercised.
 */
declare module 'react-native-web' {
  import type { ComponentType } from 'react';

  export interface RunApplicationParameters {
    rootTag: Element | DocumentFragment;
    initialProps?: Record<string, unknown>;
    hydrate?: boolean;
    mode?: 'concurrent' | 'legacy';
  }

  export const AppRegistry: {
    registerComponent(
      appKey: string,
      getComponent: () => ComponentType<Record<string, unknown>>,
    ): string;
    runApplication(appKey: string, parameters: RunApplicationParameters): void;
    unmountApplicationComponentAtRootTag(rootTag: Element): void;
  };
}
