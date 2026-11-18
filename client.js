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

    const EN = {
      'section.label': 'OpenCode quota',
      'entry.label': 'Quota',
      'guide.description': 'OpenCode Go model quotas and the remaining shared allowance',
      'pane.title': 'OpenCode quota',
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

    let translate = null;
    let lang = 'zh';

    function pick(key) {
      if (translate) {
        try {
          const value = translate(key);
          if (typeof value === 'string' && value && value !== key) return value;
        } catch {
          /* fall back to the local dictionary */
        }
      }
      return (lang === 'en' ? EN : ZH)[key] ?? key;
    }

    function detectLang(ctx) {
      try {
        const snapshot = ctx.locale?.getLocale?.();
        const id = String(snapshot?.id ?? snapshot?.locale ?? snapshot?.language ?? '');
        if (/^en/i.test(id)) return 'en';
        if (/^zh/i.test(id)) return 'zh';
      } catch {
        /* default below */
      }
      try {
        const id = String(document.documentElement?.lang || navigator.language || '');
        if (/^en/i.test(id)) return 'en';
        if (/^zh/i.test(id)) return 'zh';
      } catch {
        /* default below */
      }
      return 'zh';
    }

    function installLocale(ctx) {
      lang = detectLang(ctx);
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
      try {
        if (typeof ctx.locale.bind === 'function') translate = ctx.locale.bind(NS);
      } catch {
        translate = null;
      }
      return () => {
        for (const off of disposers) {
          try {
            off();
          } catch {
            /* ignore */
          }
        }
        translate = null;
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

    function useQuota() {
      const [snapshot, setSnapshot] = React.useState(null);
      const [plan, setPlanState] = React.useState(() => readPlan());
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);

      const load = React.useCallback(async (force) => {
        const wanted = plan || readPlan();
        setBusy(true);
        try {
          const params = new URLSearchParams();
          if (wanted) params.set('plan', wanted);
          if (force) params.set('refresh', '1');
          const response = await fetch(`${api('/opencode-quota/api/snapshot')}?${params.toString()}`, { cache: 'no-store' });
          const body = await response.json();
          setSnapshot(body);
          setError(body && body.ok === false ? (body.error || 'unavailable') : null);
          if (body && typeof body.plan === 'string' && body.plan && body.plan !== plan) {
            setPlanState(body.plan);
            writePlan(body.plan);
          }
        } catch (failure) {
          setError(String(failure && failure.message ? failure.message : failure));
        } finally {
          setBusy(false);
        }
      }, [plan]);

      React.useEffect(() => {
        load(false);
      }, [load]);

      React.useEffect(() => {
        const timer = window.setInterval(() => {
          if (!document.hidden) load(false);
        }, 60_000);
        const onVisible = () => {
          if (!document.hidden) load(false);
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
          window.clearInterval(timer);
          document.removeEventListener('visibilitychange', onVisible);
        };
      }, [load]);

      const setPlan = (next) => {
        writePlan(next);
        setPlanState(next);
      };

      return {
        snapshot,
        error,
        busy,
        load,
        plan,
        setPlan,
        activePlan: plan || (snapshot && snapshot.plan) || 'go',
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
      .ocq-select:focus-visible, .ocq-search:focus-visible, .ocq-button:focus-visible {
        border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, transparent);
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
      .ocq-bar > span { display: block; height: 100%; border-radius: inherit; background: var(--dsw-alias-brand-primary); }
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
      .ocq-table tbody td.is-name { text-align: left; max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
      .ocq-table tbody tr:last-child td { border-bottom: none; }
      .ocq-table tbody tr:hover td { background: var(--dsw-alias-bg-layer-2); }
      .ocq-model { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .ocq-model-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
      .ocq-model-id { font-size: 11px; color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; }
      .ocq-tag { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }
      .ocq-tag.is-free { color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); }
      .ocq-low { color: var(--dsw-alias-state-warn-primary); }
      .ocq-floor { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; font-size: 11px; color: var(--dsw-alias-label-tertiary); }
      .ocq-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .ocq-empty { padding: 20px 12px; text-align: center; font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .ocq-pane { display: flex; flex-direction: column; gap: 12px; padding: 14px; height: 100%; overflow: auto; box-sizing: border-box; }
      .ocq-entry {
        display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px;
        border-radius: 8px; cursor: pointer; font-size: 12px;
        color: var(--dsw-alias-label-secondary);
        background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
      }
      .ocq-entry:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
      .ocq-entry:focus-visible {
        outline: none; border-color: var(--dsw-alias-brand-primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, transparent);
      }
      .ocq-entry-value { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
      .ocq-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); }
      .ocq-dot.is-warn { background: var(--dsw-alias-state-warn-primary); }
      .ocq-dot.is-danger { background: var(--dsw-alias-state-error-primary); }
      .ocq-dot.is-idle { background: var(--dsw-alias-state-idle-primary); }
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

    function QuotaPanel() {
      const quota = useQuota();
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
                      h('span', { className: 'ocq-model-id ocq-mono' }, model.id))),
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

    function QuotaButton() {
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
          className: 'ocq-entry', type: 'button',
          title: `${pick('pane.title')} · ${percentText(percent)}`,
          onClick: open,
        },
          h('span', { className: `ocq-dot is-${tone}` }),
          h('span', null, pick('entry.label')),
          h('span', { className: 'ocq-entry-value' }, percentText(percent))));
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
          try {
            const slots = scope.slots;
            if (!slots || typeof slots.inject !== 'function') return;

            scope.effect(() => slots.inject('conversation.session.header.utilities', () => slots.register({
              name: 'conversation.session.header.utilities',
              id: 'opencode-quota-entry',
              order: 30,
            }, () => h(QuotaButton))));
          } catch (failure) {
            warn('header entry', failure);
          }

          try {
            const slots = scope.slots;
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
