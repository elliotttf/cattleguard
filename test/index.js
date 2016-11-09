'use strict';

const cattleguard = require('../');
const NodeCache = require('node-cache');
const sinon = require('sinon');

const nc = new NodeCache();

module.exports = {
  setUp(cb) {
    this.clock = sinon.useFakeTimers();
    cb();
  },
  tearDown(cb) {
    this.clock.restore();
    nc.flushAll();
    cb();
  },

  minimum(test) {
    test.expect(1);

    const cg = cattleguard({
      total: 1,
      expire: 1000,
    }, nc);

    cg({}, {}, () => {
      nc.get('cattleguard', (err, limit) => {
        if (err) {
          test.ok(false);
        }
        else {
          limit = JSON.parse(limit);
          test.deepEqual({ total: 1, remaining: 0, reset: 1000 }, limit, 'Unexpected limit');
        }

        test.done();
      });
    });
  },
  limit(test) {
    test.expect(2);

    const cg = cattleguard({
      total: 1,
      expire: 1000,
      onRateLimited() {
        test.done();
      },
    }, nc);

    cg({}, {}, () => {
      cg({}, {
        set(key, val) {
          test.equal('Retry-After', key, 'Unexpected header.');
          test.equal(1, val, 'Unexpected retry after value.');
        },
      });
    });
  },
  perRoute(test) {
    test.expect(1);

    const cg = cattleguard({
      total: 1,
      expire: 1000,
      perRoute: true,
    }, nc);

    cg({ path: '/test' }, {}, () => {
      nc.get('cattleguard::/test', (err, limit) => {
        if (err) {
          test.ok(false);
        }
        else {
          limit = JSON.parse(limit);
          test.deepEqual({ total: 1, remaining: 0, reset: 1000 }, limit, 'Unexpected limit');
        }

        test.done();
      });
    });
  },
  perMethod(test) {
    test.expect(1);

    const cg = cattleguard({
      total: 1,
      expire: 1000,
      perMethod: true,
    }, nc);

    cg({ method: 'GET' }, {}, () => {
      nc.get('cattleguard::GET', (err, limit) => {
        if (err) {
          test.ok(false);
        }
        else {
          limit = JSON.parse(limit);
          test.deepEqual({ total: 1, remaining: 0, reset: 1000 }, limit, 'Unexpected limit');
        }

        test.done();
      });
    });
  },
  lookup(test) {
    test.expect(2);

    const cg = cattleguard({
      total: 1,
      expire: 1000,
      lookup() {
        test.ok('true');
        return 'test';
      },
    }, nc);

    cg({}, {}, () => {
      nc.get('cattleguard::test', (err, limit) => {
        if (err) {
          test.ok(false);
        }
        else {
          limit = JSON.parse(limit);
          test.deepEqual({ total: 1, remaining: 0, reset: 1000 }, limit, 'Unexpected limit');
        }

        test.done();
      });
    });
  },
  withPexpire(test) {
    test.expect(3);

    const cg = cattleguard({ total: 1, expire: 1000 }, {
      get(key, cb) {
        cb();
      },
      set(key, val, cb) {
        cb();
      },
      pexpire(key, time) {
        test.equal('cattleguard', key, 'Unexpected key.');
        test.equal(1000, time, 'Unexpected expire.');
      },
    });

    cg({}, {}, () => {
      test.ok(true);
      test.done();
    });
  },
  alreadyExpired(test) {
    test.expect(1);
    this.clock.tick(1);
    nc.set('cattleguard', JSON.stringify({ total: 1, remaining: 100, reset: 0 }), () => {
      const cg = cattleguard({
        total: 1,
        expire: 1000,
      }, nc);

      cg({}, {}, () => {
        nc.get('cattleguard', (err, limit) => {
          if (err) {
            test.ok(false);
          }
          else {
            limit = JSON.parse(limit);
            test.deepEqual({ total: 1, remaining: 0, reset: 1001 }, limit, 'Unexpected limit');
          }

          test.done();
        });
      });
    });
  },
  getError(test) {
    test.expect(1);

    const cg = cattleguard({ total: 1, expire: 1000 }, {
      get(key, cb) {
        cb('uh oh');
      },
    });

    cg({}, {}, (err) => {
      test.equal('uh oh', err, 'Unexpected error.');
      test.done();
    });
  },
  setError(test) {
    test.expect(1);

    const cg = cattleguard({ total: 1, expire: 1000 }, {
      get(key, cb) {
        cb();
      },
      set(key, val, cb) {
        cb('uh oh');
      },
    });

    cg({}, {}, (err) => {
      test.equal('uh oh', err, 'Unexpected error.');
      test.done();
    });
  },
};

