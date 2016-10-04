# Cattleguard

[![Build Status](https://travis-ci.org/elliotttf/cattleguard.svg?branch=master)](https://travis-ci.org/elliotttf/cattleguard)
[![Coverage Status](https://coveralls.io/repos/github/elliotttf/cattleguard/badge.svg?branch=master)](https://coveralls.io/github/elliotttf/cattleguard?branch=master)

An express middleware for rate limiting an application to provide stampede protection.

## Usage

```javascript
var cattleguard = require('cattleguard');

var config = {
 total: 300,
 expire: 1000,
 onRateLimited: function (req, res, next) {
    res.status(503).send('Service Unavailable');
 }
};

// Rate limiting for _all_ routes.
app.use(cattleguard(config));

// Rate limiting for a single route.
config.perRoute = true;
app.post('/blogs', cattleguard(config), function (req, res, next) {
  // ...
});

// Rate limiting for a subset of routes based on method.
config.perMethod = true;
app.route('/blogs')
  .all(cattleguard(config))
  .post(function (req, res, next) {
    // Will have its own rate limit.
  })
  .get(function (req, res, next) {
    // Will have its own rate limit.
  });

// Rate limiting based on request criteriea.
config.lookup = function (req) {
  return req.headers['x-forwarded-for'];
};
app.post('/blogs', cattleguard(config), function (req, res, next) {
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
  setmethods and _may_ provide a pexpire method with the following signatures:
  * `get`: gets a value from the store.
    * `key` - The key for the rate limit information.
    * `callback` - A callback to execute after getting, parameters are err and
      limit where limit is the value for the key.
  * `set`: sets a value in the store.
    * `key` - The key for the rate limit information.
    * `callback` - A callback to execute after getting, parameters are err.
  * `pexpire`: sets an expire time in milliseconds for a key.
    * `key` - The key for the rate limit information.
    * `expire` - Time in milliseconds before the key expires.

## Credits

This module was heavily influenced by [express-limiter](https://www.npmjs.com/package/express-limiter) but allows application rate limiting in the interest of guarding
against backend failures, rather than the consumer only rate limiting appraoch that
express-limiter takes.

