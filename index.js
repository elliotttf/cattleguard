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
 *       @param {Request} req
 *       @param {Response} res
 *       @param {function} next
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
 *       @param {string} key
 *         The key for the rate limit information.
 *       @param {function} callback
 *         A callback to execute after getting, parameters are err and limit
 *         where limit is the value for the key.
 *   - set: sets a value in the store.
 *       @param {string} key
 *         The key for the rate limit information.
 *       @param {function} callback
 *         A callback to execute after getting, parameters are err.
 *   - pexpire: sets an expire time in milliseconds for a key.
 *       @param {string} key
 *         The key for the rate limit information.
 *       @param {integer} expire
 *         Time in milliseconds before the key expires.
 */
module.exports = function (config, store) {
  return function (req, res, next) {
    var key = [ 'cattleguard' ];

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

    store.get(key, function (getErr, limit) {
      if (getErr) {
        return next(getErr);
      }

      var now = Date.now();
      limit = limit ? JSON.parse(limit) : {
        total: config.total,
        remaining: config.total,
        reset: now + config.expire
      };

      if (now > limit.reset) {
        limit.reset = now + config.expire;
        limit.remaining = config.total;
      }

      limit.remaining -= 1;
      store.set(key, JSON.stringify(limit), function (setErr) {
        if (setErr) {
          return next(setErr);
        }

        // For redis clients, set an expire.
        if (typeof store.pexpire === 'function') {
          store.pexpire(key, (limit.reset - now));
        }

        if (limit.remaining >= 0) {
          return next();
        }

        var after = Math.ceil((limit.reset - now) / 1000);
        res.set('Retry-After', after);

        config.onRateLimited(req, res, next);
      })
    });
  };
};

