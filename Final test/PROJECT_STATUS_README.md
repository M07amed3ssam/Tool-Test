# Project Status README

Date: 2026-04-19

## 1) Current Status Snapshot

This project has two main parts:
- FastAPI backend in app/
- React dashboard frontend in security-dashboard/

Current runtime status (verified):
- Frontend: http://127.0.0.1:3000 -> HTTP 200
- Backend: http://127.0.0.1:8000/openapi.json -> HTTP 200
- Login API: POST /auth/login -> HTTP 200 with valid credentials
- Auth check API: GET /auth/me -> HTTP 200 with bearer token

Default seeded admin account (if seeded in DB):
- Email: admin@example.com
- Password: admin123

## 2) Code and Dashboard Structure

Backend modules:
- app/main.py: app startup, CORS, router mounting
- app/auth/: authentication, users, roles, password update
- app/scans/: scan jobs, logs, findings, artifacts, retry/cancel
- app/reports/: report listing, final report view, full data download

Frontend modules:
- security-dashboard/src/App.js: route map
- security-dashboard/src/context/AuthContext.jsx: auth token and user state
- security-dashboard/src/services/scanService.js: scans API client
- security-dashboard/src/services/reportService.js: reports API client
- security-dashboard/src/pages/: UI pages for auth, scans, reports, admin, settings

## 3) How Frontend and Backend Are Linked

Link flow:
1. Frontend computes API base URL from security-dashboard/src/lib/apiBaseUrl.js.
2. User logs in from Login page.
3. AuthContext sends POST /auth/login with FormData (username=email, password).
4. Access token is saved to localStorage.
5. All protected requests send Authorization: Bearer <token>.
6. Backend validates token in auth utils and enforces user/role access rules.

Main linked API endpoints used by frontend:
- Auth:
  - POST /auth/login
  - POST /auth/register
  - GET /auth/me
  - PUT /auth/me/password
  - GET /auth/users (admin)
  - POST /auth/users (admin)
  - PUT /auth/users/{user_id}/role (admin)
  - DELETE /auth/users/{user_id} (admin)
- Scans:
  - GET /scans
  - POST /scans
  - GET /scans/{id}
  - GET /scans/{id}/logs
  - GET /scans/{id}/findings
  - GET /scans/{id}/artifacts
  - GET /scans/{id}/download/{artifact}
  - POST /scans/{id}/retry
  - POST /scans/{id}/cancel
- Reports:
  - GET /reports
  - GET /reports/{id}/final
  - GET /reports/{id}/download-full

## 4) Dashboard Feature Link Matrix (Is Everything Linked?)

Short answer: Not all features are fully linked.

### Fully linked features
- Login and token auth: linked and working
- Register: linked and working
- Scan creation: linked (POST /scans)
- Scans list page: linked (GET /scans)
- Active scans page: linked (GET /scans, POST cancel)
- Completed scans page: linked (GET /scans, POST retry)
- Scan details page: linked (job, logs, findings, artifacts, retry, cancel, download)
- Reports list page: linked (GET /reports)
- Report details page: linked (GET /reports/{id}/final)
- Full report download: linked (GET /reports/{id}/download-full)
- Admin user management: linked (list/create/update role/delete)
- Sidebar counters: linked (reads scans and reports)

### Partially linked features
- New Scan advanced UI options are only partly sent to backend:
  - UI has schedule, recurring, custom ports, auth credentials, depth
  - Actual API payload sends core scan fields only
- Reports page risk badge per list item uses currently selected report data, so card risk labels can be approximate.

### UI-only or not implemented features
- Main Dashboard page metrics/charts/recent activity are mock data (not live API-backed).
- Settings -> Profile save is UI-only (console log only).
- Settings -> Notification preferences save is UI-only (console log only).
- Admin Panel -> System Settings tab is mock/local state only (no backend persistence).
- Forgot Password flow is not implemented in backend integration (intentionally returns not implemented).

## 5) How It Works End-to-End

Typical user flow:
1. User logs in.
2. Dashboard stores token and current user.
3. User starts a scan from New Scan.
4. Backend creates scan job and runner processes it.
5. User monitors state in Scans/Active Scans.
6. User opens Scan Details for logs/findings/artifacts.
7. After report creation/import, user views Reports and Final Report.
8. User can download full report JSON.

Access control behavior:
- Regular users see only their own scans/reports.
- Admin users can access all users management routes in Admin panel.

## 6) Important Runtime Note (Linux)

In this workspace, .venv is Windows-style (Scripts/ and Lib/). On Linux, use a Linux venv such as .venv-linux.

Recommended backend run pattern on Linux:
- Activate .venv-linux
- Ensure DATABASE_URL is set (SQLite or MySQL)
- Run uvicorn app.main:app --host 0.0.0.0 --port 8000

## 7) Recommended Next Improvements

1. Connect Dashboard home widgets/charts to live scan/report endpoints.
2. Implement forgot-password backend endpoint and email flow.
3. Persist Settings profile and notification preferences to backend.
4. Persist Admin system settings to backend (new table + API).
5. Extend scan creation API to receive advanced form fields (schedule, credentials, depth, custom ports).
6. Add health endpoint and startup checks for database/backend availability.
