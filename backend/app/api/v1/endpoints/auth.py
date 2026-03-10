from fastapi import APIRouter, Depends, HTTPException, status
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, Token

router = APIRouter()

@router.post("/login", response_model=Token)
def login(login_data: LoginRequest):
    if login_data.username == settings.ADMIN_USERNAME and login_data.password == settings.ADMIN_PASSWORD:
        access_token = create_access_token(subject=login_data.username)
        return {"access_token": access_token, "token_type": "bearer"}
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

@router.get("/me")
def get_me():
    # This can be used to verify token on client side
    return {"username": settings.ADMIN_USERNAME}
