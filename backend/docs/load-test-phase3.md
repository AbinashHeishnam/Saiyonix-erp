# Phase 3 Load Test Results

Date: 2026-03-18T21:54:35.008Z
Base URL: http://127.0.0.1:3000
Exam ID: 6e4a3752-2317-41df-a90c-ac1d0b10cac1

| Connections | Duration (s) | Requests/sec | Avg Latency (ms) | P95 Latency (ms) | Error Rate | RSS (MB) | Heap Used (MB) | CPU Load (1m) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1000 | 20 | 3893.80 | 246.51 | 100.00 | 0.00% | 245.23 | 59.64 | 1.87 |
| 2000 | 20 | 3886.65 | 667.60 | 200.00 | 0.00% | 102.11 | 23.76 | 1.21 |
| 5000 | 30 | 3860.13 | 1366.37 | 10000.00 | 0.00% | 694.92 | 301.12 | 1.85 |
| 10000 | 30 | 2235.00 | 4191.31 | 10000.00 | 0.00% | 1041.61 | 592.21 | 1.96 |

Notes:
- Warm-up: 5s at 20% of stage connections before each stage.
- Stages: 1000 → 2000 → 5000 → 10000 connections.
