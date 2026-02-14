import { resolveAccessToken } from '../auth';

const createRequest = (headers: Record<string, string>, authorizationHeader?: string) => {
  const get = ((name: string) => {
    if (name.toLowerCase() === 'authorization') {
      return authorizationHeader;
    }

    return undefined;
  }) as (name: string) => string | undefined;

  return {
    headers,
    query: {},
    get,
  } as any;
};

describe('resolveAccessToken', () => {
  it('prefers X-Yago-App-Token over Authorization header', () => {
    const req = createRequest({ 'x-yago-app-token': 'internal-app-token' }, 'Bearer external-token');

    expect(resolveAccessToken(req)).toBe('internal-app-token');
  });

  it('falls back to Authorization when custom token header is absent', () => {
    const req = createRequest({}, 'Bearer backend-token');

    expect(resolveAccessToken(req)).toBe('backend-token');
  });
});
