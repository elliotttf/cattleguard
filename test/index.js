'use strict';

var cattleguard = require('../');
var NodeCache = require('node-cache');
var sinon = require('sinon');

var nc = new NodeCache();

module.exports = {
  setUp: function (cb) {
    this.clock = sinon.useFakeTimers();
    cb();
  },
  tearDown: function (cb) {
    this.clock.restore();
    nc.flushAll();
    cb();
  },

  minimum: function (test) {
    test.expect(1);

    var cg = cattleguard({
      total: 1,
      expire: 1000
    }, nc);

    cg({}, {}, function () {
      nc.get('cattleguard', function (err, limit) {
        if (err) {
          test.ok(false);
        }
        else {
          limit = JSON.parse(limit);
          test.deepEqual(
            {
              total: 1,
              remaining: 0,
              reset: 1000,
            },
            limit,
            'Unexpected limit'
          );
        }

        test.done();
      });
    });
  },
  limit: function (test) {
    test.expect(2);

    var cg = cattleguard({
      total: 1,
      expire: 1000,
      onRateLimited: function () {
        test.done();
      }
    }, nc);

    cg({}, {}, function () {
      cg({}, {
        set: function (key, val) {
          test.equal('Retry-After', key, 'Unexpected header.');
          test.equal(1, val, 'Unexpected retry after value.');
        }
      });
    });
  },
  perRoute: function (test) {
    test.expect(1);

    var cg = cattleguard({
      total: 1,
      expire: 1000,
      perRoute: true
    }, nc);

    cg({ path: '/test' }, {}, function () {
      nc.get('cattleguard::/test', function (err, limit) {
        if (err) {
          test.ok(false);
        }
        else {
          limit = JSON.parse(limit);
          test.deepEqual(
            {
              total: 1,
              remaining: 0,
              reset: 1000,
            },
            limit,
            'Unexpected limit'
          );
        }

        test.done();
      });
    });
  },
  perMethod: function (test) {
    test.expect(1);

    var cg = cattleguard({
      total: 1,
      expire: 1000,
      perMethod: true
    }, nc);

    cg({ method: 'GET' }, {}, function () {
      nc.get('cattleguard::GET', function (err, limit) {
        if (err) {
          test.ok(false);
        }
        else {
          limit = JSON.parse(limit);
          test.deepEqual(
            {
              total: 1,
              remaining: 0,
              reset: 1000,
            },
            limit,
            'Unexpected limit'
          );
        }

        test.done();
      });
    });
  },
  lookup: function (test) {
    test.expect(2);

    var cg = cattleguard({
      total: 1,
      expire: 1000,
      lookup: function () {
        test.ok('true');
        return 'test';
      }
    }, nc);

    cg({}, {}, function () {
      nc.get('cattleguard::test', function (err, limit) {
        if (err) {
          test.ok(false);
        }
        else {
          limit = JSON.parse(limit);
          test.deepEqual(
            {
              total: 1,
              remaining: 0,
              reset: 1000,
            },
            limit,
            'Unexpected limit'
          );
        }

        test.done();
      });
    });
  },
  withPexpire: function (test) {
    test.expect(3);

    var cg = cattleguard(
      {
        total: 1,
        expire: 1000
      },
      Object.assign({
        pexpire: function (key, time) {
          test.equal('cattleguard', key, 'Unexpected key.');
          test.equal(1000, time, 'Unexpected expire.');
        }
      }, nc)
    );

    cg({}, {}, function () {
      test.ok(true);
      test.done();
    });
  },
  alreadyExpired: function (test) {
    test.expect(1);
    this.clock.tick(1);
    nc.set(
      'cattleguard',
      JSON.stringify({ total: 1, remaining: 100, reset: 0 }),
      function (err) {
        var cg = cattleguard({
          total: 1,
          expire: 1000
        }, nc);

        cg({}, {}, function () {
          nc.get('cattleguard', function (err, limit) {
            if (err) {
              test.ok(false);
            }
            else {
              limit = JSON.parse(limit);
              test.deepEqual(
                {
                  total: 1,
                  remaining: 0,
                  reset: 1001,
                },
                limit,
                'Unexpected limit'
              );
            }

            test.done();
          });
        });
      }
    );
  },
  getError: function (test) {
    test.expect(1);

    var cg = cattleguard(
      {
        total: 1,
        expire: 1000
      },
      {
        get: function (key, cb) {
          cb('uh oh');
        }
      }
    );

    cg({}, {}, function (err) {
      test.equal('uh oh', err, 'Unexpected error.');
      test.done();
    });
  },
  setError: function (test) {
    test.expect(1);

    var cg = cattleguard(
      {
        total: 1,
        expire: 1000
      },
      {
        get: function (key, cb) {
          cb();
        },
        set: function (key, val, cb) {
          cb('uh oh');
        }
      }
    );

    cg({}, {}, function (err) {
      test.equal('uh oh', err, 'Unexpected error.');
      test.done();
    });
  },
}

