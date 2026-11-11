const request = require('supertest');

const createApp = require('../app');

describe('place search route', () => {
  let fetchMock;
  let app;

  beforeAll(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'server-only-test-key';
    fetchMock.mockReset();
    app = createApp();
  });

  afterAll(() => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    fetchMock.mockRestore();
  });

  test('returns normalized place results with a Rexburg search bias', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            displayName: { text: 'BYU-Idaho Library' },
            formattedAddress: '525 S Center St, Rexburg, ID 83460, USA',
            location: { latitude: 43.826, longitude: -111.789 },
            placeId: 'not-returned',
          },
        ],
      }),
    });

    const response = await request(app).get('/api/maps/search?q=  library  ');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      places: [
        {
          name: 'BYU-Idaho Library',
          address: '525 S Center St, Rexburg, ID 83460, USA',
          latitude: 43.826,
          longitude: -111.789,
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(options.headers['X-Goog-Api-Key']).toBe('server-only-test-key');
    expect(options.headers['X-Goog-FieldMask']).toBe(
      'places.displayName,places.formattedAddress,places.location',
    );
    expect(JSON.parse(options.body)).toMatchObject({
      textQuery: 'library',
      pageSize: 5,
      locationBias: {
        circle: {
          center: { latitude: 43.826, longitude: -111.789 },
          radius: 25000,
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('server-only-test-key');
  });

  test.each([
    ['missing query', undefined],
    ['blank query', '   '],
    ['short query', 'a'],
    ['oversized query', 'x'.repeat(101)],
  ])('rejects %s without calling Google', async (_label, query) => {
    const url = query === undefined ? '/api/maps/search' : `/api/maps/search?q=${query}`;
    const response = await request(app).get(url);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: expect.any(String),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns an empty list when Google has no results', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ places: [] }) });

    const response = await request(app).get('/api/maps/search?q=rare%20place');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ places: [] });
  });

  test('returns an application error when Google fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    const response = await request(app).get('/api/maps/search?q=library');

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: 'Location search is temporarily unavailable',
    });
  });

  test('returns an application error for malformed Google data', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ places: [{}] }) });

    const response = await request(app).get('/api/maps/search?q=library');

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: 'Location search returned an invalid response',
    });
  });
});
