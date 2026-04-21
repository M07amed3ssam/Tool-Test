# Project Runtime Usage and File Map

Generated on: 2026-04-20

## 1) Scope

This workspace currently contains two Python/JS projects:

1. `Final test` (the active dashboard + backend stack)
2. `recon-agent` (standalone recon pipeline project, not required to run the dashboard stack)

This map focuses on all project files/folders that matter for development and runtime.
Dependency/cache folders such as `node_modules`, `.venv`, `.venv-linux`, `__pycache__`, `.pytest_cache`, and `.git` are intentionally excluded from deep listing.

---

## 2) Workspace Map

```text
Last-Version/
├── available_tools.json
├── available_wordlists.json
├── .gitignore
├── archive/
├── PROJECT_PLAN.md
├── run_final_test.sh
├── Final test/
└── recon-agent/
```

---

## 3) Full Map: Final test (Active Runtime Project)

```text
Final test/
├── alembic.ini
├── alembic_check.db
├── dev.db
├── test_scans_api.db
├── .env
├── .gitignore
├── README.md
├── DOCUMENTATION.md
├── PROJECT_STATUS_README.md
├── SECRET_KEY_SETUP.md
├── requirements.txt
├── generate_secret_key.py
├── seed_admin.py
├── insert_sample_data.py
├── load_env.py
├── login.py
├── setup_dashboard_recon.sh
├── test_output.json
├── .vscode/
│   └── settings.json
├── migrations/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       ├── 5b2d2b2e5b9d_sync_models.py
│       ├── add_reports_table.py
│       └── c4f1a7b8d9e0_add_scans_tables.py
├── tests/
│   ├── test_runner_status_policy.py
│   ├── test_scan_engine.py
│   ├── test_scans_api.py
│   ├── test_scheduler_progress.py
│   └── test_scheduler_soft_failures.py
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── db/
│   │   ├── __init__.py
│   │   └── database.py
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── routes.py
│   │   ├── schemas.py
│   │   └── utils.py
│   ├── scans/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── routes.py
│   │   ├── runner.py
│   │   ├── engine.py
│   │   └── utils.py
│   ├── reports/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── routes.py
│   │   └── utils.py
│   ├── recon/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── adaptive/
│   │   │   ├── __init__.py
│   │   │   └── feedback_loop.py
│   │   ├── input/
│   │   │   ├── __init__.py
│   │   │   ├── classifier.py
│   │   │   ├── tool_discovery.py
│   │   │   └── validator.py
│   │   ├── normalizer/
│   │   │   ├── __init__.py
│   │   │   ├── merger.py
│   │   │   └── schema.py
│   │   ├── orchestrator/
│   │   │   ├── __init__.py
│   │   │   ├── executor.py
│   │   │   ├── retry_handler.py
│   │   │   └── scheduler.py
│   │   ├── parsers/
│   │   │   ├── __init__.py
│   │   │   ├── amass_parser.py
│   │   │   ├── ffuf_parser.py
│   │   │   ├── gobuster_parser.py
│   │   │   ├── masscan_parser.py
│   │   │   ├── nmap_parser.py
│   │   │   ├── nuclei_parser.py
│   │   │   └── subfinder_parser.py
│   │   ├── planner/
│   │   │   ├── __init__.py
│   │   │   ├── ai_planner.py
│   │   │   └── rules_engine.py
│   │   └── reporting/
│   │       ├── __init__.py
│   │       ├── ai_reporter.py
│   │       ├── exporter.py
│   │       ├── risk_scoring.py
│   │       └── summary.py
│   └── data/
│       ├── reports/
│       │   ├── .gitkeep
│       │   └── <user_id>/<report_name>/
│       │       ├── Final_report.json (or Final_report1/2/3.json in older samples)
│       │       └── Full_data.json
│       └── scans/
│           ├── .gitkeep
│           └── <user_id>/<scan_id>/
│               ├── Full_data.json
│               ├── Final_report.json
│               └── data/
│                   ├── raw/
│                   ├── state/
│                   └── normalized/
└── security-dashboard/
    ├── package.json
    ├── package-lock.json
    ├── .env
    ├── .babelrc
    ├── .eslintrc.js
    ├── .gitignore
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── README.md
    ├── STYLING_GUIDE.md
    ├── DYNAMIC_SIDEBAR_GUIDE.md
    ├── ENHANCED_REPORTS_GUIDE.md
    ├── extract-logo-colors.html
    ├── logo.png
    ├── Untitled design.png
    ├── .vscode/
    │   └── settings.json
    ├── public/
    │   ├── index.html
    │   ├── favicon.ico
    │   ├── logo.png
    │   ├── logo192.png
    │   ├── logo512.png
    │   ├── manifest.json
    │   ├── robots.txt
    │   ├── 1favicon.ico
    │   └── data/reports/1/test/
    └── src/
        ├── index.js
        ├── index.css
        ├── App.js
        ├── App.css
        ├── App.test.js
        ├── logo.svg
        ├── reportWebVitals.js
        ├── setupTests.js
        ├── lib/
        │   ├── apiBaseUrl.js
        │   └── utils.js
        ├── types/
        │   └── roles.js
        ├── context/
        │   ├── AuthContext.jsx
        │   ├── SidebarContext.jsx
        │   └── ThemeContext.jsx
        ├── layouts/
        │   ├── LayoutWrapper.jsx
        │   ├── Sidebar.jsx
        │   └── Topbar.jsx
        ├── services/
        │   ├── scanService.js
        │   └── reportService.js
        ├── pages/
        │   ├── Dashboard.jsx
        │   ├── NewScan.jsx
        │   ├── ActiveScans.jsx
        │   ├── CompletedScans.jsx
        │   ├── Scans.jsx
        │   ├── ScanDetails.jsx
        │   ├── Reports.jsx
        │   ├── FinalReport.jsx
        │   ├── Settings.jsx
        │   ├── AdminPanel.jsx
        │   ├── StyleDemo.jsx
        │   └── auth/
        │       ├── Login.jsx
        │       ├── Register.jsx
        │       └── ForgotPassword.jsx
        ├── hooks/
        ├── utils/
        └── components/
            ├── JsonViewer.jsx
            ├── NotificationsPopover.jsx
            ├── ProtectedRoute.jsx
            ├── ScanDetailsModal.jsx
            ├── ScanJobCard.jsx
            ├── SecureFileDownload.jsx
            ├── SecurityScoreCard.jsx
            ├── StatCard.jsx
            ├── ThemeToggle.jsx
            ├── VulnerabilityDetails.jsx
            └── ui/
                ├── accordion.jsx
                ├── alert.jsx
                ├── avatar.jsx
                ├── badge.jsx
                ├── button.jsx
                ├── card.jsx
                ├── checkbox.jsx
                ├── dialog.jsx
                ├── dropdown-menu.jsx
                ├── input.jsx
                ├── label.jsx
                ├── popover.jsx
                ├── progress.jsx
                ├── radio-group.jsx
                ├── scroll-area.jsx
                ├── select.jsx
                ├── table.jsx
                ├── tabs.jsx
                ├── toast.jsx
                └── use-toast.jsx
```

---

## 4) Full Map: recon-agent (Standalone/Secondary Project)

```text
recon-agent/
├── .env
├── .gitignore
├── README.md
├── Full_data.json
├── output.txt
├── config/
│   ├── tools.yaml
│   └── workflow.yaml
├── data/
│   ├── normalized/.gitkeep
│   ├── raw/
│   │   ├── .gitkeep
│   │   ├── ffuf.json
│   │   ├── gobuster.txt
│   │   ├── nmap.txt
│   │   ├── nmap.xml
│   │   ├── nuclei_status.json
│   │   ├── nuclei.txt
│   │   └── subfinder.txt
│   └── state/
│       ├── ai_report.json
│       ├── completed_steps.json
│       ├── execution_results.json
│       ├── last_run.json
│       ├── live_scope_validation.log
│       ├── llm_output.json
│       ├── nuclei_targets.txt
│       ├── subdomains_all.txt
│       └── summary.txt
├── src/
│   ├── __init__.py
│   ├── main.py
│   ├── adaptive/feedback_loop.py
│   ├── input/{classifier.py,tool_discovery.py,validator.py}
│   ├── normalizer/{merger.py,schema.py}
│   ├── orchestrator/{executor.py,retry_handler.py,scheduler.py}
│   ├── parsers/{amass_parser.py,ffuf_parser.py,gobuster_parser.py,masscan_parser.py,nmap_parser.py,nuclei_parser.py,subfinder_parser.py}
│   ├── planner/{ai_planner.py,rules_engine.py}
│   └── reporting/{ai_reporter.py,exporter.py,risk_scoring.py,summary.py}
└── tests/
    ├── test_ai_planner.py
    ├── test_ai_reporter.py
    ├── test_main_nuclei_status.py
    ├── test_main_orchestration_flags.py
    ├── test_rules_engine.py
    ├── test_scheduler_orchestration.py
    └── test_validator.py
```

---

## 5) What Is Used When You Run the Project

### 5.1 Backend runtime (FastAPI)

Normal backend start command:

- `cd "Final test" && uvicorn app.main:app --host 0.0.0.0 --port 8000`

Used path:

1. Entry and startup:
   - `Final test/app/main.py`
   - `Final test/load_env.py`
   - `Final test/app/db/database.py`
2. API modules mounted by backend:
   - `Final test/app/auth/*`
   - `Final test/app/scans/*`
   - `Final test/app/reports/*`
3. Scan execution code (only when creating/running scans):
   - `Final test/app/scans/runner.py`
   - `Final test/app/scans/engine.py`
   - `Final test/app/scans/utils.py`
   - `Final test/app/recon/*` (input/orchestrator/parsers/planner/reporting)
4. Runtime output locations used by scan/report flow:
   - `Final test/app/data/scans/...`
   - `Final test/app/data/reports/...`

### 5.2 Dashboard runtime (React)

Normal frontend start command:

- `cd "Final test/security-dashboard" && npm start`

Used path:

1. Entry and route shell:
   - `src/index.js`
   - `src/App.js`
   - `src/lib/apiBaseUrl.js`
2. Session and auth:
   - `src/context/AuthContext.jsx`
   - `src/components/ProtectedRoute.jsx`
3. API clients:
   - `src/services/scanService.js`
   - `src/services/reportService.js`
4. Rendered pages and layouts:
   - `src/layouts/*`
   - `src/pages/*` (routes from `App.js`)
   - `src/components/*`

### 5.3 Top-level files used by running scans

These are read by scan utility logic (through fallback path lookup) when scan jobs are executed:

- `available_tools.json`
- `available_wordlists.json`

---

## 6) Unused/Low-Use Classification

Important: "unused" here means "not required for normal dashboard + backend runtime loop".
Some files are still useful for setup, testing, migration, or one-time operations.

### 6.1 Test-only files

1. Root test runner:
   - `run_final_test.sh`
2. Backend tests:
   - `Final test/tests/*`
3. Recon-agent tests:
   - `recon-agent/tests/*`

### 6.2 Setup/Maintenance files (not loaded continuously at runtime)

1. Secret, admin, seed, and import scripts:
   - `Final test/generate_secret_key.py`
   - `Final test/seed_admin.py`
   - `Final test/insert_sample_data.py`
2. Deployment helper script:
   - `Final test/setup_dashboard_recon.sh`
3. DB migration files:
   - `Final test/migrations/*`
4. Docs and guides:
   - `Final test/DOCUMENTATION.md`
   - `Final test/SECRET_KEY_SETUP.md`
   - `Final test/PROJECT_STATUS_README.md`
   - `Final test/security-dashboard/*GUIDE.md`

### 6.3 Old/parallel system code

1. `recon-agent/*` is a standalone project copy/variant.
2. It is not required to boot the active dashboard stack in `Final test`.
3. It can still be used for experiments or data import via `insert_sample_data.py`.

### 6.4 Archived likely-unused files (moved, not deleted)

Moved to `archive/likely-unused/` on 2026-04-20 to clean active structure while preserving rollback.

1. Previously empty placeholder backend folders:
   - `archive/likely-unused/Final test/app/admin_settings/`
   - `archive/likely-unused/Final test/app/dashboard/`
   - `archive/likely-unused/Final test/app/notifications/`
2. Duplicate frontend page file not referenced by routing:
   - `archive/likely-unused/Final test/security-dashboard/src/pages/FinalReport copy.jsx`
3. Stray file:
   - `archive/likely-unused/Final test/security-dashboard/-n`
4. Minimal placeholder JSON with no active wiring:
   - `archive/likely-unused/Final test/js.json`
5. Standalone notes file outside project docs:
   - `archive/likely-unused/.md`

Git ignore update:

- Root `.gitignore` now contains `archive/` so archived files remain local and out of normal commits.

---

## 7) Quick "Run Project" Checklist

1. Start backend:
   - `cd "Final test"`
   - activate venv
   - `uvicorn app.main:app --host 0.0.0.0 --port 8000`
2. Start frontend:
   - `cd "Final test/security-dashboard"`
   - `npm start`
3. Verify:
   - Frontend: `http://localhost:3000`
   - Backend health: `http://127.0.0.1:8000/health`

---

## 8) Suggested Cleanup Strategy (Safe)

1. Keep all files in `Final test/app/**` and `Final test/security-dashboard/src/**`.
2. Keep migration and setup scripts unless deployment process is replaced.
3. Move likely unused files to an `archive/` folder first, do not delete immediately.
4. Keep tests; they are not runtime files but are important for regression safety.

