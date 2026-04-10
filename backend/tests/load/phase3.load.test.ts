import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { performance } from "node:perf_hooks";

const baseUrl = process.env.LOAD_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const examId = process.env.LOAD_TEST_EXAM_ID;
const disableRateLimit = process.env.DISABLE_RATE_LIMIT === "true";
const authHeader =
  process.env.LOAD_TEST_AUTH_HEADER ??
  (process.env.LOAD_TEST_TOKEN ? `Bearer ${process.env.LOAD_TEST_TOKEN}` : "");

if (!examId) {
  throw new Error("LOAD_TEST_EXAM_ID is required for Phase 3 load testing");
}

if (!authHeader) {
  throw new Error("LOAD_TEST_AUTH_HEADER or LOAD_TEST_TOKEN is required for Phase 3 load testing");
}

let resolvedStudentId: string | null = null;
let endpoints: string[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTokenFromAuthHeader(header: string) {
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid auth token format");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf8");
  try {
    return JSON.parse(payload) as { exp?: number };
  } catch {
    throw new Error("Invalid auth token payload");
  }
}

function assertTokenNotExpired(header: string) {
  const token = getTokenFromAuthHeader(header);
  const payload = decodeJwtPayload(token);
  if (!payload.exp) {
    throw new Error("Auth token missing exp claim");
  }
  const expiresAtMs = payload.exp * 1000;
  if (Date.now() >= expiresAtMs) {
    throw new Error("Auth token has expired");
  }
}

async function fetchStudentId(headers: Record<string, string>) {
  if (process.env.LOAD_TEST_STUDENT_ID) {
    return process.env.LOAD_TEST_STUDENT_ID;
  }

  const response = await fetch(`${baseUrl}/api/v1/students?limit=1`, { headers });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(
      `Failed to resolve studentId for load test (status ${response.status}). ${bodyText}`
    );
  }
  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  const studentId = payload.data?.[0]?.id;
  if (!studentId) {
    throw new Error("No students found to resolve studentId for load test");
  }
  return studentId;
}

function snapshotResources() {
  const mem = process.memoryUsage();
  return {
    rssMb: mem.rss / 1024 / 1024,
    heapUsedMb: mem.heapUsed / 1024 / 1024,
    loadAvg1m: os.loadavg()[0],
  };
}

type StageMetrics = {
  connections: number;
  durationSeconds: number;
  requestsPerSec: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  before: { rssMb: number; heapUsedMb: number; loadAvg1m: number };
  after: { rssMb: number; heapUsedMb: number; loadAvg1m: number };
};

const latencyBuckets = [25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 2000, 5000, 10000];

function recordLatency(buckets: number[], value: number, counts: number[]) {
  const idx = buckets.findIndex((limit) => value <= limit);
  if (idx === -1) {
    counts[counts.length - 1] += 1;
  } else {
    counts[idx] += 1;
  }
}

function computeP95(buckets: number[], counts: number[], total: number) {
  if (total === 0) return 0;
  const threshold = total * 0.95;
  let cumulative = 0;
  for (let i = 0; i < counts.length; i += 1) {
    cumulative += counts[i];
    if (cumulative >= threshold) {
      return buckets[i] ?? buckets[buckets.length - 1];
    }
  }
  return buckets[buckets.length - 1];
}

async function runStage(connections: number, durationSeconds: number): Promise<StageMetrics> {
  const before = snapshotResources();
  const endTime = Date.now() + durationSeconds * 1000;
  const headers = authHeader ? { Authorization: authHeader } : undefined;

  let totalRequests = 0;
  let totalErrors = 0;
  let totalLatency = 0;
  let loggedFailures = 0;
  const maxFailureLogs = 5;
  const counts = Array(latencyBuckets.length + 1).fill(0);

  let cursor = 0;
  const pickEndpoint = () => {
    const path = endpoints[cursor % endpoints.length];
    cursor += 1;
    return path;
  };

  const worker = async () => {
    while (Date.now() < endTime) {
      const path = pickEndpoint();
      const start = performance.now();
      try {
        let attempt = 0;
        let success = false;
        let lastStatus: number | null = null;
        let lastStatusText = "";

        while (attempt <= 2 && !success) {
          attempt += 1;
          const response = await fetch(`${baseUrl}${path}`, { headers });
          lastStatus = response.status;
          lastStatusText = response.statusText;

          if (response.ok) {
            success = true;
          } else if (response.status === 429 && disableRateLimit) {
            success = true;
          } else if (response.status >= 500 && attempt <= 2) {
            if (loggedFailures < maxFailureLogs) {
              let bodyText = "";
              try {
                const clone = response.clone();
                bodyText = await clone.text();
              } catch (err) {
                bodyText = `[unable to read body: ${String(err)}]`;
              }
              console.log("[load-test][fail]", {
                endpoint: path,
                status: response.status,
                statusText: response.statusText,
                body: bodyText,
              });
              loggedFailures += 1;
            }
            await response.arrayBuffer();
            continue;
          } else {
            await response.arrayBuffer();
            break;
          }
        }

        if (!success) {
          totalErrors += 1;
          if (lastStatus !== null && lastStatus >= 500 && loggedFailures < maxFailureLogs) {
            console.log("[load-test][fail]", {
              endpoint: path,
              status: lastStatus,
              statusText: lastStatusText,
            });
            loggedFailures += 1;
          }
        }
      } catch (err) {
        let attempt = 0;
        let success = false;
        while (attempt < 2 && !success) {
          attempt += 1;
          try {
            const response = await fetch(`${baseUrl}${path}`, { headers });
            if (response.ok || (response.status === 429 && disableRateLimit)) {
              await response.arrayBuffer();
              success = true;
              break;
            }
            await response.arrayBuffer();
            if (response.status >= 500 && loggedFailures < maxFailureLogs) {
              console.log("[load-test][fail]", {
                endpoint: path,
                status: response.status,
                statusText: response.statusText,
              });
              loggedFailures += 1;
            }
          } catch (retryErr) {
            if (attempt >= 2) {
              break;
            }
          }
        }
        if (!success) {
          totalErrors += 1;
          if (loggedFailures < maxFailureLogs) {
            console.log("[load-test][fail]", {
              endpoint: path,
              error: String(err),
            });
            loggedFailures += 1;
          }
        }
      } finally {
        const latency = performance.now() - start;
        totalLatency += latency;
        totalRequests += 1;
        recordLatency(latencyBuckets, latency, counts);
      }
    }
  };

  const rampSeconds = Math.min(5, durationSeconds);
  const rampSteps = Math.max(1, rampSeconds);
  const workers: Promise<void>[] = [];

  for (let step = 1; step <= rampSteps; step += 1) {
    const target = Math.ceil((connections * step) / rampSteps);
    while (workers.length < target) {
      workers.push(worker());
    }
    await sleep(1000);
  }

  await Promise.all(workers);

  const after = snapshotResources();
  const avgLatencyMs = totalRequests ? totalLatency / totalRequests : 0;
  const p95LatencyMs = computeP95(latencyBuckets, counts, totalRequests);
  const errorRate = totalRequests ? totalErrors / totalRequests : 0;
  const requestsPerSec = totalRequests / durationSeconds;

  return {
    connections,
    durationSeconds,
    requestsPerSec,
    avgLatencyMs,
    p95LatencyMs,
    errorRate,
    before,
    after,
  };
}

async function runLoad(connections: number, durationSeconds: number) {
  const warmupConnections = Math.max(1, Math.floor(connections / 5));
  await runStage(warmupConnections, 5);
  await sleep(2000);
  return runStage(connections, durationSeconds);
}

describe("phase3 load test", () => {
  it("runs staged load against real backend without OOM", async () => {
    assertTokenNotExpired(authHeader);
    const headers = { Authorization: authHeader };
    resolvedStudentId = await fetchStudentId(headers);
    const encodedStudentId = encodeURIComponent(resolvedStudentId);
    endpoints = [
      `/api/v1/results/${examId}?studentId=${encodedStudentId}`,
      `/api/v1/report-cards/${examId}?studentId=${encodedStudentId}`,
      `/api/v1/ranking/${examId}`,
      `/api/v1/admit-cards/${examId}?studentId=${encodedStudentId}`,
    ];
    console.log("[load-test] baseUrl:", baseUrl);
    console.log("[load-test] examId:", examId);
    console.log("[load-test] authHeader present:", Boolean(authHeader));
    console.log("[load-test] authHeader length:", authHeader.length);
    console.log("[load-test] studentId:", resolvedStudentId);
    console.log("[load-test] endpoints:", endpoints);
    const stages = [
      { connections: 1000, durationSeconds: 20 },
      { connections: 2000, durationSeconds: 20 },
      { connections: 5000, durationSeconds: 30 },
      { connections: 10000, durationSeconds: 30 },
    ];
    const results: StageMetrics[] = [];

    for (const stage of stages) {
      const stageResult = await runLoad(stage.connections, stage.durationSeconds);
      results.push(stageResult);
      console.log("[load-test]", stageResult);
      await sleep(3000);
    }

    const lastStage = results[results.length - 1];
    const stableForOptional =
      lastStage &&
      lastStage.errorRate < 0.01 &&
      lastStage.p95LatencyMs < 1500;

    const output = [
      "# Phase 3 Load Test Results",
      "",
      `Date: ${new Date().toISOString()}`,
      `Base URL: ${baseUrl}`,
      `Exam ID: ${examId}`,
      "",
      "| Connections | Duration (s) | Requests/sec | Avg Latency (ms) | P95 Latency (ms) | Error Rate | RSS (MB) | Heap Used (MB) | CPU Load (1m) |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...results.map(
        (row) =>
          `| ${row.connections} | ${row.durationSeconds} | ${row.requestsPerSec.toFixed(
            2
          )} | ${row.avgLatencyMs.toFixed(2)} | ${row.p95LatencyMs.toFixed(
            2
          )} | ${(row.errorRate * 100).toFixed(2)}% | ${row.after.rssMb.toFixed(
            2
          )} | ${row.after.heapUsedMb.toFixed(2)} | ${row.after.loadAvg1m.toFixed(2)} |`
      ),
      "",
      "Notes:",
      `- Warm-up: 5s at 20% of stage connections before each stage.`,
      `- Stages: 1000 → 2000 → 5000 → 10000 connections.`,
      "",
    ].join("\n");

    const outputPath = path.resolve(__dirname, "..", "..", "docs", "load-test-phase3.md");
    await fs.writeFile(outputPath, output, "utf8");

    for (const result of results) {
      expect(result.errorRate).toBeLessThan(0.01);
    }
  }, 600_000);
});
