# Cattleguard

[![Greenkeeper badge](https://badges.greenkeeper.io/elliotttf/cattleguard.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/elliotttf/cattleguard.svg?branch=master)](https://travis-ci.org/elliotttf/cattleguard)
[![Coverage Status](https://coveralls.io/repos/github/elliotttf/cattleguard/badge.svg?branch=master)](https://coveralls.io/github/elliotttf/cattleguard?branch=master)

An express middleware for rate limiting an application to provide stampede protection.

## Usage

```javascript
const cattleguard = require('cattleguard');
const redis = require('redis');

const rClient = redis.createClient();

// Cattleguard now expects the `set` method to include a ttl value. If your
// store does not accept this value by default you will need to wrap your store
// with a method that performs both the set and expire.
// For example:
const client = {
  get(...args) {
    rClient.get(...args);
  },
  set(key, val, ttl, cb) {
    rClient.set(key, val, (err) => {
      if (err) {
        return cb(err);
      }

      rClient.expire(ttl, cb);
    })
  }
}

const config = {
 total: 300,
 expire: 1000,
 onRateLimited: (req, res, next) => {
    res.status(503).send('Service Unavailable');
 }
};

// Rate limiting for _all_ routes.
app.use(cattleguard(config, client));

// Rate limiting for a single route.
config.perRoute = true;
app.post('/blogs', cattleguard(config, client), (req, res, next) => {
  // ...
});

// Rate limiting for a subset of routes based on method.
config.perMethod = true;
app.route('/blogs')
  .all(cattleguard(config, client))
  .post((req, res, next) => {
    // Will have its own rate limit.
  })
  .get((req, res, next) => {
    // Will have its own rate limit.
  });

// Rate limiting based on request criteriea.
config.lookup = (req) => req.headers['x-forwarded-for'];
app.post('/blogs', cattleguard(config, client), (req, res, next) => {
  // ...
});

```

## Configuration options

* `config` - Rate limit configuration, contains:
  * `total`: integer, the number of requests per a time period to allow before
    rate limiting.
  * `expire`: integer, the time period in milliseconds to limit requests.
  * `onRateLimited`: function, the method to execute when a rate limit has been
    reached. Accepts:
      * `req`: The reequest object.
      * `res`: The response object.
      * `next`: The method to execute after the on rate limited method, if
        needed.
  * `perRoute`: boolean, true if rate limiting should happen per route.
    default: `false`
  * `perMethod`: boolean, true if rate limiting should happen per HTTP method.
    default: `false`
  * `lookup`: function, used to return an identifier for the user requesting.
    This will have the effect of creating a per-user rate limit.
    default: `undefined`
* `store` - A store to maintain the rate limit counts in. Must provide get and
  set methods with the following signatures:
  * `get`: gets a value from the store.
    * `key` - The key for the rate limit information.
    * `callback` - A callback to execute after getting, parameters are err and
      limit where limit is the value for the key.
  * `set`: sets a value in the store.
    * `key` - The key for the rate limit information.
    * `value` - The value to store.
    * `ttl` - The timeout in seconds for the rate limit information.
    * `callback` - A callback to execute after setting, parameters are err.

## Credits

This module was heavily influenced by [express-limiter](https://www.npmjs.com/package/express-limiter) but allows application rate limiting in the interest of guarding
against backend failures, rather than the consumer only rate limiting approach that
express-limiter takes.
