"""Opt-in integration check: RUN_DB_PERFORMANCE_TESTS=1 python -m pytest tests/test_performance_contract.py.

Uses the configured database, creates one UUID-scoped project, and removes only
that project's rows in finally. Never edits existing plants or projects.
"""
import asyncio
import os
import uuid

import httpx
import pytest
from sqlalchemy import delete, func, select

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal, engine
from app.main import app
from app.models.plant import Plant
from app.models.project import Project, ProjectPlant

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_DB_PERFORMANCE_TESTS") != "1", reason="Explicit database integration opt-in required"
)


@pytest.mark.asyncio
async def test_mutation_and_list_contract():
    engine.echo = False
    project_id = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        plant_id = (await db.execute(select(Plant.id).limit(1))).scalar_one()
        db.add(Project(id=project_id, name="Performance integration test"))
        await db.commit()
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test",
            headers={"Authorization": "Bearer " + create_access_token(settings.ADMIN_USERNAME)},
        ) as client:
            path = f"/api/v1/projects/{project_id}/plants"
            payload = {"plant_id": str(plant_id), "notes": "test", "quantity": 3,
                       "unit": "nos", "rate": 12.5, "optimum_height_size": "1m"}
            response = await client.post(path, json=payload)
            assert response.status_code == 200, response.text
            assert response.json() == {"project_id": str(project_id), **payload}
            # Existing rows are updated, including explicitly cleared fields.
            response = await client.post(path, json={"plant_id": str(plant_id)})
            assert response.status_code == 200
            assert response.json()["quantity"] is None
            assert response.json()["notes"] is None
            # Concurrent duplicate adds must be atomic and leave one association.
            results = await asyncio.gather(*(client.post(path, json=payload) for _ in range(3)))
            assert all(r.status_code == 200 for r in results)
            async with AsyncSessionLocal() as db:
                count = (await db.execute(select(func.count()).select_from(ProjectPlant).where(
                    ProjectPlant.project_id == project_id))).scalar_one()
                assert count == 1
            missing = await client.post(path, json={"plant_id": str(uuid.uuid4())})
            assert missing.status_code == 404 and missing.json()["detail"] == "Plant not found"
            missing = await client.post(f"/api/v1/projects/{uuid.uuid4()}/plants", json=payload)
            assert missing.status_code == 404 and missing.json()["detail"] == "Project not found"
            anonymous = await client.post(path, json=payload, headers={"Authorization": "Bearer invalid"})
            assert anonymous.status_code == 401
            plants = (await client.get('/api/v1/plants/', params={"limit": 2})).json()
            assert len(plants['items']) <= 2
            assert 'care_data' not in plants['items'][0]
            assert 'taxon_name' in plants['items'][0]
            empty = (await client.get('/api/v1/plants/', params={"skip": plants['total'] + 1})).json()
            assert empty['items'] == [] and empty['total'] == plants['total']
            filtered = (await client.get('/api/v1/plants/', params={"search": "impossible-" + str(uuid.uuid4())})).json()
            assert filtered == {"items": [], "total": 0}
            stats = (await client.get('/api/v1/dashboard/stats')).json()
            assert stats['total_plants'] == plants['total']
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(ProjectPlant).where(ProjectPlant.project_id == project_id))
            await db.execute(delete(Project).where(Project.id == project_id))
            await db.commit()
        await engine.dispose()
