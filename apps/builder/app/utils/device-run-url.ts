const EXPO_DEVICE_URL_RE = /\bexp(?:\+[A-Za-z0-9._-]+)?:\/\/[^\s"'<>]+/g;
const TRAILING_URL_PUNCTUATION_RE = /[),.;\]]+$/;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

export type DeviceRunUrlKind = 'expo-go' | 'development-build';

export function extractExpoDeviceUrl(output: string): string | undefined {
  const cleanOutput = stripAnsi(output);
  const matches = cleanOutput.match(EXPO_DEVICE_URL_RE);

  if (!matches) {
    return undefined;
  }

  return matches.map(cleanDeviceRunUrl).find(isDeviceRunUrl);
}

export function previewUrlToExpoDeviceUrl(previewUrl: string): string | undefined {
  let url: URL;

  try {
    url = new URL(previewUrl);
  } catch {
    return undefined;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return undefined;
  }

  return `exp://${url.hostname}${url.port ? `:${url.port}` : ''}`;
}

export function rewriteLocalDeviceRunUrl(
  deviceRunUrl: string,
  replacementHost: string | undefined,
): string | undefined {
  if (!replacementHost || isLocalHost(replacementHost)) {
    return undefined;
  }

  const url = parseUrl(deviceRunUrl);

  if (!url) {
    return undefined;
  }

  if (url.protocol === 'exp:') {
    if (!isLocalHost(url.hostname)) {
      return undefined;
    }

    url.hostname = replacementHost;

    return url.toString();
  }

  if (isDevelopmentBuildUrl(url)) {
    const nestedUrl = parseUrl(url.searchParams.get('url') ?? '');

    if (!nestedUrl || !isLocalHost(nestedUrl.hostname)) {
      return undefined;
    }

    nestedUrl.hostname = replacementHost;
    url.searchParams.set('url', nestedUrl.toString());

    return url.toString();
  }

  return undefined;
}

export function getDeviceRunUrlKind(deviceRunUrl: string): DeviceRunUrlKind {
  const url = parseUrl(deviceRunUrl);

  if (url && isDevelopmentBuildUrl(url)) {
    return 'development-build';
  }

  return 'expo-go';
}

export function isLocalDeviceRunUrl(deviceRunUrl: string): boolean {
  const url = parseUrl(deviceRunUrl);

  if (!url) {
    return false;
  }

  if (url.protocol === 'exp:') {
    return isLocalHost(url.hostname);
  }

  if (isDevelopmentBuildUrl(url)) {
    const nestedUrl = parseUrl(url.searchParams.get('url') ?? '');
    return nestedUrl ? isLocalHost(nestedUrl.hostname) : false;
  }

  return false;
}

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase()) || hostname.startsWith('127.');
}

function isDeviceRunUrl(value: string): boolean {
  const url = parseUrl(value);
  return url ? url.protocol === 'exp:' || isDevelopmentBuildUrl(url) : false;
}

function isDevelopmentBuildUrl(url: URL): boolean {
  return url.protocol.startsWith('exp+');
}

function cleanDeviceRunUrl(value: string): string {
  return value.replace(TRAILING_URL_PUNCTUATION_RE, '');
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function stripAnsi(value: string): string {
  return value.replace(
    /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    '',
  );
}
