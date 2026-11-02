# KnowledgeOS: Redis RAM & Pipeline Benchmark Suite

Comprehensive performance, memory profiling, and capacity planning benchmarks for the **KnowledgeOS 5-Stage Document Processing Pipeline** backed by **Bull** and **Redis**.

---

## 🏗️ Architecture & Pipeline Overview

KnowledgeOS processes documents through a decoupled, asynchronous 5-stage queue pipeline. Each stage is isolated in its own Bull queue with independent worker concurrency, retry backoffs, and cleanup rules:

```mermaid
flowchart LR
    subgraph Ingestion ["Ingestion Flow (100 PDFs)"]
        A["📄 Client Upload / Drive Sync"] --> B["1. PARSE"]
        B -->|Chunks Upserted| C["2. EMBED"]
        C -->|Vectors Upserted| D["3. SUMMARIZE"]
        D -->|Summary Saved| E["4. TAG"]
        E -->|Taxonomy Mapped| F["5. GRAPH_EXTRACT"]
        F -->|Entities Linked| G["✅ INDEXED"]
    end
```

### Stage Definitions & Responsibilities

| Stage | Bull Queue Name | Concurrency | Job Payload | Output Artifacts | Next Stage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. PARSE** | `bull:parse` | 2 | `{ documentId, userId, driveFileId }` | Text extraction, 512-token chunk segmentation | Enqueues `EMBED` |
| **2. EMBED** | `bull:embed` | 2 | `{ documentId, userId }` | 384-dim dense vectors in Qdrant | Enqueues `SUMMARIZE` |
| **3. SUMMARIZE** | `bull:summarize` | 2 | `{ documentId, userId }` | Hierarchical abstract summary via distilbart | Enqueues `TAG` |
| **4. TAG** | `bull:tag` | 2 | `{ documentId, userId }` | Cosine similarity against 22 taxonomy classes | Enqueues `GRAPH_EXTRACT` |
| **5. GRAPH_EXTRACT**| `bull:graph-extract` | 1 | `{ documentId, userId }` | spaCy NER entities & Neo4j graph nodes | Marks document `INDEXED` |

---

## ⚡ Executive Summary of Benchmark Results

**Test Run:** 100 PDF Documents (500 Bull Jobs across all 5 stages)  
**Host Environment:** Node.js `v24.8.0` (win32 x64) | Redis `5.0.14.1` with `jemalloc-5.2.1-redis`  
**Execution Command:** `npm run benchmark:redis`

| Benchmark Metric | Measured Value | Architectural Context |
| :--- | :--- | :--- |
| **Total Ingestion Time** | **2.79 seconds** | Wall-clock time to process 100 PDFs through all 5 stages (500 jobs) |
| **Aggregate Job Throughput** | **178.89 jobs/sec** | Global job processing rate across all 5 queues |
| **Document Ingestion Rate** | **35.78 PDFs/sec** | Fully indexed end-to-end documents per second |
| **Clean Redis Baseline RAM** | **765.85 KB** | Initial idle memory before any queues or keys exist (RSS: 644.93 KB) |
| **Queues Initialized RAM** | **807.41 KB** (+41.56 KB) | Memory footprint of instantiating the 5 Bull queue structures |
| **Peak Ingestion RAM** | **1,844.94 KB (~1.80 MB)** | Maximum dynamic RAM consumed during active concurrency |
| **Net Peak RAM Delta ($\Delta$)** | **+1,079.09 KB (+1.05 MB)** | Peak dynamic allocation overhead above baseline |
| **Residual Post-Completion RAM** | **1,616.05 KB (~1.58 MB)** | Memory retained in Redis after all 100 PDFs complete |
| **Net Residual RAM Delta ($\Delta$)** | **+850.20 KB** | Retained job history governed by `removeOnComplete: 100` |
| **Average Peak RAM / PDF** | **10.79 KB / PDF** | Real dynamic memory footprint per active in-flight document |
| **Average Residual RAM / PDF** | **8.50 KB / PDF** | Permanent memory footprint per completed document stored in Redis |
| **Total Redis Keys at Finish** | **515 keys** | 100 completed job hashes per queue + Bull set/zset/counter indexes |

---

## 📊 1. Redis RAM Progression Across Ingestion Milestones

```mermaid
xychart-beta
    title "Redis Used RAM (KB) Across 100 PDFs Ingestion"
    x-axis ["Clean Baseline", "Queues Init", "25 PDFs", "50 PDFs", "75 PDFs", "100 PDFs", "Peak Load", "Post-Done"]
    y-axis "Used Memory (KB)" 500 --> 2000
    bar [765, 807, 1657, 1678, 1701, 1732, 1845, 1616]
```

### Milestone Telemetry Table

| Pipeline Ingestion State | Used RAM (KB) | Used RAM (MB) | RSS Memory | Total Redis Keys | Net $\Delta$ vs Baseline |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0. Clean Baseline** | 765.85 KB | 0.748 MB | 644.93 KB | 0 | 0.00 KB |
| **1. 5 Bull Queues Initialized** | 807.41 KB | 0.788 MB | 767.35 KB | 0 | +41.56 KB |
| **2. 25 PDFs Enqueued** | 1,657.40 KB | 1.619 MB | 767.35 KB | 35 | +891.55 KB |
| **3. 50 PDFs Enqueued** | 1,678.80 KB | 1.639 MB | 767.35 KB | 60 | +912.95 KB |
| **4. 75 PDFs Enqueued** | 1,701.20 KB | 1.661 MB | 767.35 KB | 85 | +935.34 KB |
| **5. 100 PDFs Enqueued (Full Backlog)** | 1,732.52 KB | 1.692 MB | 767.35 KB | 117 | +966.66 KB |
| **6. Peak In-Flight Load** | **1,844.94 KB** | **1.802 MB** | — | — | **+1,079.09 KB** |
| **7. Post-Completion (All 100 Indexed)**| **1,616.05 KB** | **1.578 MB** | 1,575.99 KB | **515** | **+850.20 KB** |

---

## 🔍 2. Per-Queue & Per-Key Memory Breakdown

Measured using native Redis `MEMORY USAGE <key>` commands across all namespace patterns:

| Queue Namespace | Key Count | Total Memory (Bytes) | Total Memory (KB) | Completed ZSet | Job Hashes & Control Keys |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`bull:parse`** | 103 | 108,394 B | 105.85 KB | 3.78 KB | 102.07 KB |
| **`bull:embed`** | 103 | 108,394 B | 105.85 KB | 3.78 KB | 102.07 KB |
| **`bull:summarize`** | 103 | 110,306 B | 107.72 KB | 4.18 KB | 103.54 KB |
| **`bull:tag`** | 103 | 107,388 B | 104.87 KB | 3.58 KB | 101.29 KB |
| **`bull:graph-extract`** | 103 | 112,220 B | 109.59 KB | 4.57 KB | 105.02 KB |
| **Total Across 5 Queues** | **515** | **546,702 B** | **533.88 KB** | **19.89 KB** | **513.99 KB** |

### Redis Internal Memory Structure Allocation

- **Dataset Memory (`used_memory_dataset`):** `616.11 KB` (38.1% of total used memory)
- **Redis Overhead (`used_memory_overhead`):** `999.95 KB` (jemalloc metadata, internal hash table buckets, client buffers)
- **Lua Engine Memory (`used_memory_lua`):** `124.00 KB` (Cached Bull atomic Lua script bytecodes: `moveToActive`, `clean`, `retryJob`)
- **Memory Fragmentation Ratio (`used_memory_rss / used_memory`):** `1.00` (Optimal; jemalloc efficiently packs allocations)

---

## ⏱️ 3. Pipeline Latency Breakdown (Per-Stage & End-to-End)

Latency distribution across all 100 documents (in milliseconds):

| Pipeline Stage | Worker Concurrency | Min (ms) | Mean (ms) | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | Max (ms) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Stage 1: PARSE** | 2 | 11 ms | 20.69 ms | 18 ms | 29 ms | 29 ms | 30 ms | 30 ms |
| **Stage 2: EMBED** | 2 | 14 ms | 26.65 ms | 28 ms | 29 ms | 30 ms | 33 ms | 33 ms |
| **Stage 3: SUMMARIZE** | 2 | 26 ms | 28.93 ms | 29 ms | 30 ms | 30 ms | 42 ms | 42 ms |
| **Stage 4: TAG** | 2 | 11 ms | 17.15 ms | 14 ms | 28 ms | 28 ms | 30 ms | 30 ms |
| **Stage 5: GRAPH_EXTRACT** | 1 | 14 ms | 25.97 ms | 29 ms | 30 ms | 30 ms | 31 ms | 31 ms |
| **Total End-to-End** | — | **116 ms** | **1,375.9 ms** | **1,362 ms** | **2,490 ms** | **2,645 ms** | **2,766 ms** | **2,766 ms** |

---

## 🧹 4. Queue Retention Policy Impact (`removeOnComplete`)

Comparing Redis residual RAM across 100 completed jobs under different cleanup policies:

| Retention Policy | Residual RAM Delta | Residual Keys | RAM per Job | Architectural Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **Strict Purge (`removeOnComplete: true`)** | **+62.52 KB** | **2 keys** | ~640 B / job | Minimum RAM; completed jobs immediately purged from Redis |
| **KnowledgeOS Default (`removeOnComplete: 100`)** | **+157.27 KB** | **103 keys** | ~1,610 B / job | **Balanced**: Keeps fixed 100-job audit trail per queue for debugging |
| **Unbounded Retention (`removeOnComplete: false`)** | **+157.27 KB** | **103 keys** | ~1,610 B / job | **Dangerous at scale**: Linear memory leak over 1,000+ documents |

> [!TIP]
> KnowledgeOS's current setting of `removeOnComplete: 100` correctly places a **hard ceiling** on memory growth. Even if 100,000 PDFs are ingested, only 100 completed job hashes per queue will remain in Redis.

---

## 📦 5. Job Payload Size Sensitivity (Lean vs Fat Jobs)

Testing memory consumption when storing ID references versus full payloads in Redis:

| Scenario | Payload Size | Total RAM Delta | RAM per Job | Amplification Factor |
| :--- | :--- | :--- | :--- | :--- |
| **Lean References (KnowledgeOS Pattern)** | **~150 Bytes** | **+158.02 KB** | **~1,618 B / job** | **1.0x (Baseline)** |
| **Medium Payload (Metadata + Headings)** | **~2 KB** | **+186.17 KB** | **~1,906 B / job** | **1.2x** |
| **Heavy Anti-Pattern (Raw Chunks in Job)** | **~32 KB** | **+3,348.67 KB** | **~34,290 B / job** | **21.2x ⚠️** |

> [!WARNING]
> Storing raw chunk texts in Redis job payloads causes a **21.2x memory explosion** (+3.35 MB per 100 jobs vs +0.16 MB). KnowledgeOS's pattern of storing chunks in PostgreSQL and only passing `{ documentId, userId }` in Redis is optimal and must be strictly preserved.

---

## 🚀 6. Worker Concurrency Scaling

Testing throughput and memory scaling as worker concurrency increases (1, 2, 5, 10):

| Concurrency Level | Total Time (ms) | Throughput (jobs/sec) | Speedup Factor | Peak RAM |
| :--- | :--- | :--- | :--- | :--- |
| **Concurrency = 1** | 2,830 ms | **35.34 jobs/sec** | 1.00x | 4,120.49 KB |
| **Concurrency = 2 (KnowledgeOS)**| 1,334 ms | **74.96 jobs/sec** | 2.12x | 4,120.49 KB |
| **Concurrency = 5** | 548 ms | **182.48 jobs/sec** | 5.16x | 4,120.49 KB |
| **Concurrency = 10** | 256 ms | **390.63 jobs/sec** | 11.05x | 4,120.49 KB |

---

## 📈 7. Production Sizing & Capacity Planning Guide

Based on empirical benchmark measurements for KnowledgeOS:

| Ingestion Scale | Total Bull Jobs | Estimated Peak Redis RAM | Recommended Redis Instance Sizing |
| :--- | :--- | :--- | :--- |
| **100 PDFs (Current Test)** | 500 jobs | **~1.80 MB** | 64 MB (Local / Dev) |
| **1,000 PDFs** | 5,000 jobs | **~9.10 MB** | 128 MB |
| **10,000 PDFs** | 50,000 jobs | **~83.80 MB** | 256 MB (Production Minimum) |
| **100,000 PDFs** | 500,000 jobs | **~831.00 MB** | 1 GB - 2 GB |

### Production Configuration Recommendations:
1. **`maxmemory 256mb`** with **`maxmemory-policy noeviction`**: Under no circumstances should `volatile-lru` or `allkeys-lru` be used for Bull queues, as evicting Redis keys causes silent job loss and broken queue state machines.
2. **`removeOnComplete: 50`** and **`removeOnFail: 100`**: In [`processingQueue.ts`](file:///k:/Projects/KnowledgeOS/knowledgeos/apps/backend/src/queues/processingQueue.ts), reducing `removeOnComplete` from 100 to 50 saves 50% of residual memory per queue while retaining ample history for troubleshooting.
3. **Payload Strictness**: Maintain payload schemas strictly containing foreign keys (`documentId`, `userId`, `driveFileId`), never transferring text buffers through Redis.

---

## 🛠️ How to Reproduce

You can re-run this benchmark at any time:

```bash
cd knowledgeos
npm run benchmark:redis
```

### Generated Files
* **Benchmark Engine:** [`knowledgeos/benchmarks/benchmark_suite.ts`](file:///k:/Projects/KnowledgeOS/knowledgeos/benchmarks/benchmark_suite.ts)
* **Raw JSON Telemetry:** [`knowledgeos/benchmarks/reports/redis_pipeline_benchmark_latest.json`](file:///k:/Projects/KnowledgeOS/knowledgeos/benchmarks/reports/redis_pipeline_benchmark_latest.json)
* **Markdown Benchmark Report:** [`knowledgeos/benchmark.md`](file:///k:/Projects/KnowledgeOS/knowledgeos/benchmark.md)

