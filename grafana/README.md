# Monitoring

Prometheus scrapes every backend service; Grafana renders one provisioned
dashboard. Both are stock upstream images — the only thing owned here is the
configuration.

- **Prometheus**: port 9090, config in `../prometheus.yml`
- **Grafana**: port 3000, provisioning in `provisioning/`

## How metrics get produced

Every FastAPI service mounts `prometheus-fastapi-instrumentator`:

```python
Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

That yields the standard `http_request_*` families labelled by handler, method
and status — request rate, latency histograms, in-progress count. No custom
business metrics exist; token usage is recorded in MySQL (`usage_logs`), not
here, and is surfaced by the gateway's `/usage/summary` and the admin dashboard.

## Scrape targets

`prometheus.yml` scrapes container names on the compose network and relabels
each `__address__` to a friendly `service` label:

| Target | `service` label |
|---|---|
| `asr-be:6000` | `asr` |
| `tts-be:6002` | `tts` |
| `framework-be:6003` | `framework` |
| `chatbot-mod:7006` | `chatbot-modified` |
| `host.docker.internal:7010` | `api-gateway` |

The gateway is reached through `host.docker.internal` (mapped via
`extra_hosts`) rather than a container name, because it runs with
`network_mode: host` and is therefore not on the compose network.

Adding a service means adding it in **two** places in `prometheus.yml`: the
`targets` list and a matching `relabel_configs` entry. Miss the second and the
panels below will group it as `api-gateway`, which is the fallback label.

## Dashboard

`provisioning/dashboards/backend-services.json` — "Backend Services Overview",
provisioned automatically at startup:

- **Service Status** — up/down per service
- **Traffic** — request rate and 5xx rate by service
- **Latency** — p95 by service, plus in-progress requests
- **Status Codes** — response code rate, top endpoints by req/s

`provisioning/datasources/prometheus.yml` wires the datasource, so there is
nothing to click through on first boot.

## Running it

```bash
docker compose up -d prometheus grafana
```

Grafana is at `http://localhost:3000`, admin password from
`GRAFANA_ADMIN_PASSWORD`. **The committed example sets it to `admin`** — change
it before exposing this anywhere (see `docs/SECURITY-AUDIT.md`).

## Known gaps

- No alerting rules and no Alertmanager: the dashboard is look-at-it-yourself.
- Prometheus data lives in a named volume with default retention; nothing is
  backed up.
- The model services report request latency, but not queue depth or inference
  time, which is what actually saturates them. `loadtests/README.md` covers what
  to measure instead.
