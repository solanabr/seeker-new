/**
 * Preview web entry — what `preview:simulator` serves and the builder's
 * `<Simulator>` iframe frames.
 *
 * It boots the REAL, unmodified beeman template screens (via the preset's
 * `mountSimulatorPreview`) with the mock wallet wired in — the reference a
 * generated project mirrors. Unlike the dev harness, it renders **frameless**:
 * the Seeker device frame is drawn host-side (the builder, or the harness), so
 * this page is just the app filling the viewport + the approval-sheet overlay.
 *
 * The app root reused here is the harness's `TemplateHome`, which already wraps
 * itself in the (aliased) `MobileWalletProvider` — hence `provideWallet: false`.
 *
 * Run: pnpm preview:simulator   (http://localhost:5274)
 */

import { mountSimulatorPreview } from '../../preset/web-entry';
import { TemplateHome } from '../dev-harness/template-home';

mountSimulatorPreview({
  AppRoot: TemplateHome,
  appKey: 'beeman-template',
  // TemplateHome mounts its own (aliased) MobileWalletProvider.
  provideWallet: false,
});
