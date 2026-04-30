from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import auth, lots, vision, voice, admin
from .utils.logging import setup_logging

app = FastAPI(title=settings.PROJECT_NAME)

# Setup logging
setup_logging()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(lots.router)
app.include_router(vision.router)
app.include_router(voice.router)
app.include_router(admin.router)

@app.get("/")
def read_root():
    return {"message": f"{settings.PROJECT_NAME} API is online!"}
