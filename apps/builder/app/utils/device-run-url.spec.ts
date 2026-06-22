import { describe, expect, it } from 'vitest';
import {
  extractExpoDeviceUrl,
  getDeviceRunUrlKind,
  isLocalDeviceRunUrl,
  previewUrlToExpoDeviceUrl,
  rewriteLocalDeviceRunUrl,
} from './device-run-url';

describe('device-run-url', () => {
  it('extracts Expo Go URLs from CLI output', () => {
    expect(extractExpoDeviceUrl('Metro waiting on exp://192.168.1.24:8081')).toBe('exp://192.168.1.24:8081');
  });

  it('extracts development-build URLs from CLI output', () => {
    const url = 'exp+payfriend://expo-development-client/?url=http%3A%2F%2F192.168.1.24%3A8081';

    expect(extractExpoDeviceUrl(`Scan this QR: ${url}`)).toBe(url);
    expect(getDeviceRunUrlKind(url)).toBe('development-build');
  });

  it('converts a Metro preview URL into an Expo launch URL', () => {
    expect(previewUrlToExpoDeviceUrl('http://localhost:8081')).toBe('exp://localhost:8081');
  });

  it('detects and rewrites local Expo Go URLs', () => {
    expect(isLocalDeviceRunUrl('exp://localhost:8081')).toBe(true);
    expect(rewriteLocalDeviceRunUrl('exp://localhost:8081', '192.168.1.24')).toBe('exp://192.168.1.24:8081');
  });

  it('rewrites local nested development-build URLs', () => {
    const rewritten = rewriteLocalDeviceRunUrl(
      'exp+payfriend://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081',
      '192.168.1.24',
    );

    expect(rewritten).toBe('exp+payfriend://expo-development-client/?url=http%3A%2F%2F192.168.1.24%3A8081%2F');
  });
});
