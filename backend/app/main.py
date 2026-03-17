import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routes import media, playlists, screens, licenses, auth, webhooks, schedules, audit
from .auth import get_current_user


REQUIRED_ENV_VARS = [
    "DATABASE_URL",
    "JWT_SECRET_KEY",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "CORS_ALLOWED_ORIGINS",
    "B2_ENDPOINT",
    "B2_KEY_ID",
    "B2_APPLICATION_KEY",
    "B2_BUCKET_NAME",
]
def create_app() -> FastAPI:
    # Startup validation
    if os.getenv("RENDER"): # Only enforce on Render
        missing = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
        
        if missing:
            raise RuntimeError(
                f"ScreenFlow cannot start. Missing required environment variables: "
                f"{', '.join(missing)}"
            )

    app = FastAPI(title="ScreenFlow Dashboard API")

    # Configure B2 CORS on startup
    from .services.storage import configure_bucket_cors
    configure_bucket_cors()

    # CORS configuration
    cors_allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
    if not cors_allowed_origins:
        raise ValueError("CORS_ALLOWED_ORIGINS must be set. Example: http://10.0.0.50:3000")
    
    origins = [origin.strip().rstrip("/") for origin in cors_allowed_origins.split(",") if origin.strip()]

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Create tables if they don't exist (Alembic should be used in real deployments)
    Base.metadata.create_all(bind=engine)

    # Routers
    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    
    # Signage routers (Public)
    app.include_router(screens.public_router, prefix="/screens", tags=["screens-public"])

    # Management routers (Protected)
    app.include_router(media.router, prefix="/media", tags=["media"], dependencies=[Depends(get_current_user)])
    app.include_router(playlists.router, prefix="/playlists", tags=["playlists"], dependencies=[Depends(get_current_user)])
    app.include_router(screens.router, prefix="/screens", tags=["screens"], dependencies=[Depends(get_current_user)])
    app.include_router(licenses.router, prefix="/licenses", tags=["licenses"], dependencies=[Depends(get_current_user)])
    app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"], dependencies=[Depends(get_current_user)])
    app.include_router(schedules.router, prefix="/schedules", tags=["schedules"], dependencies=[Depends(get_current_user)])
    app.include_router(audit.router, prefix="/audit", tags=["audit"], dependencies=[Depends(get_current_user)])

    @app.api_route("/health", methods=["GET", "HEAD"])
    def health_check():
        return {"status": "ok"}

    return app


app = create_app()

