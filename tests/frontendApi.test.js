const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const request = require('supertest');
const createApp = require('../app');

const source = fs.readFileSync(path.join(__dirname, '../public/js/api.js'), 'utf8');

test('serves the profile page with a policy that allows local image previews', async () => {
  const response = await request(createApp()).get('/profile.html');
  expect(response.status).toBe(200);
  expect(response.headers['content-security-policy']).toContain(
    "img-src 'self' data: https: blob:",
  );
});

describe('browser API request formats', () => {
  let context;

  beforeEach(() => {
    context = vm.createContext({
      FormData,
      fetch: jest
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    });
    vm.runInContext(source, context);
  });

  test('sends the original FormData and lets the browser supply multipart headers', async () => {
    const form = new FormData();
    form.append('avatar', new Blob(['picture'], { type: 'image/png' }), 'picture.png');
    await context.api.putForm('/users/me/avatar', form);
    const [url, options] = context.fetch.mock.calls[0];
    expect(url).toBe('/users/me/avatar');
    expect(options.method).toBe('PUT');
    expect(options.body).toBe(form);
    expect(options.credentials).toBe('same-origin');
    expect(options.headers['Content-Type']).toBeUndefined();
  });

  test('keeps existing JSON requests working', async () => {
    await context.api.putJson('/activities/1', { title: 'Games' });
    const [, options] = context.fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ title: 'Games' });
  });

  test('passes server upload errors to the caller', async () => {
    context.fetch.mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ error: 'Picture must be 5 MB or smaller.' }),
    });
    await expect(
      context.api.putForm('/users/me/avatar', new FormData()),
    ).rejects.toMatchObject({
      status: 413,
      message: 'Picture must be 5 MB or smaller.',
    });
  });
});
