"""Measure real API/DB latency without browser/network rendering costs.

Run from backend: .venv/bin/python scripts/performance_audit.py --output report.json
Add --mutations to benchmark writes in a disposable UUID-scoped project. Only
that project's rows are cleaned up. Credentials and SQL parameters are not logged.
The first iteration includes connection/statement preparation; compare warm runs.
"""
import argparse
import asyncio
import json
import logging
import os
from pathlib import Path
import sys
from time import perf_counter
import uuid

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

import httpx
from sqlalchemy import delete, event, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import engine, get_db, AsyncSessionLocal
from app.main import app
from app.models.plant import Plant
from app.models.project import Project, ProjectPlant


async def audit(output, iterations, mutations):
    engine.echo = False
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    current = {}

    @event.listens_for(engine.sync_engine, 'before_cursor_execute')
    def before(conn, cursor, statement, parameters, context, many):
        context.audit_start = perf_counter()

    @event.listens_for(engine.sync_engine, 'after_cursor_execute')
    def after(conn, cursor, statement, parameters, context, many):
        current.setdefault('queries', []).append({
            'sql': statement, 'driver_ms': (perf_counter() - context.audit_start) * 1000,
        })

    class TimedSession(AsyncSession):
        async def execute(self, *args, **kwargs):
            start = perf_counter()
            try:
                return await super().execute(*args, **kwargs)
            finally:
                current.setdefault('execute_ms', []).append((perf_counter() - start) * 1000)

        async def commit(self):
            start = perf_counter()
            try:
                return await super().commit()
            finally:
                current['commit_ms'] = (perf_counter() - start) * 1000

        async def close(self):
            start = perf_counter()
            try:
                return await super().close()
            finally:
                current['session_close_ms'] = (perf_counter() - start) * 1000

    async def timed_db():
        async with TimedSession(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_db] = timed_db
    samples = []
    fixture_id = uuid.uuid4()
    try:
        plant_ids = []
        if mutations:
            async with AsyncSessionLocal() as db:
                plant_ids = list((await db.execute(select(Plant.id).limit(iterations))).scalars())
                db.add(Project(id=fixture_id, name='Disposable performance benchmark'))
                await db.commit()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url='http://audit',
            headers={'Authorization': 'Bearer ' + create_access_token(settings.ADMIN_USERNAME)},
        ) as client:
            for run in range(iterations):
                operations = [(path, None) for path in [
                    '/api/v1/plants/?limit=20', '/api/v1/projects/?limit=12',
                    '/api/v1/dashboard/stats', '/api/v1/categories/', '/api/v1/taxonomy/tree',
                ]]
                if mutations and run < len(plant_ids):
                    operations.append((f'/api/v1/projects/{fixture_id}/plants',
                                       {'plant_id': str(plant_ids[run]), 'notes': 'audit'}))
                for path, payload in operations:
                    current.clear()
                    start = perf_counter()
                    response = await (client.post(path, json=payload) if payload else client.get(path))
                    sample = {key: value.copy() if isinstance(value, list) else value
                              for key, value in current.items()}
                    sample.update(run=run, path=path, status=response.status_code,
                                  total_ms=(perf_counter()-start)*1000, bytes=len(response.content))
                    samples.append(sample)
                    print(f'{response.status_code} {path}: {sample["total_ms"]:.1f} ms', flush=True)
                    response.raise_for_status()
    finally:
        app.dependency_overrides.pop(get_db, None)
        if mutations:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(ProjectPlant).where(ProjectPlant.project_id == fixture_id))
                await db.execute(delete(Project).where(Project.id == fixture_id))
                await db.commit()
        event.remove(engine.sync_engine, 'before_cursor_execute', before)
        event.remove(engine.sync_engine, 'after_cursor_execute', after)
        await engine.dispose()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'samples': samples}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--iterations', type=int, default=3)
    parser.add_argument('--mutations', action='store_true')
    args = parser.parse_args()
    if args.iterations < 1:
        parser.error('--iterations must be positive')
    asyncio.run(audit(args.output.resolve(), args.iterations, args.mutations))
