const {
  StaticMapParameterError,
  buildStaticMapUrl,
} = require('../services/staticMap');

describe('buildStaticMapUrl', () => {
  test('creates an encoded Static Maps request with a marker', () => {
    const url = new URL(
      buildStaticMapUrl({
        apiKey: 'test-key',
        latitude: 40.015,
        longitude: -105.2705,
        label: 'a',
      }),
    );

    expect(url.origin + url.pathname).toBe(
      'https://maps.googleapis.com/maps/api/staticmap',
    );
    expect(url.searchParams.get('center')).toBe('40.015,-105.2705');
    expect(url.searchParams.get('size')).toBe('640x400');
    expect(url.searchParams.get('scale')).toBe('2');
    expect(url.searchParams.get('markers')).toBe('color:red|label:A|40.015,-105.2705');
    expect(url.searchParams.get('key')).toBe('test-key');
  });

  test('rejects coordinates outside the valid ranges', () => {
    expect(() =>
      buildStaticMapUrl({
        apiKey: 'test-key',
        latitude: 91,
        longitude: 0,
      }),
    ).toThrow(StaticMapParameterError);
  });
});
