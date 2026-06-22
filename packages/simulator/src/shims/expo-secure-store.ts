/**
 * expo-secure-store shim — in-memory store. The native SecureStore module is not
 * available under react-native-web/Vite; the preview's auth client never persists
 * a real session, so an in-memory map is enough to satisfy callers.
 */

const memory = new Map<string, string>();

export async function getItemAsync(key: string) {
  return memory.has(key) ? (memory.get(key) as string) : null;
}

export async function setItemAsync(key: string, value: string) {
  memory.set(key, value);
}

export async function deleteItemAsync(key: string) {
  memory.delete(key);
}

export async function isAvailableAsync() {
  return true;
}

export const WHEN_UNLOCKED = 'whenUnlocked';

export default { getItemAsync, setItemAsync, deleteItemAsync, isAvailableAsync, WHEN_UNLOCKED };
