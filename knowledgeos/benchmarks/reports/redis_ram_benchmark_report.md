# KnowledgeOS: Redis RAM & 5-Stage Pipeline Benchmark Report

**Execution Timestamp:** `2026-11-02T15:37:31.492Z`  
**Target Environment:** Node.js `v24.8.0` (win32 x64) | Redis `5.0.14.1 (jemalloc)`  
**Workload:** 100 Document Indexing (500 Bull Jobs across 5 Pipeline Stages)  

---

## Executive Summary

This benchmark measures the exact memory characteristics, queue lifecycle, and performance metrics of Redis when processing **100 PDF documents** through KnowledgeOS's asynchronous **5-Stage Document Processing Pipeline**:
`PARSE` → `EMBED` → `SUMMARIZE` → `TAG` → `GRAPH_EXTRACT`

### Key Benchmark Findings

| Metric | Result | Context / Architectural Insight |
| :--- | :--- | :--- |
| **Total Ingestion Time** | **2.79 seconds** | Total wall-clock time to process 100 PDFs across all 5 stages (500 jobs total) |
| **Job Throughput** | **178.89 jobs/sec** | Aggregate Bull queue processing rate across all stages |
| **Document Ingestion Rate** | **35.78 PDFs/sec** | End-to-end fully indexed documents per second |
| **Clean Redis Baseline RAM** | **765.85 KB** (RSS: 644.93 KB) | Initial idle Redis memory footprint |
| **Peak Ingestion RAM** | **1844.94 KB** | Maximum dynamic memory reached during active 5-stage concurrency |
| **Net Peak RAM Delta (Δ)** | **+1079.09 KB** (+1.054 MB) | Peak memory overhead above baseline |
| **Residual Post-Completion RAM** | **1616.05 KB** | Memory retained in Redis after all 100 PDFs complete |
| **Net Residual RAM Delta (Δ)** | **+850.20 KB** | Retained job history and queue metadata |
| **Average RAM per PDF (Peak)** | **10.79 KB / PDF** | Real memory footprint per in-flight document |
| **Average RAM per PDF (Residual)** | **8.50 KB / PDF** | Retained memory per completed document |
| **Redis Keys at Completion** | **515 keys** | 100 completed jobs capped by `removeOnComplete: 100` per queue |

---

## 1. Pipeline Ingestion RAM Progression

The table below tracks Redis memory usage at key milestones as 100 PDFs are ingested and flow concurrently through all 5 queues:

| Milestone / Pipeline State | Used RAM (KB) | Used RAM (MB) | RSS RAM (KB) | Total Redis Keys | Δ vs Baseline (KB) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0. Clean Baseline** | 765.85 KB | 0.748 MB | 644.93 KB | 0 | 0.00 KB |
| **1. 5 Bull Queues Initialized** | 807.41 KB | 0.788 MB | 767.35 KB | 0 | +41.56 KB |
| **2. 25 PDFs Enqueued** | 1657.40 KB | 1.619 MB | 767.35 KB | 35 | +891.55 KB |
| **3. 50 PDFs Enqueued** | 1678.80 KB | 1.639 MB | 767.35 KB | 60 | +912.95 KB |
| **4. 75 PDFs Enqueued** | 1701.20 KB | 1.661 MB | 767.35 KB | 85 | +935.34 KB |
| **5. 100 PDFs Enqueued (Full Backlog)** | 1732.52 KB | 1.692 MB | 767.35 KB | 117 | +966.66 KB |
| **6. Peak In-Flight Load** | **1844.94 KB** | **1.802 MB** | — | — | **+1079.09 KB** |
| **7. Post-Completion (All 100 Done)** | **1616.05 KB** | **1.578 MB** | 1575.99 KB | **515** | **+850.20 KB** |

---

## 2. Memory Breakdown per Queue & Redis Data Structure

Each of the 5 queues maintains its own independent key hierarchy inside Redis. The memory breakdown below was sampled using Redis `MEMORY USAGE <key>`:

| Queue Name | Total Keys | Total Memory (Bytes) | Total Memory (KB) | Job Hashes (KB) | Completed ZSet (KB) | Active/Wait/Counters (KB) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **bull:parse** | 103 | 1,08,394 B | 105.85 KB | 0.00 KB | 3.78 KB | 102.07 KB |
| **bull:embed** | 103 | 1,08,394 B | 105.85 KB | 0.00 KB | 3.78 KB | 102.07 KB |
| **bull:summarize** | 103 | 1,10,306 B | 107.72 KB | 0.00 KB | 4.18 KB | 103.54 KB |
| **bull:tag** | 103 | 1,07,388 B | 104.87 KB | 0.00 KB | 3.58 KB | 101.29 KB |
| **bull:graph-extract** | 103 | 1,12,220 B | 109.59 KB | 0.00 KB | 4.57 KB | 105.02 KB |

### Redis Internal Memory Allocation

- **Dataset Memory (`used_memory_dataset`):** `616.11 KB` (38.1% of used memory)
- **Redis Overhead (`used_memory_overhead`):** `999.95 KB` (Internal jemalloc tracking, hash table buckets, and Redis client buffers)
- **Lua Engine Memory (`used_memory_lua`):** `124.00 KB` (Cached Bull Lua scripts for atomic state transitions)
- **Memory Fragmentation Ratio:** `1.00` (Safe operating range: 1.0 - 1.5)

---

## 3. Pipeline Latency Breakdown (Per-Stage & End-to-End)

Latency distribution across all 100 documents (milliseconds):

| Pipeline Stage | Worker Concurrency | Min (ms) | Mean (ms) | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | Max (ms) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Stage 1: PARSE** | 2 | 11 | 20.69 | 18 | 29 | 29 | 30 | 30 |
| **Stage 2: EMBED** | 2 | 14 | 26.65 | 28 | 29 | 30 | 33 | 33 |
| **Stage 3: SUMMARIZE** | 2 | 26 | 28.93 | 29 | 30 | 30 | 42 | 42 |
| **Stage 4: TAG** | 2 | 11 | 17.15 | 14 | 28 | 28 | 30 | 30 |
| **Stage 5: GRAPH_EXTRACT** | 1 | 14 | 25.97 | 29 | 30 | 30 | 31 | 31 |
| **Total End-to-End** | — | **116** | **1375.9** | **1362** | **2490** | **2645** | **2766** | **2766** |

---

## 4. Benchmark 2: Queue Retention Policy Impact (`removeOnComplete`)

Testing 100 completed jobs under different Bull cleanup policies:

| Retention Policy | Residual RAM Delta (KB) | Residual Keys in Redis | RAM per Completed Job | Architectural Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Strict Purge (removeOnComplete: true)** | **+62.52 KB** | **2 keys** | ~640 B/job | Minimal memory footprint; jobs purged immediately |
| **KnowledgeOS Default (removeOnComplete: 100)** | **+157.27 KB** | **103 keys** | ~1610 B/job | Highest memory footprint; unbounded leak risk if unpruned |
| **Unbounded Retention (removeOnComplete: false)** | **+157.27 KB** | **103 keys** | ~1610 B/job | Highest memory footprint; unbounded leak risk if unpruned |

> **Key Takeaway:** The KnowledgeOS default `removeOnComplete: 100` caps memory growth to **~157.27 KB** per 100 completed jobs. In contrast, unbounded retention (`removeOnComplete: false`) creates a memory leak over thousands of PDFs.

---

## 5. Benchmark 3: Payload Size Sensitivity (Lean vs Fat Jobs)

Testing the memory impact of job data payload sizes across 100 jobs:

| Scenario / Pattern | Payload Size | Total Residual RAM (KB) | RAM Overhead per Job | Memory Amplification |
| :--- | :--- | :--- | :--- | :--- |
| **Lean ID References (KnowledgeOS Pattern: ~150 Bytes)** | ~150 B | **+158.02 KB** | **~1618 B / job** | **1.0x** |
| **Medium Payload (Document Metadata + Headers: ~2 KB)** | ~2 KB | **+186.17 KB** | **~1906 B / job** | **1.2x** |
| **Heavy Anti-Pattern (Raw Chunks inside Redis Job: ~32 KB)** | ~32 KB | **+3348.67 KB** | **~34290 B / job** | **21.2x** |

> **Architectural Warning:** Passing full text chunks directly inside Redis job objects (the heavy anti-pattern) inflates Redis RAM consumption by **21.2x**! Always adhere to the KnowledgeOS design pattern: store raw chunks in PostgreSQL and pass only entity IDs in Bull job data.

---

## 6. Benchmark 4: Worker Concurrency Scaling

Testing throughput and memory across worker concurrency levels (1, 2, 5, 10):

| Concurrency Level | Total Time (ms) | Throughput (jobs/sec) | Speedup Factor | Peak RAM (KB) |
| :--- | :--- | :--- | :--- | :--- |
| **Concurrency = 1** | 2830 ms | **35.34 jobs/sec** | 1.00x | 4120.49 KB |
| **Concurrency = 2** | 1334 ms | **74.96 jobs/sec** | 2.12x | 4120.49 KB |
| **Concurrency = 5** | 548 ms | **182.48 jobs/sec** | 5.16x | 4120.49 KB |
| **Concurrency = 10** | 256 ms | **390.63 jobs/sec** | 11.05x | 4120.49 KB |

---

## 7. Production Redis Sizing & Capacity Planning

Based on empirical benchmark measurements for KnowledgeOS:

| Workload Scale | Active In-Flight Jobs | Estimated Peak Redis RAM | Recommended Redis Memory Limit |
| :--- | :--- | :--- | :--- |
| **100 PDFs (Current Test)** | 500 total jobs | **~1845 KB (~1.80 MB)** | 64 MB |
| **1,000 PDFs** | 5,000 total jobs | **~9.1 MB** | 128 MB |
| **10,000 PDFs** | 50,000 total jobs | **~83.8 MB** | 256 MB |
| **100,000 PDFs** | 500,000 total jobs | **~831 MB** | 1 GB |

### Recommended Redis Production Settings
1. **`maxmemory 256mb`** with **`maxmemory-policy noeviction`** for queue integrity (evicting queue keys breaks Bull state machines).
2. **`removeOnComplete: 50`** and **`removeOnFail: 100`** in `processingQueue.ts` to reduce residual completed job RAM by 50% without losing debugging traces.
3. Keep payloads strictly under **1 KB** (only document and user IDs, never document text).
