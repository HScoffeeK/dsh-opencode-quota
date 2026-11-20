# dsh-opencode-quota

OpenCode Go quota for DeepSeek Harness — in the right sidebar, not in a separate tab.

Shows each OpenCode Go model's monthly cap and how much of the shared allowance is left, and exposes the same numbers as an agent tool.

## What you get

- **`额度 4%` in the session header** — the shared monthly allowance already used. Click it to open the right sidebar on the quota page.
- **`OpenCode 额度` tab in the right sidebar** — the full table: every Go model with its monthly cap and the amount left this month, this week, and in the current 5-hour window. It also registers a card in the right sidebar guide.
- **`opencode_quota` tool** — ask "how much OpenCode quota is left" or "which model still has room" in chat.

All models share one allowance, so a model's remaining amount is that shared percentage applied to the model's own monthly cap — the same relationship the OpenCode Console uses for per-model monthly limits.

## Install

```sh
dsh plugin --profile <profile> add github:HScoffeeK/dsh-opencode-quota
```

Or install the local directory from **Settings → Plugins → Add plugin**.

Restart the host (or reload the window) once after installing; DSH loads client plugins at page boot.

## Data source

| Read | Endpoint | Key |
| --- | --- | --- |
| Model catalog and per-model monthly caps | `GET https://opencode.ai/inference/go/v1/models` | not required |
| Shared allowance percentages and reset times | `GET https://opencode.ai/inference/go/v1/usage` | required |

## Key discovery

No secret is copied or stored by the plugin. It resolves the first available source:

1. `apiKeyEnv` in the plugin config, through the DSH credential service.
2. `OPENCODE_API_KEY` or `OPENCODE_GO_API_KEY` in the environment.
3. The credential reference of an installed OpenCode Go provider row (for example `dsh-opencode-go`).
4. A matching credential reference in the composed profile configuration.
5. The OpenCode CLI's own `auth.json`.

The key stays on the Host; the browser never receives it, and remote error text is redacted.

## Configuration (optional)

```yaml
- id: opencode-quota
  name: dsh-opencode-quota
  config:
    apiKeyEnv: DSH_OPENCODE_GO_ACCOUNT_EXAMPLE
    plan: go
    cacheTTLSeconds: 60
```

| Field | Default | Meaning |
| --- | --- | --- |
| `apiKeyEnv` | unset | Credential reference when automatic discovery is not wanted |
| `baseURL` | `https://opencode.ai/inference/go/v1` | Gateway for the two reads |
| `plan` | `go` | Starting plan (Go / Go Plus / Go Teams); the page also has a selector |
| `cacheTTLSeconds` | `60` | Snapshot freshness |
| `timeoutMs` | `8000` | Per-request timeout |

## Limitations

- OpenCode Go only. OpenCode Models (pay-as-you-go credits) has no comparable allowance read.
- The gateway reports one shared allowance; per-model figures are derived from it. The 5-hour limit is 20% of the monthly allowance and the weekly limit is 50%, as documented by OpenCode.
- The snapshot route is a read-only localhost endpoint gated by the host's request admission (`ctx.connection.requestRejection`): unauthenticated requests get 401, untrusted origins 403, and the payload holds caps and percentages only — never the key.

## 中文说明

在 DSH 右侧边栏查看 OpenCode Go 各模型的月度上限与共享额度剩余：

- 会话标题栏右侧的 `额度 X%` 按钮打开右侧栏页面；
- 右侧栏 guide 里也有「OpenCode 额度」卡片；
- 对话里可以直接问「还剩多少额度」，会走 `opencode_quota` 工具。

额度按共享额度折算到每个模型的月上限；数据来自 OpenCode Go 的公开模型目录与账号 usage 接口，密钥自动复用 DSH 里已有的 OpenCode Go 凭据。

## License

MIT
