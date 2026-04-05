const redactSensitiveFields = (payload: Record<string, unknown>): Record<string, unknown> => {
  const redacted: Record<string, unknown> = { ...payload };
  for (const key of Object.keys(redacted)) {
    if (key.toLowerCase().includes('token')) {
      redacted[key] = '[redacted]';
    }
  }

  return redacted;
};

export const logClientEvent = (event: string, payload: Record<string, unknown> = {}): void => {
  const basePayload = {
    event,
    at: new Date().toISOString(),
    ...redactSensitiveFields(payload),
  };

  // единый формат для последующей серверной корреляции
  console.info('[client-observability]', basePayload);
};

export const detectClientPlatform = (): string => {
  if (typeof navigator === 'undefined') {
    return 'ssr';
  }

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    return 'ios';
  }

  if (ua.includes('android')) {
    return 'android';
  }

  if (ua.includes('macintosh')) {
    return 'macos';
  }

  if (ua.includes('windows')) {
    return 'windows';
  }

  return 'web';
};

export const getBuildMarker = (): string => {
  const marker = (globalThis as { __APP_BUILD__?: string }).__APP_BUILD__;
  return marker ?? 'dev';
};
