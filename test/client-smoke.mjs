// Offline smoke test for the OpenCode quota client half.
// Loads client.js with stubbed browser globals, registers the plugin, then
// renders the settings page and the composer-dock entry with a fixture.

import assert from 'node:assert/strict';

let captured = null;
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition;
    },
  },
  setInterval: () => 1,
  clearInterval: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
};
globalThis.document = {
  baseURI: 'http://127.0.0.1:53916/',
  documentElement: { lang: 'zh-CN' },
  hidden: false,
  addEventListener: () => {},
  removeEventListener: () => {},
};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'zh-CN' }, configurable: true });

const snapshot = {
  schema: 1,
  ok: true,
  error: null,
  plan: 'go',
  plans: [
    { id: 'go', label: 'Go' },
    { id: 'go-plus', label: 'Go Plus' },
    { id: 'go-teams', label: 'Go Teams' },
  ],
  fetchedAt: new Date().toISOString(),
  baseURL: 'https://opencode.ai/inference/go/v1',
  key: { configured: true, source: 'credential TEST_REF' },
  usage: {
    rolling: { status: 'ok', percent: 12, resetsAt: new Date(Date.now() + 3600e3).toISOString() },
    weekly: { status: 'ok', percent: 8, resetsAt: new Date(Date.now() + 86400e3).toISOString() },
    monthly: { status: 'ok', percent: 4, resetsAt: new Date(Date.now() + 20 * 86400e3).toISOString() },
  },
  usageError: null,
  modelsError: null,
  models: [
    {
      id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash 1017', free: false, featured: true,
      monthlyLimit: 100, remaining: { rolling: 17.6, weekly: 46, monthly: 96 },
    },
    {
      id: 'beam-free', name: 'Beam Free', free: true, featured: true,
      monthlyLimit: null, remaining: null,
    },
  ],
};

globalThis.fetch = async () => ({ ok: true, json: async () => snapshot });

/* minimal React hook runtime ------------------------------------------------ */

let stateSlots = [];
let cursor = 0;
let effects = [];

const h = (type, props, ...children) => ({
  type,
  props: props ?? null,
  children: children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false),
});

globalThis.__ReactShim = {
  createElement: h,
  Fragment: Symbol('re-fragment'),
  useState(initial) {
    const index = cursor++;
    if (!(index in stateSlots)) stateSlots[index] = typeof initial === 'function' ? initial() : initial;
    return [stateSlots[index], (next) => {
      stateSlots[index] = typeof next === 'function' ? next(stateSlots[index]) : next;
    }];
  },
  useEffect(fn) {
    effects.push(fn);
    return undefined;
  },
  useCallback(fn) {
    return fn;
  },
  useMemo(fn) {
    return fn();
  },
};

function resetHooks() {
  cursor = 0;
  effects = [];
  stateSlots = [];
}

function collect(node, out = []) {
  if (node === null || node === undefined || node === false) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (typeof node.type === 'function') {
    return collect(node.type({ ...(node.props ?? {}), children: node.children }), out);
  }
  if (typeof node.type === 'symbol') {
    for (const child of node.children ?? []) collect(child, out);
    return out;
  }
  for (const child of node.children ?? []) collect(child, out);
  return out;
}

async function render(registration) {
  resetHooks();
  const first = collect(registration.component()).join(' ');
  const pending = effects.slice();
  effects = [];
  for (const fn of pending) fn();
  await new Promise((resolve) => setTimeout(resolve, 30));
  cursor = 0;
  const second = collect(registration.component()).join(' ');
  return { first, second };
}

/* load and register -------------------------------------------------------- */

await import(new URL('../client.js', import.meta.url).href);
assert.ok(captured, 'client.js did not call the module loader');
assert.equal(captured.id, 'dsh-opencode-quota');

const React = globalThis.__ReactShim;
const plugin = captured.factory((name) => {
  if (name === 'react') return React;
  throw new Error(`unexpected require: ${name}`);
});

const registrations = [];
const types = [];
const services = {
  slots: {
    inject: (_name, callback) => callback(),
    register: (options, component) => {
      registrations.push({ options, component });
      return () => {};
    },
  },
  sidebarRightTabs: {
    register: (definition) => {
      types.push(definition);
      return () => {};
    },
  },
};
const ctx = {
  locale: {
    getLocale: () => ({ id: 'zh-CN' }),
    register: () => () => {},
    bind: () => (key) => key,
  },
  effect: (fn) => fn(),
  get: (name) => services[name],
  inject: (deps, callback) => {
    callback({
      slots: services.slots,
      sidebarRightTabs: services.sidebarRightTabs,
      sidebarRight: { openTab: () => {} },
      effect: (fn) => fn(),
    });
  },
};

plugin.apply(ctx);
assert.equal(types.length, 1, `expected one tab type, got ${types.length}`);
assert.equal(types[0].id, 'dsh-opencode-quota');
assert.equal(types[0].kind, 'opencode-quota');
assert.ok(Array.isArray(types[0].guide) && types[0].guide.length === 1, 'guide entry missing');
assert.equal(registrations.length, 2, `expected two slot registrations, got ${registrations.length}`);

const pane = registrations.find((entry) => entry.options.name === 'sidebar.right.pane.tab');
const entry = registrations.find((entry) => entry.options.name === 'conversation.session.header.utilities');
assert.ok(pane, 'sidebar.right.pane.tab registration missing');
assert.ok(entry, 'conversation.session.header.utilities registration missing');
assert.equal(pane.options.key, 'dsh-opencode-quota');

const paneText = await render(pane);
assert.ok(paneText.second.includes('DeepSeek V4.1 Flash 1017'), 'pane model row missing');
assert.ok(paneText.second.includes('$100.00'), 'pane monthly cap missing');
assert.ok(paneText.second.includes('$96.00'), 'pane monthly remaining missing');
assert.ok(paneText.second.includes('Beam Free'), 'free model missing');
assert.ok(!paneText.second.includes('NaN'), 'pane rendered NaN');
assert.ok(!paneText.second.includes('undefined'), 'pane leaked "undefined"');

const entryText = await render(entry);
assert.ok(entryText.first.includes('额度'), 'header entry label missing');
assert.ok(entryText.second.includes('4%'), `header entry percentage missing: ${entryText.second.slice(0, 160)}`);

console.log('client smoke test passed');
console.log('pane render:', paneText.second.slice(0, 120).replace(/\s+/g, ' '));
