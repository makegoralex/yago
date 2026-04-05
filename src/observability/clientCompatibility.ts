export type ClientFamily = 'Safari' | 'Chrome' | 'Firefox' | 'Other';

export interface ClientProfile {
  family: ClientFamily;
  osVersion: string;
  segment: string;
}

interface SegmentMetrics {
  requests: number;
  connectErrors: number;
  responseAborts: number;
  ttfbSamples: number;
  ttfbTotalMs: number;
  ttfbMaxMs: number;
}

const DEFAULT_OS = 'unknown';
const DEFAULT_FAMILY: ClientFamily = 'Other';
const IOS_15_SAFARI_SEGMENT = 'iOS 15.x Safari';
const UNKNOWN_SEGMENT = 'other';
const metricsBySegment = new Map<string, SegmentMetrics>();

const ensureSegment = (segment: string): SegmentMetrics => {
  const existing = metricsBySegment.get(segment);
  if (existing) {
    return existing;
  }

  const initial: SegmentMetrics = {
    requests: 0,
    connectErrors: 0,
    responseAborts: 0,
    ttfbSamples: 0,
    ttfbTotalMs: 0,
    ttfbMaxMs: 0,
  };
  metricsBySegment.set(segment, initial);
  return initial;
};

export const parseClientProfile = (rawUserAgent: string | undefined): ClientProfile => {
  const userAgent = String(rawUserAgent ?? '').toLowerCase();
  const family: ClientFamily = userAgent.includes('safari') && !userAgent.includes('chrome')
    ? 'Safari'
    : userAgent.includes('chrome')
      ? 'Chrome'
      : userAgent.includes('firefox')
        ? 'Firefox'
        : DEFAULT_FAMILY;

  const iosVersionMatch = userAgent.match(/os (\d+)[._](\d+)(?:[._](\d+))?/);
  const osVersion = iosVersionMatch
    ? `${iosVersionMatch[1]}.${iosVersionMatch[2]}${iosVersionMatch[3] ? `.${iosVersionMatch[3]}` : ''}`
    : DEFAULT_OS;

  const isIos15Safari = family === 'Safari' && /^15\./.test(osVersion);
  const segment = isIos15Safari ? IOS_15_SAFARI_SEGMENT : UNKNOWN_SEGMENT;

  return { family, osVersion, segment };
};

export const recordRequestStart = (profile: ClientProfile): void => {
  ensureSegment(profile.segment).requests += 1;
};

export const recordConnectError = (profile: ClientProfile): void => {
  ensureSegment(profile.segment).connectErrors += 1;
};

export const recordResponseAbort = (profile: ClientProfile): void => {
  ensureSegment(profile.segment).responseAborts += 1;
};

export const recordTtfb = (profile: ClientProfile, ttfbMs: number): void => {
  const bucket = ensureSegment(profile.segment);
  bucket.ttfbSamples += 1;
  bucket.ttfbTotalMs += ttfbMs;
  bucket.ttfbMaxMs = Math.max(bucket.ttfbMaxMs, ttfbMs);
};

export const getClientCompatibilityMetrics = (): Record<string, SegmentMetrics & { avgTtfbMs: number }> => {
  const snapshot: Record<string, SegmentMetrics & { avgTtfbMs: number }> = {};
  for (const [segment, value] of metricsBySegment.entries()) {
    snapshot[segment] = {
      ...value,
      avgTtfbMs: value.ttfbSamples ? Number((value.ttfbTotalMs / value.ttfbSamples).toFixed(2)) : 0,
    };
  }

  return snapshot;
};

export const isIos15Safari = (profile: ClientProfile): boolean => profile.segment === IOS_15_SAFARI_SEGMENT;
