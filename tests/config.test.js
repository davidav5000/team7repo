const { validateProductionEnv } = require('../config/validateEnv');

describe('production environment validation', () => {
  test('does nothing outside production', () => {
    expect(() =>
      validateProductionEnv({
        NODE_ENV: 'development',
      }),
    ).not.toThrow();
  });

  test('requires SESSION_SECRET in production', () => {
    expect(() =>
      validateProductionEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://example',
      }),
    ).toThrow('SESSION_SECRET');
  });

  test('rejects the example SESSION_SECRET in production', () => {
    expect(() =>
      validateProductionEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://example',
        SESSION_SECRET: 'change-me',
      }),
    ).toThrow('SESSION_SECRET');
  });

  test('requires DATABASE_URL in production', () => {
    expect(() =>
      validateProductionEnv({
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-real-secret',
      }),
    ).toThrow('DATABASE_URL');
  });

  test('accepts complete production configuration', () => {
    expect(() =>
      validateProductionEnv({
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-real-secret',
        DATABASE_URL: 'postgres://example',
      }),
    ).not.toThrow();
  });
});
