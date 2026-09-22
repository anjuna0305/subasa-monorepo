/*
 * k6 load test for the metered gateway proxy.
 *
 * The gateway is the only component every request passes through, so it is
 * where queueing shows up first. This drives /api/{service_key} with a real
 * API key and reports the split between success, rate-limited and
 * quota-exhausted responses — a 429 is a correct answer under load, not an
 * error, so they are counted separately rather than failing the run.
 *
 *   k6 run -e BASE_URL=http://localhost:7010 -e API_KEY=... -e SERVICE_KEY=asr \
 *          loadtests/gateway.js
 */

import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:7010";
const API_KEY = __ENV.API_KEY;
const SERVICE_KEY = __ENV.SERVICE_KEY || "asr";
const PATH = __ENV.SERVICE_PATH || "health";

const rateLimited = new Counter("gateway_rate_limited");
const quotaExhausted = new Counter("gateway_quota_exhausted");
const upstreamErrors = new Counter("gateway_upstream_errors");
const okLatency = new Trend("gateway_ok_latency", true);

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 50 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    // Only successful requests are held to a latency budget.
    gateway_ok_latency: ["p(50)<300", "p(95)<1500"],
    // 429s are expected; genuine 5xx are not.
    gateway_upstream_errors: ["count<10"],
  },
};

export default function () {
  if (!API_KEY) {
    throw new Error("set -e API_KEY=<a key with a service allocation>");
  }

  const response = http.post(
    `${BASE_URL}/api/${SERVICE_KEY}/${PATH}`,
    JSON.stringify({}),
    {
      headers: { "Content-Type": "application/json", "X-Api-Key": API_KEY },
    },
  );

  if (response.status === 429) {
    const detail = response.json("detail.0.field");
    if (detail === "usage_limit") quotaExhausted.add(1);
    else rateLimited.add(1);
  } else if (response.status >= 500) {
    upstreamErrors.add(1);
  } else {
    okLatency.add(response.timings.duration);
  }

  check(response, {
    "not a server error": (r) => r.status < 500,
  });
}
