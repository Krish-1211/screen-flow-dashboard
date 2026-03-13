import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


DB_USER = os.getenv("POSTGRES_USER", "screenflow")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "screenflow")
DB_HOST = os.getenv("POSTGRES_HOST", "db")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "screenflow")

SQLALCHEMY_DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

engine = create_engine(SQLALCHEMY_DATABASE_URL, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    from sqlalchemy.orm import Session

    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

