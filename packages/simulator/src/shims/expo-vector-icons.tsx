/**
 * @expo/vector-icons shim — simulator-boundary stand-in (T02).
 *
 * The real `@expo/vector-icons` loads icon fonts through `expo-font`/Metro asset
 * resolution, which the Vite + react-native-web pipeline does not provide. Rather
 * than edit the template, we alias `@expo/vector-icons` to this shim, which maps
 * the handful of Ionicons glyph names the rendered template uses to Unicode
 * symbols. Documented in the README's shim table.
 */

import { Text } from 'react-native';

const GLYPHS: Record<string, string> = {
  'checkmark-circle': '✓',
  'close-circle': '✕',
  'hourglass-outline': '⏳',
  home: '⌂',
  'home-outline': '⌂',
  apps: '▦',
  'apps-outline': '▦',
  person: '☻',
  'person-outline': '☺',
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export function Ionicons({ name, size = 20, color = '#fff' }: IconProps) {
  return <Text style={{ fontSize: size, color }}>{GLYPHS[name] ?? '•'}</Text>;
}

// Other icon families the template might reference — same fallback behaviour.
export const MaterialIcons = Ionicons;
export const MaterialCommunityIcons = Ionicons;
export const FontAwesome = Ionicons;
export const Feather = Ionicons;

export default { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome, Feather };
