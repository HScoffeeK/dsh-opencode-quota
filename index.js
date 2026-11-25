/**
 * dsh-opencode-quota — Host half.
 *
 * Reads OpenCode Go's public model catalog (`GET <base>/models`) and the
 * account's shared allowance (`GET <base>/usage`), then exposes
 *   - one same-origin HTTP route the Settings page reads, and
 *   - one agent tool so the same numbers can be asked for in chat.
 *
 * Design rules followed here:
 *   - Read-only: no writes to the profile, no requests other than the two
 *     documented GETs, and the API key never leaves the Host.
 *   - Tolerant: every remote field is validated; unknown shapes degrade to
 *     "unavailable" instead of throwing; the last good snapshot survives a
 *     failed refresh.
 *   - Compatible: the key is discovered from the profile's existing
 *     credentials (dsh-opencode-go and friends), `OPENCODE_API_KEY`, or the
 *     OpenCode CLI's own auth file, so no secret has to be copied around.
 */

import { readFile } from 'node:fs/promises';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_BASE_URL = 'https://opencode.ai/inference/go/v1';
const PLANS = ['go', 'go-plus', 'go-teams'];
const PLAN_LABELS = { go: 'Go', 'go-plus': 'Go Plus', 'go-teams': 'Go Teams' };
/** Documented window caps as a share of the monthly allowance. */
const WINDOW_SHARE = { rolling: 0.2, weekly: 0.5, monthly: 1 };
const USER_AGENT = 'dsh-opencode-quota/1.0';
const MAX_BODY_BYTES = 2_000_000;

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function normalizePlan(value, fallback) {
  const plan = asString(value);
  if (PLANS.includes(plan)) return plan;
  return PLANS.includes(fallback) ? fallback : 'go';
}

function isLoopback(hostname) {
  const host = asString(hostname).toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

function normalizeBaseURL(value) {
  const raw = asString(value) || DEFAULT_BASE_URL;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return DEFAULT_BASE_URL;
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) {
    return DEFAULT_BASE_URL;
  }
  url.search = '';
  url.hash = '';
  return url.href.replace(/\/+$/, '');
}

function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Reject a body that mentions the key; used for every surfaced remote error. */
function redact(text, key) {
  let out = asString(text);
  if (key) out = out.split(key).join('[redacted]');
  return out.length > 300 ? `${out.slice(0, 297)}...` : out;
}

function sameOrigin(request) {
  const origin = request.headers?.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers?.host;
  } catch {
    return false;
  }
}

function sendJson(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  response.end(text);
}

/* ------------------------------------------------------------------ */
/* credential discovery                                                */
/* ------------------------------------------------------------------ */

/** A credential reference is a POSIX-shell identifier. */
function plausibleRef(value) {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]{2,80}$/.test(value);
}

function providerRefs(ctx) {
  const refs = [];
  try {
    const llm = ctx.get('llm');
    const list = typeof llm?.listProviders === 'function' ? llm.listProviders() : [];
    for (const provider of Array.isArray(list) ? list : []) {
      const label = asString(provider?.provider) || asString(provider?.id) || asString(provider?.name);
      if (!/opencode/i.test(label)) continue;
      for (const bag of [provider, provider?.config, provider?.options, provider?.entry, provider?.metadata]) {
        if (!bag || typeof bag !== 'object') continue;
        for (const field of ['apiKeyEnv', 'apiKeyEnvName', 'credential', 'credentialRef']) {
          if (plausibleRef(bag[field])) refs.push({ ref: bag[field], source: `provider ${label}` });
        }
      }
    }
  } catch {
    /* optional service */
  }
  return refs;
}

/**
 * The profile's composed rows name credential references (for example an
 * `apiKeyEnv` on an OpenCode Go provider row). Reading them here only
 * discovers a name; the value still comes from the credential service.
 */
function configRefs(ctx) {
  const refs = [];
  try {
    const editor = ctx.get('configEditor');
    const entries = typeof editor?.entries === 'function' ? editor.entries() : [];
    const walk = (node, depth) => {
      if (depth > 4 || node === null || node === undefined) return;
      if (typeof node === 'string') {
        if (plausibleRef(node) && /OPENCODE/i.test(node)) refs.push({ ref: node, source: 'profile config' });
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) walk(item, depth + 1);
        return;
      }
      if (typeof node === 'object') {
        for (const key of Object.keys(node)) walk(node[key], depth + 1);
      }
    };
    walk(entries, 0);
  } catch {
    /* optional service */
  }
  return refs;
}

function cliAuthFiles() {
  const files = [];
  const home = asString(process.env.USERPROFILE) || asString(process.env.HOME);
  const xdg = asString(process.env.XDG_DATA_HOME);
  if (xdg) files.push(join(xdg, 'opencode', 'auth.json'));
  if (home) files.push(join(home, '.local', 'share', 'opencode', 'auth.json'));
  if (asString(process.env.LOCALAPPDATA)) files.push(join(process.env.LOCALAPPDATA, 'opencode', 'auth.json'));
  if (asString(process.env.APPDATA)) files.push(join(process.env.APPDATA, 'opencode', 'auth.json'));
  if (home) files.push(join(home, '.opencode', 'auth.json'));
  return [...new Set(files)];
}

/** Best-effort: the OpenCode CLI keeps its own provider credentials on disk. */
async function cliApiKey() {
  for (const file of cliAuthFiles()) {
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    if (text.length > 200_000) continue;
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    if (!data || typeof data !== 'object') continue;
    for (const [id, entry] of Object.entries(data)) {
      if (!entry || typeof entry !== 'object') continue;
      const value = asString(entry.key) || asString(entry.access) || asString(entry.token);
      if (value.length >= 16) return { key: value, source: `opencode CLI auth (${id})` };
    }
  }
  return null;
}

async function resolveApiKey(ctx, config) {
  if (plausibleRef(config?.apiKeyEnv)) {
    const credentials = ctx.get('credentials');
    if (credentials && typeof credentials.resolve === 'function') {
      try {
        const hit = await credentials.resolve(config.apiKeyEnv);
        const value = asString(hit?.value);
        if (value) return { key: value, source: `config apiKeyEnv ${config.apiKeyEnv}` };
      } catch {
        /* fall through to the next source */
      }
    }
  }

  for (const name of ['OPENCODE_API_KEY', 'OPENCODE_GO_API_KEY']) {
    const value = asString(process.env[name]);
    if (value) return { key: value, source: `environment ${name}` };
  }

  const credentials = ctx.get('credentials');
  if (credentials && typeof credentials.resolve === 'function') {
    const candidates = [...providerRefs(ctx), ...configRefs(ctx)];
    const seen = new Set();
    for (const candidate of candidates) {
      if (seen.has(candidate.ref)) continue;
      seen.add(candidate.ref);
      try {
        const hit = await credentials.resolve(candidate.ref);
        const value = asString(hit?.value);
        if (value) return { key: value, source: `credential ${candidate.ref}` };
      } catch {
        /* try the next candidate */
      }
    }
  }

  return await cliApiKey();
}

/* ------------------------------------------------------------------ */
/* preferences                                                         */
/* ------------------------------------------------------------------ */

/** Entry points and display options the settings page may change. */
const DEFAULT_PREFS = Object.freeze({
  entries: { header: true, dock: true, footer: false },
  prices: { show: true },
});

function prefsDir() {
  const home = asString(process.env.DSH_HOME) || asString(process.env.DSH_PROFILE_DIR) || tmpdir();
  return join(home, 'cache', 'dsh-opencode-quota');
}

function prefsPath() {
  return join(prefsDir(), 'prefs.json');
}

function asBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/** Accepts any stored or posted shape and returns the complete settings. */
function normalizePrefs(value) {
  const source = value && typeof value === 'object' ? value : {};
  const entries = source.entries && typeof source.entries === 'object' ? source.entries : {};
  const prices = source.prices && typeof source.prices === 'object' ? source.prices : {};
  return {
    entries: {
      header: asBool(entries.header, DEFAULT_PREFS.entries.header),
      dock: asBool(entries.dock, DEFAULT_PREFS.entries.dock),
      footer: asBool(entries.footer, DEFAULT_PREFS.entries.footer),
    },
    prices: { show: asBool(prices.show, DEFAULT_PREFS.prices.show) },
  };
}

function readPrefs() {
  try {
    return normalizePrefs(JSON.parse(readFileSync(prefsPath(), 'utf8')));
  } catch {
    return normalizePrefs(undefined);
  }
}

/** Merge a patch into the stored settings and persist them atomically. */
function writePrefs(patch) {
  const current = readPrefs();
  const incoming = patch && typeof patch === 'object' ? patch : {};
  const next = normalizePrefs({
    entries: { ...current.entries, ...(incoming.entries && typeof incoming.entries === 'object' ? incoming.entries : {}) },
    prices: { ...current.prices, ...(incoming.prices && typeof incoming.prices === 'object' ? incoming.prices : {}) },
  });
  mkdirSync(prefsDir(), { recursive: true });
  const file = prefsPath();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2));
  renameSync(tmp, file);
  return next;
}

async function readJsonBody(request, limit = 64_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) throw new Error('request body is too large');
    chunks.push(chunk);
  }
  if (total === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/* ------------------------------------------------------------------ */
/* remote reads                                                        */
/* ------------------------------------------------------------------ */

async function readJson(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: 'error' });
    const text = await response.text();
    if (text.length > MAX_BODY_BYTES) throw new Error('response exceeds the size limit');
    let body = null;
    let parsed = true;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      parsed = false;
    }
    return { status: response.status, ok: response.ok, parsed, body, text };
  } finally {
    clearTimeout(timer);
  }
}

function parseModels(body) {
  const list = Array.isArray(body?.data) ? body.data : [];
  const models = [];
  for (const item of list) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) continue;
    const go = item.go && typeof item.go === 'object' ? item.go : {};
    const usage = go.monthly_usage && typeof go.monthly_usage === 'object' ? go.monthly_usage : null;
    const limits = {};
    if (usage) {
      for (const plan of PLANS) {
        const limit = finite(usage[plan]);
        if (limit !== null && limit >= 0) limits[plan] = limit;
      }
    }
    const cost = item.cost && typeof item.cost === 'object' ? item.cost : {};
    const textCost = cost.text && typeof cost.text === 'object' ? cost.text : {};
    models.push({
      id: item.id,
      name: asString(item.name) || item.id,
      featured: go.featured === true,
      training: go.training === true,
      zdr: go.zdr === true,
      context: finite(item.limit?.context),
      priceIn: finite(textCost.input?.price),
      priceOut: finite(textCost.output?.price),
      priceCacheRead: finite(textCost.input?.cache?.read),
      priceCacheWrite: finite(textCost.input?.cache?.write),
      limits,
    });
  }
  return models;
}

function parseUsage(body) {
  const container = body && typeof body === 'object' ? body : {};
  const source = container.usage && typeof container.usage === 'object'
    ? container.usage
    : container.data && typeof container.data === 'object' && container.data.usage
      ? container.data.usage
      : container;
  const usage = {};
  for (const key of ['rolling', 'weekly', 'monthly']) {
    const row = source[key];
    if (!row || typeof row !== 'object') continue;
    const percent = finite(row.percent);
    if (percent === null) continue;
    const resetsAt = typeof row.resetsAt === 'string' && Number.isFinite(Date.parse(row.resetsAt))
      ? row.resetsAt
      : null;
    usage[key] = {
      status: row.status === 'rate-limited' ? 'rate-limited' : 'ok',
      percent: clamp(percent, 0, 100),
      resetsAt,
    };
  }
  return Object.keys(usage).length > 0 ? usage : null;
}

/* ------------------------------------------------------------------ */
/* formatting for the agent tool                                       */
/* ------------------------------------------------------------------ */

function money(value) {
  if (value === null || value === undefined) return '—';
  if (value >= 1000) return `$${Math.round(value)}`;
  return `$${value.toFixed(2)}`;
}

function resetText(iso, kind) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  if (kind === 'rolling') return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatToolText(snapshot, filter) {
  if (!snapshot.ok) {
    const reason = snapshot.error || 'the OpenCode model catalog could not be read';
    return `OpenCode quota is unavailable: ${reason}`
      + (snapshot.key?.configured ? '' : ' (no OpenCode API key was found on this machine)');
  }
  const lines = [];
  const usage = snapshot.usage;
  const windowLine = usage
    ? ['rolling', 'weekly', 'monthly']
      .filter((key) => usage[key])
      .map((key) => {
        const label = key === 'rolling' ? '5h' : key === 'weekly' ? 'week' : 'month';
        const reset = usage[key].resetsAt ? ` resets ${resetText(usage[key].resetsAt, key)}` : '';
        return `${label} ${usage[key].percent.toFixed(0)}%${reset}`;
      })
      .join(' | ')
    : 'shared allowance unavailable (no usable API key)';

  lines.push(`OpenCode quota — plan ${PLAN_LABELS[snapshot.plan]} (${snapshot.plan}), updated ${snapshot.fetchedAt}`);
  lines.push(`Shared allowance: ${windowLine}`);
  lines.push('');

  const needle = asString(filter).toLowerCase();
  const rows = snapshot.models.filter((model) => !needle
    || model.id.toLowerCase().includes(needle)
    || model.name.toLowerCase().includes(needle));

  if (rows.length === 0) {
    lines.push(needle ? `No model matches "${filter}".` : 'No OpenCode models were returned.');
    return lines.join('\n');
  }

  const header = ['model', 'month cap', 'month left', '5h left', 'week left'];
  const widths = [30, 10, 10, 10, 10];
  const pad = (value, width) => String(value).padEnd(width);
  lines.push(header.map((value, index) => pad(value, widths[index])).join(' ').trimEnd());
  for (const model of rows) {
    const remaining = model.remaining;
    const values = [
      model.name.length > 30 ? `${model.name.slice(0, 29)}…` : model.name,
      model.free ? 'free' : money(model.monthlyLimit),
      model.free ? 'free' : money(remaining?.monthly ?? null),
      model.free ? 'free' : money(remaining?.rolling ?? null),
      model.free ? 'free' : money(remaining?.weekly ?? null),
    ];
    lines.push(values.map((value, index) => pad(value, widths[index])).join(' ').trimEnd());
  }

  const freeModels = snapshot.models.filter((model) => model.free);
  if (freeModels.length > 0) {
    lines.push('');
    lines.push(`Free models without an allowance: ${freeModels.map((model) => model.name).join(', ')}`);
  }
  if (snapshot.usageError) {
    lines.push('');
    lines.push(`Allowance note: ${snapshot.usageError}`);
  }
  lines.push('');
  lines.push('Remaining amounts are the shared monthly percentage applied to each model monthly cap,');
  lines.push('so switching models draws from the same allowance. Source: opencode.ai Go API.');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* plugin                                                              */
/* ------------------------------------------------------------------ */

export const name = 'opencode-quota';
export const inject = ['webServer'];

export function apply(ctx, config = {}) {
  const configuredTTL = Number(config?.cacheTTLSeconds);
  const settings = {
    baseURL: normalizeBaseURL(config?.baseURL),
    plan: normalizePlan(config?.plan, 'go'),
    timeoutMs: clamp(Number(config?.timeoutMs) || 8000, 1000, 30_000),
    cacheTTLMs: clamp((Number.isFinite(configuredTTL) ? Math.max(0, configuredTTL) : 60) * 1000, 0, 3_600_000),
  };

  const state = { cache: null, pending: null };

  async function refresh() {
    const previous = state.cache;
    const keyInfo = await resolveApiKey(ctx, config);
    const headers = { accept: 'application/json', 'user-agent': USER_AGENT };
    const usageHeaders = keyInfo ? { ...headers, authorization: `Bearer ${keyInfo.key}` } : null;

    const [modelsResult, usageResult] = await Promise.allSettled([
      readJson(`${settings.baseURL}/models`, { headers }, settings.timeoutMs),
      usageHeaders ? readJson(`${settings.baseURL}/usage`, { headers: usageHeaders }, settings.timeoutMs) : null,
    ]);

    let models = null;
    let modelsError = null;
    if (modelsResult.status === 'fulfilled' && modelsResult.value?.ok) {
      const parsed = parseModels(modelsResult.value.body);
      if (parsed.length > 0) models = parsed;
      else modelsError = 'the catalog response contained no models';
    } else if (modelsResult.status === 'rejected') {
      modelsError = redact(messageOf(modelsResult.reason), keyInfo?.key);
    } else if (modelsResult.value) {
      modelsError = `HTTP ${modelsResult.value.status} from ${settings.baseURL}/models`;
    }

    let usage = null;
    let usageError = null;
    if (!keyInfo) {
      usageError = 'no OpenCode API key was found on this machine';
    } else if (usageResult.status === 'fulfilled') {
      const value = usageResult.value;
      if (value?.ok) {
        usage = parseUsage(value.body);
        if (!usage) usageError = 'the usage response had an unexpected shape';
      } else if (value) {
        usageError = `HTTP ${value.status} from ${settings.baseURL}/usage`;
        const detail = redact(value.text, keyInfo.key);
        if (detail && value.status !== 401 && value.status !== 403) usageError += `: ${detail}`;
        if (value.status === 401 || value.status === 403) usageError += ' — check that the key belongs to an OpenCode Go workspace';
      } else {
        usageError = 'the usage request did not complete';
      }
    } else {
      usageError = redact(messageOf(usageResult.reason), keyInfo?.key);
    }

    state.cache = {
      at: Date.now(),
      models: models ?? previous?.models ?? [],
      usage: usage ?? (usageError ? previous?.usage ?? null : null),
      usageError,
      modelsError,
      key: keyInfo ? { configured: true, source: keyInfo.source } : { configured: false, source: null },
    };
  }

  async function getRaw(force) {
    const fresh = state.cache && Date.now() - state.cache.at < settings.cacheTTLMs;
    if (!force && fresh) return state.cache;
    if (!state.pending) {
      state.pending = refresh().finally(() => {
        state.pending = null;
      });
    }
    try {
      await state.pending;
    } catch {
      /* refresh keeps the previous snapshot when it can */
    }
    return state.cache;
  }

  /** Per raw snapshot and plan: the expensive model projection is reused. */
  const snapshotMemo = new WeakMap();

  function snapshot(raw, plan) {
    if (!raw) {
      return {
        schema: 1,
        ok: false,
        error: 'the OpenCode quota has not been read yet',
        plan,
        key: { configured: false, source: null },
        prefs: readPrefs(),
      };
    }
    let byPlan = snapshotMemo.get(raw);
    if (byPlan === undefined) {
      byPlan = new Map();
      snapshotMemo.set(raw, byPlan);
    }
    const cached = byPlan.get(plan);
    if (cached !== undefined) return { ...cached, prefs: readPrefs() };
    const build = () => {
    const usage = raw.usage;
    const percentOf = (key) => {
      const row = usage?.[key];
      return row && Number.isFinite(row.percent) ? row.percent : null;
    };
    const models = raw.models.map((model) => {
      const monthlyLimit = model.limits[plan] ?? null;
      const free = monthlyLimit === null;
      let remaining = null;
      if (!free && usage) {
        remaining = {};
        for (const key of ['rolling', 'weekly', 'monthly']) {
          const percent = percentOf(key);
          remaining[key] = percent === null
            ? null
            : round2(monthlyLimit * WINDOW_SHARE[key] * (1 - percent / 100));
        }
      }
      return {
        id: model.id,
        name: model.name,
        featured: model.featured,
        free,
        training: model.training,
        zdr: model.zdr,
        context: model.context,
        price: {
          in: model.priceIn,
          out: model.priceOut,
          cacheRead: model.priceCacheRead,
          cacheWrite: model.priceCacheWrite,
        },
        priceIn: model.priceIn,
        priceOut: model.priceOut,
        monthlyLimit,
        remaining,
      };
    });

    const error = raw.modelsError && models.length === 0 ? raw.modelsError : null;
    return {
      schema: 1,
      ok: models.length > 0,
      error,
      plan,
      plans: PLANS.map((id) => ({ id, label: PLAN_LABELS[id] })),
      fetchedAt: new Date(raw.at).toISOString(),
      ageSeconds: Math.max(0, Math.round((Date.now() - raw.at) / 1000)),
      baseURL: settings.baseURL,
      key: raw.key,
      usage,
      usageError: raw.usageError,
      modelsError: raw.modelsError,
      windows: WINDOW_SHARE,
      models,
    };
    };

    const body = build();
    byPlan.set(plan, body);
    return { ...body, prefs: readPrefs() };
  }

  /* ----- HTTP route the page reads ----- */

  /**
   * Ask the Host's own request gate whether this request is admitted: its
   * Host/Origin fence plus the browser login its /api routes enforce. A gate
   * that throws has admitted nothing, so a failure closes the route.
   * @returns the rejection status (401/403) or undefined when admitted.
   */
  function rejectionStatus(request) {
    try {
      const connection = ctx.get('connection');
      const gate = connection?.requestRejection;
      if (typeof gate !== 'function') return undefined;
      return gate.call(connection, request);
    } catch {
      return 403;
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/opencode-quota/api/snapshot',
    handler: async (request, response) => {
      if ((request.method || 'GET').toUpperCase() !== 'GET') {
        response.writeHead(405, { allow: 'GET' });
        response.end();
        return;
      }
      const rejected = rejectionStatus(request);
      if (rejected !== undefined) {
        sendJson(response, rejected, {
          ok: false,
          error: rejected === 401
            ? 'DSH login required: reopen the URL the host printed at startup.'
            : 'This request came from an untrusted origin and was refused.',
        });
        return;
      }
      if (!sameOrigin(request)) {
        sendJson(response, 403, { ok: false, error: 'cross-origin requests are refused' });
        return;
      }
      let plan = settings.plan;
      let force = false;
      try {
        const url = new URL(request.url || '/', 'http://localhost');
        plan = normalizePlan(url.searchParams.get('plan'), settings.plan);
        force = url.searchParams.get('refresh') === '1';
      } catch {
        /* keep the configured defaults */
      }
      try {
        const raw = await getRaw(force);
        sendJson(response, 200, snapshot(raw, plan));
      } catch (error) {
        sendJson(response, 200, {
          schema: 1,
          ok: false,
          error: messageOf(error),
          plan,
          key: state.cache?.key ?? { configured: false, source: null },
        });
      }
    },
  }));

  /* ----- preferences read/write for the settings page ----- */

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/opencode-quota/api/prefs',
    handler: async (request, response) => {
      const rejected = rejectionStatus(request);
      if (rejected !== undefined) {
        sendJson(response, rejected, {
          ok: false,
          error: rejected === 401
            ? 'DSH login required: reopen the URL the host printed at startup.'
            : 'This request came from an untrusted origin and was refused.',
        });
        return;
      }
      const method = (request.method || 'GET').toUpperCase();
      if (method === 'GET') {
        sendJson(response, 200, { ok: true, prefs: readPrefs() });
        return;
      }
      if (method !== 'POST') {
        response.writeHead(405, { allow: 'GET, POST' });
        response.end();
        return;
      }
      if (!sameOrigin(request)) {
        sendJson(response, 403, { ok: false, error: 'cross-origin requests are refused' });
        return;
      }
      try {
        const patch = await readJsonBody(request);
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
          sendJson(response, 400, { ok: false, error: 'expected a JSON object' });
          return;
        }
        sendJson(response, 200, { ok: true, prefs: writePrefs(patch) });
      } catch (error) {
        sendJson(response, 400, { ok: false, error: messageOf(error) });
      }
    },
  }));

  /* ----- agent tool ----- */

  ctx.effect(() => {
    const tools = ctx.get('tools');
    if (!tools || typeof tools.register !== 'function') return () => {};
    return tools.register({
      name: 'opencode_quota',
      description: 'Show the current OpenCode Go allowance and each model\'s remaining quota. '
        + 'Usage is one shared monthly allowance; per-model remaining amounts are derived from that share '
        + 'and the model\'s own monthly cap. Call this when the user asks how much OpenCode quota is left '
        + 'or which OpenCode model still has room.',
      parameters: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            description: 'Optional case-insensitive substring to filter model ids or names.',
          },
          plan: {
            type: 'string',
            description: 'Which plan\'s monthly caps to use: go, go-plus, or go-teams. Defaults to the configured plan.',
          },
          refresh: {
            type: 'boolean',
            description: 'Read the gateway again instead of using the 60-second cache.',
          },
        },
        additionalProperties: false,
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: String(value) }],
      },
      async execute(args) {
        const plan = normalizePlan(args?.plan, settings.plan);
        const raw = await getRaw(args?.refresh === true);
        return formatToolText(snapshot(raw, plan), args?.model);
      },
    });
  });
}
