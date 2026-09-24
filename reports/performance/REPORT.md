# Frontend and backend performance investigation

Measured September 24, 2026, against the running frontend at `http://localhost:5173`, local FastAPI backend at `http://localhost:8000`, and its configured Neon database. Baseline commit: `cf9d192`. Changes are local, not deployed or committed.

**The main cause is many sequential round trips over a roughly 265–275 ms database network path, compounded by connection health checks and transaction boundaries. It is not multi-second SQL execution or primarily React rendering.** The reported add-to-project problem was reproduced at **5,809 ms**. Warm inserts improved from **4,456 ms to 1,932 ms (57%)**. The 500 ms target is **not achieved** with this connection topology.

## Measurement method and limits

- Read the actual routes, components, query keys, ORM models, migrations, driver implementation, live catalog, constraints, and query plans.
- Instrumented SQLAlchemy cursor execution and exercised the complete FastAPI ASGI app against the real database, including authentication, validation, response serialization, commit and session cleanup. These timings exclude browser rendering and local HTTP transport. SQL cursor durations include network/driver time; they are **not PostgreSQL executor time**.
- Separately measured connection checkout, repeated `SELECT 1`, transaction cleanup, live HTTP, and browser CDP request timings. The retained benchmark records execute, commit, session-close, SQL, response-size and total timings without logging credentials or parameter values.
- Three baseline/after iterations for the main endpoints. The comparison below uses the last two warm reads/new inserts; existing-association updates use three repetitions. Small samples are diagnostic, **not p95/SLA evidence**. First-run connection/statement preparation is reported separately.
- Existing data: 240 plants, 6 projects, 217 associations, 627 taxons, 11 categories. A disposable project was present in after measurements, adding one project summary. No existing plants/projects were edited. Test fixtures were removed; see `cleanup.json`.
- Browser measurements use Vite development mode and React Strict Mode. Reloads during backend edits produced cold/connection outliers of 8–10 seconds; those are retained, not presented as warm improvements. CPU metrics are page-wide, not a React component profiler trace.
- Scale testing used a transaction-scoped 100,000-row synthetic temporary table. It tests SQL/index behavior, not full production load, concurrent users, or large project exports.

## 1. Add an existing plant to a project

**Classification:** Backend / Network.

**Issue:** Several seconds elapse before an association mutation completes.

**Location:** `PlantManager.tsx` → `projectsApi.addPlant()` → `POST /api/v1/projects/{project_id}/plants` → `add_plant_to_project()` in `backend/app/api/v1/endpoints/projects.py` → SQLAlchemy `AsyncSession` / asyncpg. There is no separate controller/service/repository layer in this path.

**Current performance:** First measured insert **5,809 ms**; warm inserts **4,396–4,515 ms**; repeated existing-association requests **4,111–4,123 ms**. Response body: 198 bytes in the benchmark.

**Root cause:** Previously the endpoint loaded a complete project, a complete plant including care data, and the association; issued project UPDATE and association INSERT; committed; then refreshed the association. The refresh starts another transaction and checks out a connection again. Six SQL statements for a new association, five for an unchanged existing association; additional BEGIN/COMMIT/ROLLBACK/pre-ping traffic is not counted as those six SQL statements. This is fixed sequential overhead, not an N+1 over the project’s plant count.

**Evidence:** In the warm baseline insert, individual SQL cursor calls took 274–549 ms. On first statement preparation some took 546–820 ms. Independent `SELECT 1` round trips took about 265 ms while its PostgreSQL EXPLAIN execution took **0.021 ms**. The endpoint does not reload the full project after mutation in this checkout, and the browser confirmed no follow-up GETs.

**Fix applied:** Check both IDs in one SELECT of EXISTS predicates, preserving the specific 404 responses. Use the existing association composite primary key for `INSERT ... ON CONFLICT DO UPDATE`, attach the project timestamp UPDATE as a data-modifying CTE, and return the stored association using RETURNING. Commit once; no post-commit refresh. Two SQL statements. Concurrent duplicate adds are now atomic rather than select-then-insert races. No schema change was required. SQLAlchemy documents these supported operations in its [PostgreSQL dialect reference](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#insert-on-conflict-upsert).

**Performance after fix:** Warm new associations **1,923–1,941 ms**, median **1,932 ms**, **57% faster**. Existing associations median **1,922 ms**, **53% faster**. First-run insert was **2,877 ms**, compared with 5,809 ms before.

A separate warm instrumented request after the fix:

| Stage | Time |
|---|---:|
| First execute: connection checkout/pre-ping and ORM overhead, excluding cursor interval | 795 ms |
| ID validation cursor interval, including transaction start/network | 530 ms |
| Association upsert + project timestamp CTE cursor interval | 267 ms |
| Commit | 269 ms |
| Session close | <1 ms |
| Remaining request/auth/validation/serialization/dispatch overhead | ~5 ms |
| **Total ASGI request** | **1,866 ms** |

These are measured wall times, not claims that validation itself needs 530 ms of CPU. The stage residual combines authentication, parsing, serialization and other dispatch work; those were not individually instrumented.

Browser test from Plants → select plant → disposable project → Add Plants:

| Browser stage | Time |
|---|---:|
| Click → request initiation | 3.4 ms |
| Request initiation → body finished, including preflight | 2,809 ms |
| POST TTFB | 2,771 ms |
| Body finished → success message DOM update | 219 ms |
| **Click → success DOM update** | **3,032 ms** |

One POST, one CORS OPTIONS request, zero follow-up data GETs. The success message and project’s new plant were verified. DOM update timing is not a paint timestamp. Browser and ASGI samples are separate runs; subtracting them to infer exact network overhead would be invalid.

## 2. Connection and network overhead affects every page

**Classification:** Network / Architecture / Backend.

**Location:** `backend/app/db/session.py`, configured Neon endpoint in AWS `us-east-2`, installed SQLAlchemy 2.0.27 asyncpg dialect.

**Current performance / evidence:** Warm checkout took **796–1,058 ms**; an initial connection checkout took **6,156 ms**. Subsequent SELECT 1 calls took **264–267 ms**; transaction-close rollback took **264–265 ms**. The installed `_async_ping()` implementation explicitly starts a transaction, sends a ping, and rolls back: three remote round trips. The first application query also starts a transaction. Pool size is 5 with 10 overflow slots and 300-second recycling; connections are pooled, not deliberately recreated for every request.

**Root cause:** A high-latency database path amplifies connection health checks, statement preparation, SQL sequencing and transaction cleanup. Cold connection establishment is a separate cost. These measurements do not prove a Neon scale-to-zero wakeup; no compute-control-plane evidence was collected.

**Fix:** The implemented fixes reduce application round trips. Keep pre-ping and transactional correctness. The main remaining infrastructure improvement is to run the backend near the database and measure from that host, or choose a nearby database region through a separately planned migration. Review pool recycling and prepared-statement behavior after deployment topology is known.

**Performance after fix:** Network RTT itself is unchanged. Even the one-statement dashboard still takes about **1.58 seconds**. A reliable sub-500 ms target is not realistic with the current observed transaction and checkout overhead. No infrastructure/region changes were made.

## 3. Plants list selects unnecessary data

**Classification:** Backend / Database.

**Location:** `read_plants()` in `backend/app/api/v1/endpoints/plants.py`; `GET /api/v1/plants/`.

**Current performance:** Warm median **2,137 ms**, three SQL statements, 10,046-byte response for 20 plants.

**Root cause:** Although the response was already slim, the ORM selected every Plant column (including description, diseases and care JSON) and then all related Taxon columns in a separate SELECT. Those fields were discarded while building the list DTO.

**Evidence:** `before.json` contains the exact SQL. The response was already paginated; this was not a thousands-of-plants response. The representative recent-page EXPLAIN took **0.176 ms** on 240 rows, making network/query count more important today than sorting.

**Fix applied:** Select only list DTO columns and outer-join the optional taxon name in the same statement. Retain the separate filtered count, sorting, pagination, null taxons and existing response contract.

**Performance after fix:** **1,848 ms**, two SQL statements, **14% faster**. Response remains 10,046 bytes: savings are between database and backend, plus one fewer round trip. Exact JSON parity passed for default paging, alphabetical sort, search and an empty out-of-range page.

## 4. Detail endpoints load to-one relationships sequentially

**Classification:** Backend / Database.

**Location:** `read_project()` and public project lookup in `projects.py`; `read_plant()` in `plants.py`.

**Current performance:** Project detail with four plants: **2,343 ms**, four SQL statements. Plant detail: **1,866 ms**, two SQL statements.

**Root cause:** Chained select-in loading performs separate project, association, plant and taxon SELECTs. This is batched relationship loading, not one query per plant; nevertheless, four remote round trips are expensive here.

**Fix applied:** Keep select-in loading for the project’s collection, join its to-one plant and taxon relationships in the collection query, and join the plant detail’s taxon. Optional relationships remain outer joins.

**Performance after fix:** Project detail **1,835 ms**, two statements (**22% faster**); plant detail **1,569 ms**, one statement (**16% faster**). Full response parity with the baseline functions passed. Project-detail collections still load in full; large-project pagination remains outstanding. Public lookup uses the same loader change but was not exercised with a public share token.

## 5. Dashboard counts and category count

**Classification:** Backend / Database.

**Location:** `dashboard.py:get_dashboard_stats()` and `categories.py:read_categories()`.

**Current performance:** Dashboard **2,451 ms**, four sequential count statements. Categories **1,872 ms**, two statements.

**Root cause:** Independent dashboard aggregates run sequentially. The categories total also joins and groups plants even though only the number of filtered categories is needed.

**Fix applied:** Combine dashboard aggregates as independent scalar subqueries in one SQL statement. Count categories directly with the same search predicates, retaining the list’s plant-count aggregate.

**Performance after fix:** Dashboard **1,584 ms**, **35% faster**, unchanged 88-byte response. Categories **1,855 ms**, unchanged 1,277-byte response. The categories difference is within run-to-run noise; no material current-data latency gain is claimed. It avoids unnecessary work as the plant table grows.

## 6. Duplicate project and share-link requests

**Classification:** Frontend.

**Location:** `frontend/src/api/queryOptions.ts`, project detail route loader, and `frontend/src/components/projects/ProjectDetails.tsx`.

**Current behavior:** Project loader used `['projects', 'detail', id]`, while the component and mutation cache updates used `['project', id]`. Identical URLs could therefore have separate query-cache entries. Separately, an imperative mount effect fetched the share link twice under Strict Mode.

**Evidence:** The key mismatch was found in source. CDP directly recorded **two share-link GETs**, with TTFBs of **2,309 ms and 4,014 ms**. Existing client defaults already cache data for five minutes. Adding a plant already patches caches without a full list refetch; that prior optimization was preserved.

**Fix applied:** Align the route’s project-detail key with the component/mutations. Replace the share-link effect with a project-specific React Query query; update its cache when generating a link. Keep Strict Mode enabled.

**Performance after fix:** CDP recorded **one project-detail GET and one share-link GET** on reload. This is a verified request-count reduction, not a controlled page-latency comparison: cold reloads still varied considerably. The main detail key’s before count is source-derived, not a captured before browser trace.

## 7. Live schema differs materially from the models

**Classification:** Database.

**Location:** Live `plants`, `projects`, `taxons`, `categories`, `projectplants`; corresponding ORM models and Alembic migrations.

**Issue / evidence:** Catalog inspection found only `projectplants_pkey(project_id, plant_id)` among these tables. Plant/project/taxon/category primary keys, declared secondary indexes and foreign keys are absent from the live catalog. There are no application-table triggers. Checks found no duplicate/null IDs in plants/projects/taxons and no orphan project associations or plant→taxon references in the checked data. This is not a complete migration-readiness audit of every uniqueness/FK rule.

The live association `quantity` is **integer**, although the model/schema declare float; a test value of 3.5 came back as 4. The live rate is numeric. This existing mismatch is recorded in `parity.json`; it was not silently changed.

**Current performance:** Representative current-data plans: plants recent page **0.176 ms**, project summaries with correlated counts **0.183 ms**. Small sequential scans are not the cause of seconds of delay. The composite association primary key already supports the add/upsert conflict lookup; an extra index on that same key would be redundant.

**Fix recommended, not applied:** Reconcile migration history and the live DDL on a database branch. Restore IDs/uniqueness, FKs, and appropriate indexes after checking duplicates, nulls, orphans and locking behavior. Candidate indexes include plant/project sort keys with an ID tie-breaker, taxon and category lookup/filter columns, and a reverse `projectplants(plant_id)` index for plant-side operations. Validate each against representative workload plans. Resolve quantity semantics explicitly.

**Scale evidence:** Temporary synthetic 100,000-row table:

| Query | Without candidate index | With index |
|---|---:|---:|
| ID lookup | 55.131 ms | 0.040 ms |
| First recent page (20 rows) | 64.053 ms | 0.094 ms |
| Offset 90,000 | 83.847 ms | 124.364 ms |
| `%abc%` contains search | 3.692 ms | 3.848 ms |

The last two rows illustrate that an index is not a universal fix. Deep offsets still walk many entries; use cursor pagination when justified. The tested contains search had early matches and a small LIMIT, so it is not a worst-case search benchmark. No real schema/index migration was applied. Temporary objects were rolled back.

## 8. Remaining scale and initial-load risks

**Classification:** Frontend / Backend / Database / Architecture.

- Main Plants UI requests 20 items, Projects UI 12, project plant picker 50. Backend defaults are 100, but limits are not bounded/validated at the API boundary. Arbitrarily large requested limits remain a risk.
- The project selector requests only the first default 100 projects; switch it to server-side search/paging before that scale. Bulk add/update sends one request per selected plant using unbounded `Promise.all`; large selections can contend for the pool and project timestamp row. Add a bounded/batch mutation API after measuring representative bulk sizes.
- Project detail loads all associations/full plant records although its table shows ten rows. PDF/BOQ exports need complete data, so separate paged display data from full export retrieval rather than truncating the existing endpoint.
- Taxonomy tree loads all 627 nodes, returns **157,968 bytes**, and builds/validates the hierarchy in Python. Warm samples were **1.70 seconds before / 2.11 seconds after** without a tree-code change; a separate stage run returned 1.69 seconds. This is variability, not an improvement claim. Tree loading was already lazy on catalog browse. Use branch loading or a versioned cache if taxonomy grows substantially.
- Ordinary substring ILIKE filters and exact COUNT totals still scan without suitable indexes. Prioritize representative selectivity tests before trigram extensions, composite indexes or cursor API changes.
- Fresh Vite page CPU observed: **1,101 ms script**, **29 ms layout**, **28 ms style**. The production build has a **1.54 MB main chunk (446 KB gzip)** and **1.57 MB PDF chunk (526 KB gzip)**. Initial module work is a secondary frontend concern; these figures do not account for the 265 ms DB round-trip floor. Consider route/code splitting based on a production bundle trace.
- An additional cache correctness issue remains: adding an already-associated plant from the catalog can increment the summary count when project detail is not cached, because the slim response does not say whether insertion occurred. This does not cause the measured API latency; use an explicit mutation result flag or a targeted background reconciliation in follow-up work.

## Verification and reproducibility

- Production frontend build passes after the final frontend changes. Existing large-chunk/Browserslist warnings remain.
- Backend compile check passes.
- Opt-in database integration test passes: insertion/update/null fields, concurrent same-key adds leaving one association, missing IDs, authentication, pagination, empty results and dashboard total. Initial fractional-quantity test exposed live schema drift; the contract test uses a whole-number quantity supported by the current database.
- Six baseline/current response-parity checks pass, including full plant/project detail JSON and four list variants.
- Browser add from the Plants section succeeds, no mutation refetch waterfall, project contents verified. Both cache-related request counts checked with CDP.
- SQL query timing hooks are confined to the standalone benchmark. Browser observer was removed by cleanup/reload. No application debug middleware or credential logging was added.
- Test rows cleaned up; original table counts verified in `cleanup.json`. No schema changes, region migration, deployment or commit performed.

Re-run from `backend/`:

```bash
.venv/bin/python scripts/performance_audit.py --output ../reports/performance/recheck.json
# Explicitly includes disposable-project mutation measurements and cleanup:
.venv/bin/python scripts/performance_audit.py --output ../reports/performance/recheck-writes.json --mutations
RUN_DB_PERFORMANCE_TESTS=1 .venv/bin/python -m pytest tests/test_performance_contract.py -q
```

Evidence: `before.json`, `after.json`, `mutation-before.json`, `mutation-after.json`, `details-before.json`, `details-after.json`, `stages-after.json`, `connection.json`, `schema.json`, `scale.json`, `browser.json`, `http-after.json`, `parity.json`, `cleanup.json`, `summary.json` in this folder. SQL parameters and credentials are omitted.

## Summary

Warm ASGI medians; browser rendering/HTTP overhead excluded. Small-sample unchanged paths are reported honestly.

| Operation/Page | Before | After | Main bottleneck | Fix |
|---|---:|---:|---|---|
| Add plant, new association | 4.456 s | 1.932 s | 6 statements + post-commit checkout | 2 statements, atomic upsert/RETURNING |
| Add plant, existing association | 4.114 s | 1.922 s | Sequential lookups + refresh | Same mutation fix |
| Plants page API | 2.137 s | 1.848 s | Full records + separate taxon fetch | Project only list columns, join taxon |
| Projects page API | 1.869 s | 1.861 s | Network/pool overhead | No backend list change; no material gain |
| Dashboard | 2.451 s | 1.584 s | Four count round trips | One statement |
| Project detail, four plants | 2.343 s | 1.835 s | Four relationship queries | Two queries |
| Plant detail | 1.866 s | 1.569 s | Separate taxon query | One joined query |
| Categories | 1.872 s | 1.855 s | Network + unnecessary count join | Simplified count; gain within noise |
| Taxonomy tree | 1.701 s | 2.106 s | Network + full tree | Unchanged; variable, not improved |
| Share-link fetch on mount | 2 GETs | 1 GET | Strict Mode imperative effect | Query deduplication |

Prioritized remaining work:

1. **Latency:** co-locate backend/database and re-run this benchmark before promising <500 ms. Measure cold and warm pool behavior separately.
2. **Integrity and scale:** reconcile the live schema/migrations, including missing keys/FKs/indexes and integer quantity mismatch, on a branch first.
3. **Bulk operations:** batch association writes or bound concurrency; preserve atomicity/error reporting and avoid project-row contention.
4. **Large lists/projects:** bound API limits, add project-selector search, separate project pagination from exports, evaluate keyset pagination and search indexes.
5. **Cache correctness:** distinguish insert from update in mutation outcomes or reconcile summary counts selectively.
6. **Frontend startup and taxonomy:** profile production chunks, split large routes/export dependencies, and introduce measured tree caching/lazy expansion as needed.
