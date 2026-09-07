# Load tests

k6 scenarios for the gateway and the two inference services.
Install: <https://grafana.com/docs/k6/latest/set-up/install-k6/>

## Gateway proxy

```bash
k6 run -e BASE_URL=http://localhost:7010 \
       -e API_KEY=<key with a service allocation> \
       -e SERVICE_KEY=asr \
       loadtests/gateway.js
```

Ramps 1 → 50 VUs over two minutes. 429s are counted separately from failures —
under load the correct behaviour is to shed, not to succeed — split into
`gateway_rate_limited` (the per-key window in `rate_limit.py`) and
`gateway_quota_exhausted` (the `ServiceUsage` allocation).

You need a real API key with an allocation for `SERVICE_KEY`; create one with
`POST /api-keys/users/{user_uuid}/api-keys` then
`POST /usage/service-usage`. Raise `RATE_LIMIT_REQUESTS` before a run, or the
test measures the limiter rather than the gateway.

## ASR and TTS

```bash
k6 run -e ASR_URL=http://localhost:7000 -e TTS_URL=http://localhost:7002 \
       loadtests/asr_tts.js
```

Low VU counts on purpose. Both services hold one model in one process and run
inference on the request thread, so concurrency queues rather than
parallelises — the run is looking for where that queue forms, not for a
throughput number.

## Baselines

**Not yet recorded.** These scenarios have been written and syntax-checked but
never run against a loaded stack — this machine has no GPU and the model
containers were not up. Whoever runs them first should fill in the table
below and commit it, so later changes have something to regress against.

| Scenario | VUs | P50 | P95 | Error rate | Date | Notes |
|---|---|---|---|---|---|---|
| gateway `/api` | 50 | | | | | |
| ASR `/transcribe` | 3 | | | | | |
| TTS `/generate` | 3 | | | | | |

## What to look at afterwards

- If ASR/TTS P95 climbs steeply with VUs, the fix is the async task queue —
  register those services with `response_type: long` so the gateway enqueues
  instead of blocking (see issue #34, and `task_worker.py`).
- The task worker is a single in-process consumer. If the queue is the
  bottleneck, run several worker tasks or move the queue to Redis, which is
  already in the compose stack for chatbot-modified.
- `rate_limit.py` counts in process. With more than one gateway replica the
  effective limit multiplies by the replica count.
