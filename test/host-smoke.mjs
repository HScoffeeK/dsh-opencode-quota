// Host-half smoke test: mount the plugin with a fake Cordis context, capture
// its HTTP routes, and drive the snapshot route without a browser.
import assert from 'node:assert/strict';

const routes = new Map();
const ctx = {
  effect: (fn) => {
    const off = fn();
    return typeof off === 'function' ? off : () => {};
  },
  get: () => undefined,
  webServer: {
    register: (route) => {
      routes.set(route.path, route);
      return () => {};
    },
  },
};

const plugin = await import(new URL('../index.js', import.meta.url).href);
plugin.apply(ctx, {});

assert.ok(routes.has('/opencode-quota/api/snapshot'), 'snapshot route missing');
assert.ok(routes.has('/opencode-quota/api/prefs'), 'prefs route missing');

function fakeResponse() {
  return {
    status: 0,
    headers: null,
    body: '',
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(text) {
      this.body = String(text ?? '');
    },
  };
}

const handler = routes.get('/opencode-quota/api/snapshot').handler;
const response = fakeResponse();
await handler({ method: 'GET', url: '/opencode-quota/api/snapshot?plan=go', headers: {} }, response);

assert.equal(response.status, 200, `snapshot status ${response.status}: ${response.body.slice(0, 200)}`);
const body = JSON.parse(response.body);
assert.equal(body.ok, true, `snapshot not ok: ${body.error}`);
assert.ok(Array.isArray(body.models) && body.models.length > 0, 'no models');
assert.ok(body.prefs && body.prefs.entries && typeof body.prefs.entries.header === 'boolean', 'prefs missing');

const priced = body.models.find((model) => model.price && typeof model.price.in === 'number');
assert.ok(priced, 'no model carries a price');
assert.ok(typeof priced.price.out === 'number', 'output price missing');
assert.ok(typeof priced.price.cacheRead === 'number', 'cache-read price missing');

/* prefs: POST then GET round-trip through the gated route */
const prefsHandler = routes.get('/opencode-quota/api/prefs').handler;
function jsonRequest(method, payload) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  return {
    method,
    url: '/opencode-quota/api/prefs',
    headers: { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      yield data;
    },
  };
}

const postResponse = fakeResponse();
await prefsHandler(jsonRequest('POST', { entries: { footer: true, header: false }, prices: { show: false } }), postResponse);
assert.equal(postResponse.status, 200, `prefs POST ${postResponse.status}: ${postResponse.body.slice(0, 200)}`);
const posted = JSON.parse(postResponse.body).prefs;
assert.equal(posted.entries.footer, true);
assert.equal(posted.entries.header, false);
assert.equal(posted.prices.show, false);

const getResponse = fakeResponse();
await prefsHandler({ method: 'GET', url: '/opencode-quota/api/prefs', headers: {} }, getResponse);
const fetched = JSON.parse(getResponse.body).prefs;
assert.deepEqual(fetched, posted, 'prefs did not round-trip');

const snapshotAgain = fakeResponse();
await handler({ method: 'GET', url: '/opencode-quota/api/snapshot?plan=go', headers: {} }, snapshotAgain);
assert.deepEqual(JSON.parse(snapshotAgain.body).prefs, posted, 'snapshot does not carry the saved prefs');

console.log('host smoke test passed');
console.log('models:', body.models.length, '| sample:', priced.id, JSON.stringify(priced.price));
console.log('prefs round-trip:', JSON.stringify(fetched));
