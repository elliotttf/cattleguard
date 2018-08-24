'use strict';

/**
 * Returns a middleware for rate limiting.
 *
 * @param {object} config
 *   Rate limit configuration, contains:
 *   - total: integer, the number of requests per a time period to allow before
 *     rate limiting.
 *   - expire: integer, the time period in milliseconds to limit requests.
 *   - onRateLimited: function, the method to execute when a rate limit has been
 *     reached. Accepts:
 *       req: the Request object
 *       res: the Response object
 *       next: the next callback to execute
 *   - perRoute: boolean, true if rate limiting should happen per route.
 *     default: false
 *   - perMethod: boolean, true if rate limiting should happen per HTTP method.
 *     default: false
 *   - lookup: function, used to return an identifier for the user requesting.
 *     This will have the effect of creating a per-user rate limit.
 *     default: undefined
 * @param {*} store
 *   A store to maintain the rate limit counts in. Must provide get and set
 *   methods with the following signatures:
 *   - get: gets a value from the store.
 *       key: The key for the rate limit information.
 *       callback: A callback to execute after getting, parameters are err and
 *         limit where limit is the value for the key.
 *   - set: sets a value in the store.
 *       key: The key for the rate limit information.
 *       value: The value to store.
 *       ttl: The timeout in seconds for the rate limit information.
 *       callback: A callback to execute after setting, parameters are err.
 *
 * @returns {function}
 *   The cattleguard middleware.
 */
module.exports = (config, store) => (req, res, next) => {
  // The key is the unique identifier for a subject. Different keys will have
  // independent rate limits applied.
  let key = ['cattleguard'];

  if (config.perRoute) {
    key.push(req.path);
  }
  if (config.perMethod) {
    key.push(req.method);
  }
  if (typeof config.lookup === 'function') {
    // Allow the application to create variants based on any logic depending on
    // the request coming in.
    key = key.concat(config.lookup(req));
  }

  key = key.join('::');

  store.get(key, (getErr, limit) => {
    if (getErr) {
      return next(getErr);
    }

    const now = Date.now();
    // If the key was not found, initialize as a brand new rate limit. This can
    // happen if the subject never made a request or if the key was expired in
    // the store.
    const myLimit = limit ? JSON.parse(limit) : {
      total: config.total,
      remaining: config.total,
      reset: now + config.expire,
    };

    if (now > myLimit.reset) {
      myLimit.reset = now + config.expire;
      myLimit.remaining = config.total;
    }

    // Decrement the remaining hits and save the new count back in the store.
    // Since express may be running in multiple different parallel processes,
    // the hits need to be recorded in a shared centralized location.
    myLimit.remaining -= 1;
    const retryAfter = Math.ceil((myLimit.reset - now) / 1000);
    return store.set(key, JSON.stringify(myLimit), retryAfter, (setErr) => {
      if (setErr) {
        return next(setErr);
      }

      if (myLimit.remaining >= 0) {
        return next();
      }

      res.set('Retry-After', retryAfter);

      return config.onRateLimited(req, res, next);
    });
  });
};
