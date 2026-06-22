/**
 * PayFriend preview web entry — mounts the GENERATED screen.
 *
 * Imports the real generated `app/index.tsx` (its default-exported screen) via
 * the `@template/` alias (→ generated/payfriend/apps/mobile) and wraps it in the
 * mock wallet provider. So this previews exactly what the prompt agent produced.
 * Run: pnpm exec vite --config examples/preview-payfriend/vite.config.ts
 */

import { mountSimulatorPreview } from '../../preset/web-entry';
import GeneratedHome from '@template/app/index';

mountSimulatorPreview({
  AppRoot: GeneratedHome,
  appKey: 'payfriend',
  // The generated screen does not mount its own provider, so wrap it here.
  provideWallet: true,
});
