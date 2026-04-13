---
title: Setup / Environment
toc: true
---

# Setup, Runtime, and Reproducibility

This document is the single technical reference for:

- environment setup,
- local full-stack startup,
- reproducibility workflow,
- and the runtime data flow.

## 1. Access requirements

For full local functionality, request both from the repository owner:

- the `.env` file,
- and a private SSH key (temporary evaluation key or approved permanent key).

Without those credentials, use the GitHub Pages static demo only.

## 2. Prerequisites

| Requirement | Purpose |
| :--- | :--- |
| Git | Clone and update the repository |
| Conda / Miniconda | Provides the `lmp-lite` Python environment |
| Node.js 18+ and npm | Runs frontend and npm scripts |
| OpenSSH | Creates the database tunnel |
| lsof | Used by `makefile` port checks |

## 3. Environment setup

From repository root:

```bash
conda env create -f environment.yml
conda activate lmp-lite
npm install
```

Refresh an existing environment when needed:

```bash
conda env update -f environment.yml --prune
conda activate lmp-lite
```

## 4. Credentials and key placement

1. Place `.env` in repository root.
2. Install the provided SSH key:

```bash
make temp
```

Paste the private key and finish with `Ctrl-D`.

Expected backend variables in `.env` include:

```ini
DB_USER=...
DB_PASSWORD=...
DB_HOST=127.0.0.1
DB_PORT=5433
DB_NAME=...
```

## 5. Full local run

Start the full stack from repository root:

```bash
make app
```

Startup behavior:

1. verifies key presence,
2. opens SSH tunnel,
3. activates `lmp-lite`,
4. launches frontend and backend together.

Default local endpoints:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:8000`

Stop tunnel process:

```bash
make stop
```

## 6. Reproducibility paths

### A. Static demo reproducibility

Use when publishing or validating GitHub Pages output.

If backend is available locally, refresh demo snapshot:

```bash
python3 scripts/build_demo_snapshot.py --start-year 2020 --end-year 2025 --months 1,2,3,4,5,6,7,8,9,10,11,12
```

Build Pages artifacts:

```bash
npm run build:docs
```

### B. Full local reproducibility

Use when you need live API-backed behavior:

```bash
make app
```

This requires valid `.env` credentials plus SSH key access.

## 7. Runtime architecture and data flow

The system runs in five layers:

1. Makefile startup orchestration and tunnel handling.
2. Observable frontend in `src/`.
3. FastAPI backend in `api/backend.py`.
4. PostgreSQL data store for retail, wholesale, and geometry data.
5. Optional snapshot export to `src/data/demo/` for static demo delivery.

Request flow in local mode:

1. Frontend requests `/api/service_territory_price_data` and map data.
2. Backend queries PostgreSQL via SQLAlchemy.
3. Frontend computes average/monthly state and refreshes map, legend, and chart.

Request flow in static demo mode:

1. Frontend loads files from `data/demo/`.
2. No backend/API calls are required.

## 8. Common issues

### Missing SSH key

Run:

```bash
make temp
```

### Backend cannot connect

Verify `.env` exists and values match provided credentials, especially host `127.0.0.1` and port `5433`.

### Frontend build/runtime problems

Reinstall dependencies and retry:

```bash
npm install
make app
```

### Port conflicts

Inspect active listeners:

```bash
lsof -i :3000 -i :8000 -i :5433 -i :8001
```

For dashboard interpretation and workflow, see [User Guide](./USER_GUIDE).
