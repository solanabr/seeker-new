/**
 * Seeker / Expo project detection for the preview pane.
 *
 * The preview pane shows the Seeker device frame around the running preview URL
 * for mobile (Expo / React Native) projects, and the bare iframe for plain-web
 * projects. This heuristic decides which: it looks for the markers a
 * kit-expo-minimal-shaped app carries — an `app.json` (Expo config) anywhere in
 * the tree, or an `expo` / `react-native` dependency in any `package.json`.
 *
 * It reads the in-memory file map (the WebContainer's view), so it costs nothing
 * and updates as files stream in. The heuristic is deliberately permissive: a
 * false positive only wraps a web preview in a phone frame (the user can toggle
 * it off), while a false negative would hide the simulator for a Seeker app.
 */

import type { FileMap } from '~/lib/stores/files';

const MOBILE_DEP_RE = /"(expo|react-native|@solana-mobile\/[^"]+)"\s*:/;

export function isSeekerProject(files: FileMap): boolean {
  for (const [path, dirent] of Object.entries(files)) {
    if (!dirent || dirent.type !== 'file') {
      continue;
    }

    // An Expo config file is the strongest single signal.
    if (path.endsWith('/app.json') || path.endsWith('/app.config.js') || path.endsWith('/app.config.ts')) {
      return true;
    }

    // Otherwise look for a mobile dependency in any package.json.
    if (path.endsWith('/package.json') || path.endsWith('package.json')) {
      if (!dirent.isBinary && MOBILE_DEP_RE.test(dirent.content)) {
        return true;
      }
    }
  }

  return false;
}
