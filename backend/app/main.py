from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routes import media, playlists, screens, licenses


def create_app() -> FastAPI:
    app = FastAPI(title="Screen Flow Dashboard API")

    # CORS for local network usage
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Create tables if they don't exist (Alembic should be used in real deployments)
    Base.metadata.create_all(bind=engine)

    # Routers
    app.include_router(media.router, prefix="/media", tags=["media"])
    app.include_router(playlists.router, prefix="/playlists", tags=["playlists"])
    app.include_router(screens.router, prefix="/screens", tags=["screens"])
    app.include_router(licenses.router, prefix="/licenses", tags=["licenses"])

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()

