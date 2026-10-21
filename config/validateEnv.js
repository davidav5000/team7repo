function validateProductionEnv(env = process.env) {
  if (env.NODE_ENV !== 'production') return;

  const missing = [];

  if (!env.SESSION_SECRET || env.SESSION_SECRET === 'change-me') {
    missing.push('SESSION_SECRET');
  }

  if (!env.DATABASE_URL) {
    missing.push('DATABASE_URL');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required production configuration: ${missing.join(', ')}`,
    );
  }
}

module.exports = {
  validateProductionEnv,
};
