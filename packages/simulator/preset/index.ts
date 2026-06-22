/**
 * seeker-simulator/preset — the simulator preview preset (bundler half).
 *
 * This barrel is the **Node / Vite-config** surface: the react-native-web Vite
 * config a previewed project spreads into its `vite.config`. It is intentionally
 * separate from the browser entry — `vite-preset` runs Node-only code at module
 * load (`require.resolve`, `node:*`), so it must never be pulled into a browser
 * bundle. The runtime half is imported from `seeker-simulator/preset/web-entry`.
 *
 * See ./README.md for the app-root entry contract and the `preview:simulator`
 * script a previewed project runs (the script bolt executes inside the
 * WebContainer to serve the URL the `<Simulator>` iframe frames).
 */

export {
  createSimulatorViteConfig,
  simulatorAliases,
  type SimulatorPresetOptions,
} from './vite-preset';
