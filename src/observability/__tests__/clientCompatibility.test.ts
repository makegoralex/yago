import {
  getClientCompatibilityMetrics,
  parseClientProfile,
  recordConnectError,
  recordRequestStart,
  recordResponseAbort,
  recordTtfb,
} from '../clientCompatibility';

describe('clientCompatibility metrics', () => {
  it('segments Safari on iOS 15.x separately', () => {
    const profile = parseClientProfile(
      'Mozilla/5.0 (iPad; CPU OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15'
    );

    expect(profile.family).toBe('Safari');
    expect(profile.osVersion).toBe('15.7');
    expect(profile.segment).toBe('iOS 15.x Safari');
  });

  it('tracks request/abort/connect-error/ttfb counters by segment', () => {
    const profile = parseClientProfile(
      'Mozilla/5.0 (iPad; CPU OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15'
    );
    recordRequestStart(profile);
    recordConnectError(profile);
    recordResponseAbort(profile);
    recordTtfb(profile, 120);
    recordTtfb(profile, 80);

    const metrics = getClientCompatibilityMetrics();
    expect(metrics['iOS 15.x Safari']).toMatchObject({
      requests: expect.any(Number),
      connectErrors: expect.any(Number),
      responseAborts: expect.any(Number),
      ttfbSamples: expect.any(Number),
      avgTtfbMs: expect.any(Number),
    });
  });
});
