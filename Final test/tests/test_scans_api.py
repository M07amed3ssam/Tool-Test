from __future__ import annotations

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-key-with-32-characters-min")
os.environ["DATABASE_URL"] = "sqlite:///./test_scans_api.db"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.auth.models import User, UserRole
from app.auth.utils import get_current_user
from app.db.database import Base, get_db
from app.main import app
from app.scans.models import ScanJob, ScanStatus
from app.scans.runner import scan_execution_manager


_CURRENT_USER = {"user": None}
_TEST_DB_URL = "sqlite:///./test_scans_api.db"
_TEST_ENGINE = create_engine(_TEST_DB_URL, connect_args={"check_same_thread": False})
_TEST_SESSION = sessionmaker(autocommit=False, autoflush=False, bind=_TEST_ENGINE)


class _UserContext:
    def __init__(self, user_id: int, role: UserRole) -> None:
        self.id = user_id
        self.role = role


def override_get_current_user():
    return _CURRENT_USER["user"]


def override_get_db():
    db = _TEST_SESSION()
    try:
        yield db
    finally:
        db.close()


class TestScansApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        Base.metadata.create_all(bind=_TEST_ENGINE)
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=_TEST_ENGINE)

    def setUp(self) -> None:
        db = _TEST_SESSION()
        db.query(ScanJob).delete()
        db.query(User).delete()

        user = User(
            id=1,
            username="user1",
            email="user1@example.com",
            password_hash="hashed",
            role=UserRole.USER,
        )
        admin = User(
            id=2,
            username="admin",
            email="admin@example.com",
            password_hash="hashed",
            role=UserRole.ADMIN,
        )

        db.add(user)
        db.add(admin)
        db.commit()

        self.user = _UserContext(1, UserRole.USER)
        self.admin = _UserContext(2, UserRole.ADMIN)
        db.close()

    def test_create_scan_requires_authorization_ack(self) -> None:
        _CURRENT_USER["user"] = self.user

        payload = {
            "scan_name": "test-scan",
            "target": "example.com",
            "scan_profile": "standard",
            "planner_engine": "rules",
            "orchestration_mode": "sequential",
            "authorization_ack": False,
        }

        with patch.object(scan_execution_manager, "start_job", return_value=True):
            response = self.client.post("/scans", json=payload)

        self.assertEqual(response.status_code, 400)

    def test_list_scans_is_owner_scoped_for_non_admin(self) -> None:
        db = _TEST_SESSION()
        db.add(
            ScanJob(
                user_id=1,
                scan_name="scan-user",
                target="example.com",
                target_type="domain",
                scan_profile="standard",
                planner_engine="rules",
                orchestration_mode="sequential",
                max_parallel=1,
                retries=2,
                backoff=2,
                timeout=900,
                max_steps=0,
                only_tools=[],
                authorization_ack=True,
                status=ScanStatus.QUEUED,
                progress=0,
            )
        )
        db.add(
            ScanJob(
                user_id=2,
                scan_name="scan-admin",
                target="admin.example.com",
                target_type="domain",
                scan_profile="standard",
                planner_engine="rules",
                orchestration_mode="sequential",
                max_parallel=1,
                retries=2,
                backoff=2,
                timeout=900,
                max_steps=0,
                only_tools=[],
                authorization_ack=True,
                status=ScanStatus.QUEUED,
                progress=0,
            )
        )
        db.commit()
        db.close()

        _CURRENT_USER["user"] = self.user
        user_response = self.client.get("/scans")
        self.assertEqual(user_response.status_code, 200)
        self.assertEqual(len(user_response.json()["items"]), 1)
        self.assertEqual(user_response.json()["items"][0]["user_id"], 1)

        _CURRENT_USER["user"] = self.admin
        admin_response = self.client.get("/scans?include_all=true")
        self.assertEqual(admin_response.status_code, 200)
        self.assertEqual(len(admin_response.json()["items"]), 2)

    def test_cancel_scan_marks_job_cancelling(self) -> None:
        db = _TEST_SESSION()
        scan_job = ScanJob(
            user_id=1,
            scan_name="running-scan",
            target="example.com",
            target_type="domain",
            scan_profile="standard",
            planner_engine="rules",
            orchestration_mode="sequential",
            max_parallel=1,
            retries=2,
            backoff=2,
            timeout=900,
            max_steps=0,
            only_tools=[],
            authorization_ack=True,
            status=ScanStatus.RUNNING,
            progress=20,
        )
        db.add(scan_job)
        db.commit()
        db.refresh(scan_job)
        scan_id = scan_job.id
        db.close()

        _CURRENT_USER["user"] = self.user
        with patch.object(scan_execution_manager, "cancel_job", return_value=None):
            response = self.client.post(f"/scans/{scan_id}/cancel")

        self.assertEqual(response.status_code, 200)

        db = _TEST_SESSION()
        refreshed = db.query(ScanJob).filter(ScanJob.id == scan_id).first()
        self.assertEqual(refreshed.status, ScanStatus.CANCELLING)
        db.close()


if __name__ == "__main__":
    unittest.main()
