import { describe, expect, it, jest } from '@jest/globals';

import { signedOnly } from './signed-fetch';

const KEY = 'sb_publishable_test';
const ok = () => {
  const fetchFn = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response('[]'));
  return { fetchFn, guarded: signedOnly(fetchFn, KEY) };
};

describe('signedOnly', () => {
  it('fails a database request signed only with the publishable key, without sending it', async () => {
    const { fetchFn, guarded } = ok();
    await expect(
      guarded('http://127.0.0.1:54321/rest/v1/adventures', { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } }),
    ).rejects.toThrow(TypeError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends a database request that carries the Adventurer’s token', async () => {
    const { fetchFn, guarded } = ok();
    await guarded('http://127.0.0.1:54321/rest/v1/rpc/check_in', { headers: { Authorization: 'Bearer eyJ.user.token', apikey: KEY } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sends Auth requests, which sign in with the publishable key', async () => {
    const { fetchFn, guarded } = ok();
    await guarded('http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token', {
      headers: new Headers({ Authorization: `Bearer ${KEY}` }),
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
