from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

# Add parent directory to path to import load_env
sys.path.append(str(Path(__file__).resolve().parent.parent))
from load_env import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Verify SECRET_KEY is loaded
secret_key = os.environ.get('SECRET_KEY')
if not secret_key:
    raise RuntimeError(
        "SECRET_KEY environment variable is not set. "
        "Please run 'python generate_secret_key.py' to generate a key."
    )

from app.auth.routes import router as auth_router
from app.reports.routes import router as reports_router
from app.scans.routes import router as scans_router
from app.db.database import DATABASE_URL, engine
from app.auth import models
from app.reports import models as reports_models
from app.scans import models as scans_models

# Rely on Alembic migrations for schema management; do not auto-create tables

app = FastAPI(
    title="Authentication API",
    description="FastAPI Authentication Backend for React Frontend",
    version="1.0.0"
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _database_engine_name() -> str:
    if not DATABASE_URL:
        return "unknown"
    if "://" not in DATABASE_URL:
        return "unknown"
    return DATABASE_URL.split("://", 1)[0]


def _run_database_check() -> dict:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {
            "ok": True,
            "engine": _database_engine_name(),
            "message": "Database connection established",
        }
    except SQLAlchemyError as exc:
        return {
            "ok": False,
            "engine": _database_engine_name(),
            "message": f"Database check failed: {exc.__class__.__name__}",
            "error": str(exc),
        }


def _fail_on_db_unavailable() -> bool:
    value = os.getenv("FAIL_ON_DB_UNAVAILABLE", "0").strip().lower()
    return value in {"1", "true", "yes", "on"}


@app.on_event("startup")
async def run_startup_checks() -> None:
    database_check = _run_database_check()
    app.state.startup_checks = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "database": database_check,
    }

    if not database_check["ok"] and _fail_on_db_unavailable():
        raise RuntimeError("Startup database check failed")

# Security middleware
# app.add_middleware(
#     TrustedHostMiddleware, 
#     allowed_hosts=["localhost", "127.0.0.1", "*.localhost"]
# )

# # Configure CORS
# origins = [
#     "http://localhost:3000",  # React frontend default port
#     "http://localhost:5173",  # Vite default port
#     "http://127.0.0.1:3000",
#     "http://127.0.0.1:5173",
#     "http://192.168.8.3:3000",
# ]

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=True,
#     allow_methods=["GET", "POST", "PUT", "DELETE"],
#     allow_headers=["Authorization", "Content-Type"],
# )

# Include routers
app.include_router(auth_router)
app.include_router(reports_router)
app.include_router(scans_router)

@app.get("/")
async def root():
    return {"message": "Welcome to the Authentication API"}


@app.get("/health")
async def health():
    startup_checks = getattr(app.state, "startup_checks", {}) or {}
    database_status = startup_checks.get("database")

    if not database_status:
        database_status = _run_database_check()
        startup_checks = {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "database": database_status,
        }
        app.state.startup_checks = startup_checks

    status = "ok" if database_status.get("ok") else "degraded"

    return {
        "status": status,
        "service": "security-dashboard-backend",
        "version": "1.0.0",
        "checked_at": startup_checks.get("checked_at"),
        "database": database_status,
    }