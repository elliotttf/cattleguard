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
 *   methods and _may_ provide a pexpire method with the following signatures:
 *   - get: gets a value from the store.
 *       key: The key for the rate limit information.
 *       callback: A callback to execute after getting, parameters are err and
 *         limit where limit is the value for the key.
 *   - set: sets a value in the store.
 *       key: The key for the rate limit information.
 *       value: The value to store.
 *       callback: A callback to execute after setting, parameters are err.
 *   - pexpire: sets an expire time in milliseconds for a key.
 *       key: The key for the rate limit information.
 *       expire: Time in milliseconds before the key expires.
 *
 * @returns {function}
 *   The cattleguard middleware.
 */
module.exports = (config, store) => (req, res, next) => {
  let key = ['cattleguard'];

  if (config.perRoute) {
    key.push(req.path);
  }
  if (config.perMethod) {
    key.push(req.method);
  }
  if (typeof config.lookup === 'function') {
    key.push(config.lookup(req));
  }

  key = key.join('::');

  store.get(key, (getErr, limit) => {
    if (getErr) {
      return next(getErr);
    }

    const now = Date.now();
    const myLimit = limit ? JSON.parse(limit) : {
      total: config.total,
      remaining: config.total,
      reset: now + config.expire,
    };

    if (now > myLimit.reset) {
      myLimit.reset = now + config.expire;
      myLimit.remaining = config.total;
    }

    myLimit.remaining -= 1;
    return store.set(key, JSON.stringify(myLimit), (setErr) => {
      if (setErr) {
        return next(setErr);
      }

      // For redis clients, set an expire.
      if (typeof store.pexpire === 'function') {
        store.pexpire(key, (myLimit.reset - now));
      }

      if (myLimit.remaining >= 0) {
        return next();
      }

      const after = Math.ceil((myLimit.reset - now) / 1000);
      res.set('Retry-After', after);

      return config.onRateLimited(req, res, next);
    });
  });
};

