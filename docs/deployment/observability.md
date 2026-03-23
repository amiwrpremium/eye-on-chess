# Observability

EyeOnChess includes a full observability stack in the production Docker Compose setup.

## Stack

| Tool           | Version | Purpose                                               | Port                         |
| -------------- | ------- | ----------------------------------------------------- | ---------------------------- |
| **Prometheus** | 3.4.1   | Metrics collection — scrapes API `/metrics` every 15s | internal (9090)              |
| **Loki**       | 3.5.0   | Log aggregation — receives logs from Promtail         | internal (3100)              |
| **Promtail**   | 3.5.0   | Log shipper — reads Docker container logs via socket  | internal                     |
| **Grafana**    | 11.6.0  | Dashboards and log viewer                             | `grafana.{domain}` subdomain |

## Quick Start

```bash
docker compose -f deployment/docker-compose.yml up -d
```

Open Grafana at **http://grafana.localhost** (or `grafana.{your-domain}` in production).

Default credentials:

- **Username:** `admin` (or `GRAFANA_ADMIN_USER`)
- **Password:** `admin` (or `GRAFANA_ADMIN_PASSWORD`)

## Pre-built Dashboards

Grafana is auto-provisioned with three dashboards:

### API Performance (`eyeonchess-api-perf`)

- Request rate (req/s) by method, route, status code
- Request duration (p50, p95)
- Error rate (5xx responses)
- Node.js memory usage (RSS, heap)
- Event loop lag
- Active handles

### Custom Application Metrics

The API exposes chess-specific Prometheus metrics at `/metrics`:

| Metric                             | Type    | Description                    |
| ---------------------------------- | ------- | ------------------------------ |
| `eyeonchess_active_games`          | Gauge   | Currently active games         |
| `eyeonchess_analysis_queue_depth`  | Gauge   | Jobs waiting in analysis queue |
| `eyeonchess_total_users`           | Gauge   | Total registered users         |
| `eyeonchess_games_completed_total` | Counter | Cumulative completed games     |

These are updated every 15 seconds and can be graphed in Grafana alongside the HTTP metrics.

### Slow Query Logging

Database queries taking longer than 100ms are logged as structured JSON warnings:

```json
{ "level": "warn", "msg": "slow query", "duration": 142, "query": "SELECT ...", "reqId": "req-5" }
```

These include the request ID for end-to-end tracing. View them in the Grafana logs dashboard by filtering for `slow query`.

### Application (`eyeonchess-app`)

- Stat panels: active games, total users, analysis queue depth, games completed
- Time series: active games over time, games completed rate (games/min)
- Time series: analysis queue depth over time, user growth
- Color-coded thresholds: green/yellow/red for active games and queue depth

### Logs (`eyeonchess-logs`)

- All service logs (live tail)
- API logs filtered
- Worker logs filtered
- Error logs filtered (`level 50` / "error" keyword)

## Metrics Endpoint

The API exposes Prometheus metrics at `GET /metrics`:

```
# Default Node.js metrics (prom-client)
- process_cpu_user_seconds_total
- process_resident_memory_bytes
- nodejs_heap_size_used_bytes
- nodejs_eventloop_lag_seconds
- nodejs_active_handles_total

# HTTP request metrics (fastify-metrics)
- http_request_duration_seconds_bucket
- http_request_duration_seconds_count
- http_request_duration_seconds_sum
```

There's also `GET /api/metrics/app` returning JSON with:

- `totalUsers` — total registered users
- `activeGames` — currently active games
- `analysisQueue` — pending analysis jobs

## Configuration

| Variable                 | Default | Description            |
| ------------------------ | ------- | ---------------------- |
| `GRAFANA_ADMIN_USER`     | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password |

## File Structure

```
deployment/
  prometheus/
    prometheus.yml          # Scrape config (API target)
  promtail/
    promtail.yml            # Docker log discovery
  grafana/
    provisioning/
      datasources/
        datasources.yml     # Prometheus + Loki auto-config
      dashboards/
        dashboards.yml      # Dashboard provider config
    dashboards/
      api-performance.json  # API metrics dashboard
      logs.json             # Log viewer dashboard
```

## Data Retention

- **Prometheus:** 30 days (`--storage.tsdb.retention.time=30d`)
- **Loki:** Default retention (uses local storage)
- **Grafana:** Persisted in `eyeonchess-grafana-data` Docker volume

## Adding Custom Dashboards

1. Create a JSON dashboard file in `deployment/grafana/dashboards/`
2. It will be auto-loaded by Grafana on next restart
3. Or create dashboards in the Grafana UI — they persist in the volume

## Notes

- Prometheus and Loki are internal-only (no ports exposed to host)
- Grafana is the single entry point for all observability
- Promtail discovers containers automatically via Docker socket
- The `/metrics` endpoint is proxied through Nginx — consider restricting access in production
