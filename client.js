window.__ModuleLoader__.load({
  id: 'dsh-opencode-quota',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'opencode-quota';
    const KIND = 'opencode-quota';
    const TYPE_ID = 'dsh-opencode-quota';
    const PLAN_STORAGE_KEY = 'dsh.opencode-quota.plan';
    const bridge = { openTab: null };

    const DEFAULT_PREFS = {
      entries: { header: true, dock: true, footer: false },
      prices: { show: true },
    };

    const EN = {
      'section.label': 'OpenCode quota',
      'entry.label': 'Quota',
      'guide.description': 'OpenCode Go model quotas and the remaining shared allowance',
      'pane.title': 'OpenCode quota',
      'settings.label': 'OpenCode quota display',
      'settings.title': 'OpenCode quota display',
      'settings.hint': 'Pick where the quota entry appears. Each change is saved immediately.',
      'settings.header': 'Session header',
      'settings.dock': 'Below the composer',
      'settings.footer': 'Sidebar footer',
      'settings.prices': 'Show model prices',
      'settings.pricesHint': 'Input, output and cache prices per 1M tokens',
      'settings.open': 'Open the quota page',
      'settings.saved': 'Saved',
      'price.in': 'in',
      'price.out': 'out',
      'price.cache': 'cache',
      'price.cacheWrite': 'cache write',
      'page.subtitle': 'Each OpenCode Go model monthly cap and the shared allowance that is left.',
      'page.plan': 'Plan',
      'page.refresh': 'Refresh',
      'page.search': 'Search models',
      'page.monthCap': 'Monthly cap',
      'page.monthLeft': 'Left this month',
      'page.weekLeft': 'Left this week',
      'page.rollingLeft': 'Left in 5h',
      'page.model': 'Model',
      'page.kind': 'Kind',
      'page.free': 'Free',
      'page.paid': 'Paid',
      'page.loading': 'Reading quota...',
      'page.updated': 'Updated',
      'page.account': 'Key',
      'page.count': 'models',
      'page.note': 'Usage is one shared allowance. Per-model amounts apply that share to each model monthly cap, so switching models draws from the same pool. If the caps do not match your subscription, switch the plan above.',
      'page.rolling': '5-hour window',
      'page.weekly': 'This week',
      'page.monthly': 'This month',
      'page.reset': 'resets',
      'page.empty': 'No models match this filter.',
      'page.noUsage': 'Allowance unavailable',
      'page.noUsageHint': 'No OpenCode API key was found. Set apiKeyEnv in this plugin config to the credential reference used by your OpenCode Go provider, or export OPENCODE_API_KEY.',
      'page.retry': 'Try again',
      'page.error': 'Could not read quota',
    };

    const ZH = {
      'section.label': 'OpenCode 额度',
      'entry.label': '额度',
      'guide.description': 'OpenCode Go 各模型额度与共享额度剩余',
      'pane.title': 'OpenCode 额度',
      'settings.label': 'OpenCode 额度显示',
      'settings.title': 'OpenCode 额度显示',
      'settings.hint': '选择额度入口出现的位置，每次修改都会立即保存。',
      'settings.header': '会话标题栏',
      'settings.dock': '输入框下方',
      'settings.footer': '侧边栏底部',
      'settings.prices': '显示模型价格',
      'settings.pricesHint': '表格里显示输入 / 输出 / 缓存价格（每 1M tokens）',
      'settings.open': '打开额度页',
      'settings.saved': '已保存',
      'price.in': '输入',
      'price.out': '输出',
      'price.cache': '缓存',
      'price.cacheWrite': '缓存写',
      'page.subtitle': '查看 OpenCode Go 每个模型的月度上限，以及共享额度还剩多少。',
      'page.plan': '套餐',
      'page.refresh': '刷新',
      'page.search': '搜索模型',
      'page.monthCap': '月上限',
      'page.monthLeft': '本月剩余',
      'page.weekLeft': '本周剩余',
      'page.rollingLeft': '5 小时剩余',
      'page.model': '模型',
      'page.kind': '类型',
      'page.free': '免费',
      'page.paid': '计费',
      'page.loading': '正在读取额度…',
      'page.updated': '更新于',
      'page.account': '密钥',
      'page.count': '个模型',
      'page.note': '所有模型共用同一份额度；每个模型的剩余金额是按该模型月上限折算的，切换模型会从同一个池子里扣减。若上限与你的订阅不符，请在上方切换套餐。',
      'page.rolling': '5 小时窗口',
      'page.weekly': '本周',
      'page.monthly': '本月',
      'page.reset': '重置',
      'page.empty': '没有匹配的模型。',
      'page.noUsage': '额度不可用',
      'page.noUsageHint': '未找到 OpenCode API Key。可在本插件配置里把 apiKeyEnv 设为你 OpenCode Go 供应商使用的凭据引用，或设置环境变量 OPENCODE_API_KEY。',
      'page.retry': '重试',
      'page.error': '读取额度失败',
    };

    let localeCtx = null;

    /** Read the live UI language on every render; never cache a stale one. */
    function currentLang() {
      if (localeCtx) {
        try {
          const snapshot = localeCtx.locale?.getLocale?.();
          const id = String(snapshot?.id ?? snapshot?.locale ?? snapshot?.language ?? '');
          if (/^en/i.test(id)) return 'en';
          if (/^zh/i.test(id)) return 'zh';
        } catch {
          /* fall through */
        }
      }
      try {
        const id = String(document.documentElement?.lang || navigator.language || '');
        if (/^en/i.test(id)) return 'en';
        if (/^zh/i.test(id)) return 'zh';
      } catch {
        /* fall through */
      }
      return 'zh';
    }

    function pick(key) {
      const dict = currentLang() === 'en' ? EN : ZH;
      return dict[key] ?? EN[key] ?? key;
    }

    function installLocale(ctx) {
      localeCtx = ctx;
      if (!ctx.locale || typeof ctx.locale.register !== 'function') return () => {};
      const ids = new Set(['en', 'zh-CN']);
      try {
        const snapshot = ctx.locale.getLocale?.();
        const current = snapshot?.id ?? snapshot?.locale;
        if (typeof current === 'string' && current) ids.add(current);
      } catch {
        /* optional */
      }
      const disposers = [];
      for (const id of ids) {
        const dict = /^en/i.test(id) ? EN : ZH;
        try {
          const off = ctx.locale.register(NS, id, dict);
          if (typeof off === 'function') disposers.push(off);
        } catch {
          /* another registration style; the local dictionary still works */
        }
      }
      return () => {
        for (const off of disposers) {
          try {
            off();
          } catch {
            /* ignore */
          }
        }
        localeCtx = null;
      };
    }

    function api(path) {
      const relative = String(path).replace(/^\/+/, '');
      if (typeof document === 'undefined') return `/${relative}`;
      try {
        return new URL(relative, document.baseURI).pathname;
      } catch {
        return `/${relative}`;
      }
    }

    /* ------------------------------------------------------------------ */
    /* preferences (shared by every entry point)                           */
    /* ------------------------------------------------------------------ */

    const prefsStore = {
      value: DEFAULT_PREFS,
      pending: null,
      listeners: new Set(),
    };

    function notifyPrefs() {
      for (const listener of [...prefsStore.listeners]) {
        try {
          listener();
        } catch {
          /* ignore */
        }
      }
    }

    async function loadPrefs(force = false) {
      if (!force && prefsStore.loaded) return prefsStore.value;
      if (!prefsStore.pending) {
        prefsStore.pending = (async () => {
          try {
            const response = await fetch(api('/opencode-quota/api/prefs'), { cache: 'no-store' });
            const body = await response.json();
            if (body && body.ok && body.prefs) {
              prefsStore.value = body.prefs;
              prefsStore.loaded = true;
              notifyPrefs();
            }
          } catch {
            /* keep the defaults */
          } finally {
            prefsStore.pending = null;
          }
        })();
      }
      await prefsStore.pending;
      return prefsStore.value;
    }

    function usePrefs() {
      const [value, setValue] = React.useState(prefsStore.value);
      React.useEffect(() => {
        const listener = () => setValue(prefsStore.value);
        prefsStore.listeners.add(listener);
        if (!prefsStore.loaded) void loadPrefs();
        return () => {
          prefsStore.listeners.delete(listener);
        };
      }, []);
      return value;
    }

    async function savePrefs(patch) {
      try {
        const response = await fetch(api('/opencode-quota/api/prefs'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
          cache: 'no-store',
        });
        const body = await response.json();
        if (body && body.ok && body.prefs) {
          prefsStore.value = body.prefs;
          prefsStore.loaded = true;
          notifyPrefs();
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    }

    /* ------------------------------------------------------------------ */
    /* formatting                                                          */
    /* ------------------------------------------------------------------ */

    function readPlan() {
      try {
        const value = window.localStorage.getItem(PLAN_STORAGE_KEY);
        if (value === 'go' || value === 'go-plus' || value === 'go-teams') return value;
      } catch {
        /* storage may be unavailable */
      }
      return '';
    }

    function writePlan(plan) {
      try {
        window.localStorage.setItem(PLAN_STORAGE_KEY, plan);
      } catch {
        /* ignore */
      }
    }

    function money(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      if (value >= 1000) return `$${Math.round(value)}`;
      return `$${value.toFixed(2)}`;
    }

    function priceValue(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      if (value === 0) return '$0';
      if (value >= 0.01) return `$${value.toFixed(2)}`;
      const text = value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      return `$${text}`;
    }

    function percentText(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      return `${Math.round(value)}%`;
    }

    function resetTime(iso, kind) {
      if (!iso) return '';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (value) => String(value).padStart(2, '0');
      if (kind === 'rolling') return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function usageTone(percent) {
      if (typeof percent !== 'number') return 'idle';
      if (percent >= 90) return 'danger';
      if (percent >= 70) return 'warn';
      return 'ok';
    }

    /* ------------------------------------------------------------------ */
    /* quota data                                                          */
    /* ------------------------------------------------------------------ */

    /* ------------------------------------------------------------------ */
    /* shared quota store: one fetch for every mounted entry point         */
    /* ------------------------------------------------------------------ */

    const quotaStore = {
      value: null,
      error: null,
      at: 0,
      pending: null,
      listeners: new Set(),
      timer: null,
      consumers: 0,
    };

    function notifyQuota() {
      for (const listener of [...quotaStore.listeners]) {
        try {
          listener();
        } catch {
          /* ignore */
        }
      }
    }

    function fetchQuota(force = false) {
      if (!force && quotaStore.value && Date.now() - quotaStore.at < 55_000) {
        return Promise.resolve(quotaStore.value);
      }
      if (quotaStore.pending) return quotaStore.pending;
      const plan = readPlan();
      const params = new URLSearchParams();
      if (plan) params.set('plan', plan);
      if (force) params.set('refresh', '1');
      quotaStore.pending = (async () => {
        try {
          const response = await fetch(`${api('/opencode-quota/api/snapshot')}?${params.toString()}`, { cache: 'no-store' });
          const body = await response.json();
          quotaStore.value = body;
          quotaStore.error = body && body.ok === false ? (body.error || 'unavailable') : null;
          quotaStore.at = Date.now();
          if (body && typeof body.plan === 'string' && body.plan && body.plan !== plan) writePlan(body.plan);
        } catch (failure) {
          quotaStore.error = String(failure && failure.message ? failure.message : failure);
        } finally {
          quotaStore.pending = null;
          notifyQuota();
        }
        return quotaStore.value;
      })();
      notifyQuota();
      return quotaStore.pending;
    }

    function useQuota() {
      const [state, setState] = React.useState(() => ({
        value: quotaStore.value,
        error: quotaStore.error,
        busy: Boolean(quotaStore.pending),
      }));

      React.useEffect(() => {
        quotaStore.consumers += 1;
        const listener = () => {
          setState({
            value: quotaStore.value,
            error: quotaStore.error,
            busy: Boolean(quotaStore.pending),
          });
        };
        quotaStore.listeners.add(listener);
        void fetchQuota(false);
        if (quotaStore.timer === null) {
          quotaStore.timer = window.setInterval(() => {
            if (!document.hidden) void fetchQuota(false);
          }, 60_000);
        }
        const onVisible = () => {
          if (!document.hidden) void fetchQuota(false);
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
          quotaStore.listeners.delete(listener);
          document.removeEventListener('visibilitychange', onVisible);
          quotaStore.consumers -= 1;
          if (quotaStore.consumers <= 0 && quotaStore.timer !== null) {
            window.clearInterval(quotaStore.timer);
            quotaStore.timer = null;
          }
        };
      }, []);

      const setPlan = (next) => {
        writePlan(next);
        quotaStore.at = 0;
        void fetchQuota(false);
      };

      return {
        snapshot: state.value,
        error: state.error,
        busy: state.busy,
        load: (force) => fetchQuota(force === true),
        setPlan,
        activePlan: readPlan() || (state.value && state.value.plan) || 'go',
      };
    }

    function Styles() {
      return h('style', null, CSS);
    }

    const CSS = `
      .ocq-root { display: flex; flex-direction: column; gap: 18px; color: var(--dsw-alias-label-primary); }
      .ocq-head { display: flex; flex-direction: column; gap: 6px; }
      .ocq-title { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.3; }
      .ocq-subtitle { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
      .ocq-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .ocq-field { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .ocq-select, .ocq-search {
        height: 28px; padding: 0 8px; border-radius: 8px; font-size: 13px;
        color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1);
        border: 1px solid var(--dsw-alias-border-l1); outline: none;
      }
      .ocq-search { min-width: 140px; flex: 1 1 140px; }
      .ocq-select:focus-visible, .ocq-search:focus-visible, .ocq-button:focus-visible,
      .ocq-entry:focus-visible, .ocq-foot:focus-visible, .ocq-pill:focus-visible {
        border-color: var(--dsw-alias-brand-primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, transparent);
      }
      .ocq-button {
        height: 28px; padding: 0 11px; border-radius: 8px; cursor: pointer; font-size: 12px;
        color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1);
        border: 1px solid var(--dsw-alias-border-l1);
      }
      .ocq-button:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
      .ocq-button:disabled { opacity: .55; cursor: default; }
      .ocq-spacer { flex: 1 1 auto; }
      .ocq-windows { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
      .ocq-window { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; }
      .ocq-window-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
      .ocq-window-label { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .ocq-window-value { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .ocq-bar { height: 6px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
      .ocq-bar > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--dsw-alias-brand-primary), color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-label-primary))); transition: width .35s ease; }
      .ocq-bar.is-warn > span { background: var(--dsw-alias-state-warn-primary); }
      .ocq-bar.is-danger > span { background: var(--dsw-alias-state-error-primary); }
      .ocq-window-foot { font-size: 11px; color: var(--dsw-alias-label-tertiary); min-height: 14px; }
      .ocq-notice { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 10px; padding: 10px 12px; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
      .ocq-notice strong { color: var(--dsw-alias-label-primary); font-weight: 600; }
      .ocq-error { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
      .ocq-table-wrap { border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); overflow: auto; }
      .ocq-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
      .ocq-table thead th { position: sticky; top: 0; z-index: 1; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-weight: 500; font-size: 12px; text-align: right; padding: 8px 10px; white-space: nowrap; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .ocq-table thead th.is-name { text-align: left; }
      .ocq-table tbody td { padding: 8px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); text-align: right; white-space: nowrap; }
      .ocq-table tbody td.is-name { text-align: left; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
      .ocq-table tbody tr:last-child td { border-bottom: none; }
      .ocq-table tbody tr:hover td { background: var(--dsw-alias-bg-layer-2); }
      .ocq-table tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 40%, transparent); }
      .ocq-table tbody tr:nth-child(even):hover td { background: var(--dsw-alias-bg-layer-2); }
      .ocq-model { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .ocq-model-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
      .ocq-model-id { font-size: 11px; color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; }
      .ocq-prices { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
      .ocq-chip { display: inline-flex; align-items: center; gap: 3px; height: 16px; padding: 0 5px; border-radius: 5px; font-size: 10.5px; line-height: 16px; color: var(--dsw-alias-label-tertiary); background: var(--dsw-alias-bg-layer-2); }
      .ocq-chip b { font-weight: 500; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .ocq-chip-key { opacity: .75; }
      .ocq-tag { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }
      .ocq-tag.is-free { color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); }
      .ocq-low { color: var(--dsw-alias-state-warn-primary); }
      .ocq-floor { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; font-size: 11px; color: var(--dsw-alias-label-tertiary); }
      .ocq-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .ocq-empty { padding: 20px 12px; text-align: center; font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .ocq-pane { display: flex; flex-direction: column; gap: 12px; padding: 14px; height: 100%; overflow: auto; box-sizing: border-box; }
      .ocq-entry, .ocq-foot, .ocq-pill {
        display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 8px;
        border-radius: 8px; cursor: pointer; font-size: 12px; white-space: nowrap; flex-wrap: nowrap;
        color: var(--dsw-alias-label-secondary);
        background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
      }
      .ocq-entry:hover, .ocq-foot:hover, .ocq-pill:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
      .ocq-foot { border-radius: 6px; }
      .ocq-pill { border-radius: 999px; height: 24px; font-size: 11px; }
      .ocq-entry-value { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
      .ocq-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); flex: none; }
      .ocq-dot.is-warn { background: var(--dsw-alias-state-warn-primary); }
      .ocq-dot.is-danger { background: var(--dsw-alias-state-error-primary); }
      .ocq-dot.is-idle { background: var(--dsw-alias-state-idle-primary); }
      .ocq-settings { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; color: var(--dsw-alias-label-primary); }
      .ocq-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--dsw-alias-label-primary); cursor: pointer; }
      .ocq-check input { width: 15px; height: 15px; accent-color: var(--dsw-alias-brand-primary); }
      .ocq-switch {
        appearance: none; -webkit-appearance: none; position: relative; flex: none;
        width: 34px; height: 20px; margin: 0; border-radius: 999px; cursor: pointer;
        background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
        transition: background .15s, border-color .15s;
      }
      .ocq-switch::after {
        content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
        border-radius: 50%; background: var(--dsw-alias-label-secondary);
        transition: transform .15s, background .15s;
      }
      .ocq-switch:checked { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
      .ocq-switch:checked::after { transform: translateX(14px); background: #fff; }
      .ocq-switch:focus-visible {
        outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, transparent);
      }
      .ocq-setting {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
        background: var(--dsw-alias-bg-layer-1);
      }
      .ocq-setting-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .ocq-setting-label { font-size: 13px; color: var(--dsw-alias-label-primary); }
      .ocq-setting-hint { font-size: 11px; color: var(--dsw-alias-label-tertiary); }
      .ocq-row { display: flex; align-items: center; gap: 10px; }
      .ocq-hint { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
      @media (max-width: 640px) {
        .ocq-table thead th.is-optional, .ocq-table tbody td.is-optional { display: none; }
      }
    `;

    function WindowCard(props) {
      const { label, percent, stateLabel } = props;
      const tone = usageTone(percent);
      return h('div', { className: 'ocq-window' },
        h('div', { className: 'ocq-window-top' },
          h('span', { className: 'ocq-window-label' }, label),
          h('span', { className: 'ocq-window-value' }, percentText(percent))),
        h('div', { className: `ocq-bar is-${tone}` },
          h('span', { style: { width: `${typeof percent === 'number' ? Math.min(100, Math.max(0, percent)) : 0}%` } })),
        h('div', { className: 'ocq-window-foot' }, stateLabel || ''));
    }

    function priceChips(model) {
      const price = model.price || {};
      const chip = (key, value) => h('span', { className: 'ocq-chip', key },
        h('span', { className: 'ocq-chip-key' }, key),
        h('b', null, priceValue(value)));
      const chips = [
        chip(pick('price.in'), price.in),
        chip(pick('price.out'), price.out),
        chip(pick('price.cache'), price.cacheRead),
      ];
      if (typeof price.cacheWrite === 'number') chips.push(chip(pick('price.cacheWrite'), price.cacheWrite));
      return h('div', { className: 'ocq-prices' }, chips);
    }

    function GaugeIcon(props) {
      const size = props && props.size ? props.size : 14;
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
        style: { display: 'block', flex: 'none' },
      },
        h('path', { d: 'M4 16a8 8 0 1 1 16 0', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: 0.4 }),
        h('path', { d: 'M4 16a8 8 0 0 1 2.7-6', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
        h('path', { d: 'M12 16l3.4-4.6', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
        h('circle', { cx: 12, cy: 16, r: 1.7, fill: 'currentColor' }));
    }

    function QuotaPanel() {
      const quota = useQuota();
      const prefs = usePrefs();
      const { snapshot, error, busy, load } = quota;
      const [query, setQuery] = React.useState('');

      const models = (snapshot && Array.isArray(snapshot.models)) ? snapshot.models : [];
      const needle = query.trim().toLowerCase();
      const visible = needle
        ? models.filter((model) => model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle))
        : models;
      const usage = snapshot && snapshot.usage ? snapshot.usage : null;
      const keyInfo = (snapshot && snapshot.key) || { configured: false, source: null };
      const plans = (snapshot && Array.isArray(snapshot.plans) && snapshot.plans.length > 0)
        ? snapshot.plans
        : [{ id: 'go', label: 'Go' }, { id: 'go-plus', label: 'Go Plus' }, { id: 'go-teams', label: 'Go Teams' }];
      const showPrices = !prefs || !prefs.prices || prefs.prices.show !== false;

      const toolbar = h('div', { className: 'ocq-toolbar' },
        h('label', { className: 'ocq-field' },
          h('span', null, pick('page.plan')),
          h('select', {
            className: 'ocq-select', value: quota.activePlan, disabled: busy,
            onChange: (event) => quota.setPlan(event.target.value),
          }, plans.map((item) => h('option', { key: item.id, value: item.id }, item.label)))),
        h('input', {
          className: 'ocq-search', type: 'search', value: query,
          placeholder: pick('page.search'), 'aria-label': pick('page.search'),
          onChange: (event) => setQuery(event.target.value),
        }),
        h('span', { className: 'ocq-spacer' }),
        h('button', {
          className: 'ocq-button', type: 'button', disabled: busy,
          onClick: () => load(true),
        }, busy ? pick('page.loading') : pick('page.refresh')));

      const windows = usage
        ? h('div', { className: 'ocq-windows' },
          h(WindowCard, {
            key: 'rolling', label: pick('page.rolling'), percent: usage.rolling && usage.rolling.percent,
            stateLabel: usage.rolling && usage.rolling.resetsAt
              ? `${pick('page.reset')} ${resetTime(usage.rolling.resetsAt, 'rolling')}`
              : '',
          }),
          h(WindowCard, {
            key: 'weekly', label: pick('page.weekly'), percent: usage.weekly && usage.weekly.percent,
            stateLabel: usage.weekly && usage.weekly.resetsAt
              ? `${pick('page.reset')} ${resetTime(usage.weekly.resetsAt, 'weekly')}`
              : '',
          }),
          h(WindowCard, {
            key: 'monthly', label: pick('page.monthly'), percent: usage.monthly && usage.monthly.percent,
            stateLabel: usage.monthly && usage.monthly.resetsAt
              ? `${pick('page.reset')} ${resetTime(usage.monthly.resetsAt, 'monthly')}`
              : '',
          }))
        : null;

      const notices = [];
      if (snapshot && snapshot.usageError && !usage) {
        notices.push(h('div', { className: 'ocq-notice', key: 'usage' },
          h('strong', null, pick('page.noUsage')),
          ' — ',
          snapshot.usageError,
          keyInfo.configured ? '' : ` ${pick('page.noUsageHint')}`));
      } else if (snapshot && snapshot.usageError && usage) {
        notices.push(h('div', { className: 'ocq-notice', key: 'usage-stale' },
          h('strong', null, pick('page.noUsage')), ' — ', snapshot.usageError));
      }
      if (error) {
        notices.push(h('div', { className: 'ocq-notice ocq-error', key: 'error' },
          h('strong', null, pick('page.error')),
          ' — ',
          error,
          ' ',
          h('button', { className: 'ocq-button', type: 'button', onClick: () => load(true) }, pick('page.retry'))));
      }

      const table = models.length === 0
        ? (busy
          ? h('div', { className: 'ocq-empty' }, pick('page.loading'))
          : h('div', { className: 'ocq-empty' },
            h('div', null, pick('page.empty')),
            keyInfo.configured && !error ? null : h('div', { style: { marginTop: 6 } }, pick('page.noUsageHint'))))
        : h('div', { className: 'ocq-table-wrap' },
          h('table', { className: 'ocq-table' },
            h('thead', null,
              h('tr', null,
                h('th', { className: 'is-name' }, pick('page.model')),
                h('th', null, pick('page.monthCap')),
                h('th', null, pick('page.monthLeft')),
                h('th', { className: 'is-optional' }, pick('page.weekLeft')),
                h('th', { className: 'is-optional' }, pick('page.rollingLeft')))),
            h('tbody', null,
              visible.map((model) => {
                const remaining = model.remaining || null;
                const monthlyLeft = remaining ? remaining.monthly : null;
                const weekLeft = remaining ? remaining.weekly : null;
                const rollingLeft = remaining ? remaining.rolling : null;
                const low = typeof monthlyLeft === 'number' && typeof model.monthlyLimit === 'number'
                  && model.monthlyLimit > 0 && monthlyLeft / model.monthlyLimit < 0.15;
                const cells = [
                  h('td', { className: 'is-name', key: 'name' },
                    h('div', { className: 'ocq-model' },
                      h('span', { className: 'ocq-model-name' }, model.name),
                      h('span', { className: 'ocq-model-id ocq-mono' }, model.id),
                      showPrices ? priceChips(model) : null)),
                  h('td', { key: 'cap' }, model.free
                    ? h('span', { className: 'ocq-tag is-free' }, pick('page.free'))
                    : money(model.monthlyLimit)),
                  h('td', { key: 'month', className: low ? 'ocq-low' : undefined }, model.free ? '—' : money(monthlyLeft)),
                  h('td', { key: 'week', className: 'is-optional' }, model.free ? '—' : money(weekLeft)),
                  h('td', { key: 'rolling', className: 'is-optional' }, model.free ? '—' : money(rollingLeft)),
                ];
                return h('tr', { key: model.id }, cells);
              }))));

      const footerParts = [];
      if (snapshot) {
        footerParts.push(`${pick('page.updated')} ${resetTime(snapshot.fetchedAt, 'weekly')}`);
        if (keyInfo.source) footerParts.push(`${pick('page.account')} ${keyInfo.source}`);
        footerParts.push(`${visible.length} / ${models.length} ${pick('page.count')}`);
      }

      return h('div', { className: 'ocq-root' },
        toolbar,
        notices.length > 0 ? notices : null,
        windows,
        table,
        footerParts.length > 0
          ? h('div', { className: 'ocq-floor' }, footerParts.map((text, index) => h('span', { key: index }, text)))
          : null,
        h('div', { className: 'ocq-floor' }, h('span', null, pick('page.note'))));
    }

    function QuotaPane() {
      return h(React.Fragment, null,
        h(Styles),
        h('div', { className: 'ocq-pane' },
          h('div', { className: 'ocq-head' },
            h('h2', { className: 'ocq-title' }, pick('pane.title')),
            h('p', { className: 'ocq-subtitle' }, pick('page.subtitle'))),
          h(QuotaPanel)));
    }

    function QuotaEntry(props) {
      const quota = useQuota();
      const monthly = quota.snapshot && quota.snapshot.usage && quota.snapshot.usage.monthly;
      const percent = monthly ? monthly.percent : null;
      const tone = usageTone(percent);
      const open = () => {
        try {
          if (bridge.openTab) bridge.openTab();
        } catch {
          /* the right sidebar is unavailable in this composition */
        }
      };
      return h(React.Fragment, null,
        h(Styles),
        h('button', {
          className: props.variant === 'dock' ? 'ocq-pill' : props.variant === 'footer' ? 'ocq-foot' : 'ocq-entry',
          type: 'button',
          title: `${pick('pane.title')} · ${percentText(percent)}`,
          onClick: open,
        },
          h('span', { className: `ocq-dot is-${tone}` }),
          h(GaugeIcon, { size: 13 }),
          props.variant === 'dock' ? h('span', null, pick('entry.label')) : null,
          h('span', { className: 'ocq-entry-value' }, percentText(percent))));
    }

    function HeaderEntry() {
      const prefs = usePrefs();
      if (!prefs || !prefs.entries || prefs.entries.header === false) return null;
      return h(QuotaEntry, { variant: 'header' });
    }

    function DockEntry() {
      const prefs = usePrefs();
      if (!prefs || !prefs.entries || prefs.entries.dock === false) return null;
      return h(QuotaEntry, { variant: 'dock' });
    }

    function FooterEntry() {
      const prefs = usePrefs();
      if (!prefs || !prefs.entries || prefs.entries.footer !== true) return null;
      return h(QuotaEntry, { variant: 'footer' });
    }

    function QuotaSettings() {
      const prefs = usePrefs();
      const [saving, setSaving] = React.useState(false);
      const [savedAt, setSavedAt] = React.useState(0);

      const toggle = async (group, key) => {
        if (!prefs) return;
        const next = {
          entries: { ...prefs.entries },
          prices: { ...prefs.prices },
        };
        if (group === 'entries') next.entries[key] = !next.entries[key];
        if (group === 'prices') next.prices[key] = !next.prices[key];
        setSaving(true);
        const ok = await savePrefs({ [group]: next[group] });
        setSaving(false);
        if (ok) setSavedAt(Date.now());
      };

      const open = () => {
        try {
          if (bridge.openTab) bridge.openTab();
        } catch {
          /* unavailable */
        }
      };

      if (!prefs) return h('div', { className: 'ocq-empty' }, pick('page.loading'));

      const setting = (label, hint, checked, onChange) => h('label', { className: 'ocq-setting' },
        h('span', { className: 'ocq-setting-text' },
          h('span', { className: 'ocq-setting-label' }, label),
          hint ? h('span', { className: 'ocq-setting-hint' }, hint) : null),
        h('input', { type: 'checkbox', className: 'ocq-switch', checked, onChange }));

      return h(React.Fragment, null,
        h(Styles),
        h('div', { className: 'ocq-settings' },
          h('div', { className: 'ocq-head' },
            h('h2', { className: 'ocq-title' }, pick('settings.title')),
            h('p', { className: 'ocq-subtitle' }, pick('settings.hint'))),
          setting(pick('settings.header'), null, prefs.entries.header !== false, () => toggle('entries', 'header')),
          setting(pick('settings.dock'), null, prefs.entries.dock !== false, () => toggle('entries', 'dock')),
          setting(pick('settings.footer'), null, prefs.entries.footer === true, () => toggle('entries', 'footer')),
          setting(pick('settings.prices'), pick('settings.pricesHint'), prefs.prices.show !== false, () => toggle('prices', 'show')),
          h('div', { className: 'ocq-row' },
            h('button', { className: 'ocq-button', type: 'button', onClick: open }, pick('settings.open')),
            saving ? h('span', { className: 'ocq-hint' }, pick('page.loading')) : null,
            !saving && savedAt ? h('span', { className: 'ocq-hint' }, pick('settings.saved')) : null)));
    }

    return {
      apply(ctx) {
        try {
          const offLocale = installLocale(ctx);
          ctx.effect(() => offLocale);
        } catch {
          /* locale is optional */
        }

        const warn = (label, failure) => {
          try {
            console.warn(`[opencode-quota] ${label} failed`, failure);
          } catch {
            /* ignore */
          }
        };

        const mount = (scope) => {
          let slots;
          try {
            slots = scope.slots;
          } catch {
            slots = undefined;
          }
          if (!slots || typeof slots.inject !== 'function') return;

          const register = (label, slot, options, component) => {
            try {
              scope.effect(() => slots.inject(slot, () => slots.register({ ...options, name: slot }, component)));
            } catch (failure) {
              warn(label, failure);
            }
          };

          register('settings page', 'settings.section', {
            id: 'opencode-quota-settings',
            order: 521,
            label: () => pick('settings.label'),
          }, () => h(QuotaSettings));

          register('header entry', 'conversation.session.header.utilities', {
            id: 'opencode-quota-entry',
            order: 30,
          }, () => h(HeaderEntry));

          register('dock entry', 'conversation.composer.dock', {
            id: 'opencode-quota-dock',
            order: 40,
          }, () => h(DockEntry));

          register('footer entry', 'sidebar.footer.action', {
            id: 'opencode-quota-footer',
            order: 20,
          }, () => h(FooterEntry));

          try {
            scope.effect(() => slots.inject('sidebar.right.pane.tab', () => slots.register({
              name: 'sidebar.right.pane.tab',
              key: TYPE_ID,
            }, () => h(QuotaPane))));
          } catch (failure) {
            warn('pane body', failure);
          }
        };

        const registerType = (scope) => {
          try {
            const tabs = scope.sidebarRightTabs;
            if (!tabs || typeof tabs.register !== 'function') return;
            scope.effect(() => tabs.register({
              id: TYPE_ID,
              kind: KIND,
              title: () => pick('pane.title'),
              guide: [{
                id: 'quota',
                order: 20,
                title: () => pick('section.label'),
                description: () => pick('guide.description'),
              }],
            }));
          } catch (failure) {
            warn('tab type', failure);
          }
        };

        if (typeof ctx.inject === 'function') {
          ctx.inject(['slots'], (scope) => mount(scope));
          ctx.inject(['sidebarRightTabs'], (scope) => registerType(scope));
          ctx.inject(['sidebarRight'], (scope) => {
            bridge.openTab = () => scope.sidebarRight.openTab(KIND);
            scope.effect(() => () => {
              bridge.openTab = null;
            });
          });
        } else {
          mount(ctx);
        }
      },
    };
  },
});
