import { atom, type WritableAtom } from 'nanostores';
import {
  extractExpoDeviceUrl,
  getDeviceRunUrlKind,
  isLocalDeviceRunUrl,
  previewUrlToExpoDeviceUrl,
  type DeviceRunUrlKind,
} from '~/utils/device-run-url';

const EXPO_METRO_PORT = 8081;
const OUTPUT_BUFFER_LENGTH = 4096;

export type DeviceRunTargetSource = 'expo-output' | 'metro-port';

export interface DeviceRunTarget {
  url: string;
  kind: DeviceRunUrlKind;
  source: DeviceRunTargetSource;
  local: boolean;
  port?: number;
}

class DeviceRunStore {
  #outputBuffer = '';

  target: WritableAtom<DeviceRunTarget | undefined> =
    import.meta.hot?.data.deviceRunTarget ?? atom<DeviceRunTarget | undefined>(undefined);

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.deviceRunTarget = this.target;
    }
  }

  registerProcessOutput(output: string) {
    this.#outputBuffer = `${this.#outputBuffer}${output}`.slice(-OUTPUT_BUFFER_LENGTH);

    const url = extractExpoDeviceUrl(this.#outputBuffer);

    if (!url) {
      return;
    }

    this.target.set({
      url,
      kind: getDeviceRunUrlKind(url),
      source: 'expo-output',
      local: isLocalDeviceRunUrl(url),
    });
  }

  registerPreviewPort(port: number, type: 'open' | 'close', previewUrl: string) {
    if (port !== EXPO_METRO_PORT) {
      return;
    }

    const currentTarget = this.target.get();

    if (type === 'close') {
      if (currentTarget?.source === 'metro-port') {
        this.target.set(undefined);
      }

      return;
    }

    const url = previewUrlToExpoDeviceUrl(previewUrl);

    if (!url || currentTarget?.source === 'expo-output') {
      return;
    }

    this.target.set({
      url,
      kind: 'expo-go',
      source: 'metro-port',
      local: isLocalDeviceRunUrl(url),
      port,
    });
  }
}

export const deviceRunStore = new DeviceRunStore();
