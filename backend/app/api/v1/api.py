from fastapi import APIRouter, Depends
from app.api.v1.endpoints import taxonomy, plants, projects, io, categories, ai, auth
from app.core.security import get_current_user

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(taxonomy.router, prefix="/taxonomy", tags=["taxonomy"], dependencies=[Depends(get_current_user)])
api_router.include_router(plants.router, prefix="/plants", tags=["plants"], dependencies=[Depends(get_current_user)])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"], dependencies=[Depends(get_current_user)])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_user)])
api_router.include_router(io.router, tags=["io"], dependencies=[Depends(get_current_user)])
