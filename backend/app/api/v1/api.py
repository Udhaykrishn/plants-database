from fastapi import APIRouter
from app.api.v1.endpoints import taxonomy, plants, projects, io

api_router = APIRouter()
api_router.include_router(taxonomy.router, prefix="/taxonomy", tags=["taxonomy"])
api_router.include_router(plants.router, prefix="/plants", tags=["plants"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(io.router, tags=["io"])
