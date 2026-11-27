
/**
 * YM-03 login rate limiter.
 * Limits failed attempts per IP and normalized email.
 *
 * Suitable for local development and unit tests.
 * Distributed deployments require a shared rate-limit store.
 */
export function createLoginRateLimiter({
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  now = () => Date.now(),
} = {}) {
  const attempts = new Map();

  function keyFor(ip, email) {
    return `${ip || 'unknown'}|${email.trim().toLowerCase()}`;
  }

  function getEntry(key) {
    const entry = attempts.get(key);

    if (!entry) return null;

    if (entry.resetAt <= now()) {
      attempts.delete(key);
      return null;
    }

    return entry;
  }

  return {
    isLimited(ip, email) {
      const key = keyFor(ip, email);
      return (getEntry(key)?.count ?? 0) >= maxAttempts;
    },

    recordFailure(ip, email) {
      const key = keyFor(ip, email);
      const entry = getEntry(key);

      if (!entry) {
        attempts.set(key, {
          count: 1,
          resetAt: now() + windowMs,
        });
      } else {
        entry.count += 1;
      }
    },

    clear(ip, email) {
      attempts.delete(keyFor(ip, email));
    },
  };
}
