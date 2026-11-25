# OpenCode quota

Shows, inside the right sidebar of DeepSeek Harness, what each OpenCode Go model still has left.

## Where it appears

- **Session header / composer dock / sidebar footer → `额度 X%`** — three optional clickable entries. Each shows the shared monthly allowance already used and opens the right sidebar on the OpenCode quota page.
- **Right sidebar → `OpenCode 额度` tab** — the page itself. It also contributes a card to the right sidebar's guide, so expanding the sidebar offers the page there too.
- **Settings → `OpenCode 额度显示`** — toggles for the three entries and for model prices; every change is saved on the Host immediately.
- **`opencode_quota` tool** — the same numbers as text, for questions like "how much OpenCode quota is left" or "which model still has room".

## What the page shows

- The shared 5-hour / weekly / monthly allowance, with percentages and reset times.
- Every Go model with its monthly cap for the selected plan (Go, Go Plus, Go Teams) and the amount left this month, this week, and in the current 5-hour window.
- Each model's **input / output / cache-read (and cache-write when priced) USD price per 1M tokens**, read from the public catalog.
- Plan switch, refresh, and a source/footer line naming the credential that was used.

Every model shares one allowance. A model's remaining amount is that shared percentage applied to the model's own monthly cap, which is the same relationship the OpenCode Console uses when it prints per-model monthly limits.

## Where the data comes from

| Read | Endpoint | Key |
| --- | --- | --- |
| Model catalog and per-model monthly caps | `GET https://opencode.ai/inference/go/v1/models` | not required |
| Shared allowance percentages and reset times | `GET https://opencode.ai/inference/go/v1/usage` | required |

The catalog is public, so the model list and caps still render without a key; without a usable key the allowance columns show as unavailable.

## Key discovery

The plugin never stores or copies a secret. It resolves the first available source:

1. `apiKeyEnv` in the plugin's own config, resolved through the DSH credential service.
2. `OPENCODE_API_KEY` or `OPENCODE_GO_API_KEY` in the environment.
3. The credential reference used by an installed OpenCode Go provider row (for example `dsh-opencode-go`), read from the live provider directory.
4. A matching credential reference found in the composed profile configuration.
5. The OpenCode CLI's own auth file.

The key stays on the Host. It is never sent to the browser; remote error text is redacted before it is returned.

## Practical behavior

- Results are cached for 60 seconds. The refresh button bypasses the cache.
- A failed refresh keeps the previous numbers and reports the failure separately, so the page does not go blank on a network hiccup.
- Requests time out after 8 seconds, follow no redirects, and are read-only GETs.
- `http://` gateways are accepted only for loopback addresses.

## Configuration (all optional)

Add fields to this plugin's row in the profile's `cordis.patch.yml`:

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
| `apiKeyEnv` | unset | Credential reference to resolve when automatic discovery is not wanted |
| `baseURL` | `https://opencode.ai/inference/go/v1` | Gateway for the two reads |
| `plan` | `go` | Starting plan; the page also offers a selector |
| `cacheTTLSeconds` | `60` | Freshness of the shared snapshot |
| `timeoutMs` | `8000` | Per-request timeout |

## Limitations

- The gateway documents one shared allowance; there is no per-model consumption endpoint, so per-model figures are derived from that share.
- The 5-hour limit is 20% of the monthly allowance and the weekly limit is 50%, as documented by OpenCode. If those ratios ever change, the derived remaining amounts for those two windows shift with them; the percentages shown are always the gateway's own values.
- Plans can change: switch the plan selector in the page if the caps look wrong.
- Only OpenCode Go is covered; OpenCode Models (pay-as-you-go credits) has no comparable allowance read.
- The page reads a read-only JSON route on the same local Web server, gated by the host's request admission (`ctx.connection.requestRejection`): unauthenticated requests get 401 and untrusted origins/hosts 403, as on the host's own `/api` routes. The payload holds catalog caps and allowance percentages only — never the key.
