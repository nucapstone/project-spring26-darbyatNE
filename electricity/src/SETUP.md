---
title: Infrastructure Setup
toc: true
---

# Environment Setup for Reproducing the App

This document is the practical setup guide for developers who need to recreate the runtime environment and launch the application with `make app`.

It focuses on the environment and infrastructure needed to run the current repository as it exists today. Some data-ingestion and architecture notes elsewhere in the project are still evolving; this guide is intentionally centered on the shortest reliable path to getting the app running.

## 1. What `make app` depends on

Before `make app` can succeed, the following must already be in place:

1. Git is installed.
2. Conda or Miniconda is installed.
3. Node.js 18+ and npm are installed.
4. OpenSSH is installed.
5. `lsof` is installed so the Makefile can free ports before startup.
6. A Conda environment named `lmp-lite` exists.
7. Frontend dependencies are installed in `electricity/`.
8. Database credentials are available through a `.env` file.
9. The SSH tunnel defined in [makefile](../../makefile) points to a valid host and private key.

### Dependency inventory used for this setup

The dependency files were trimmed based on imports scanned across this repository.

Python packages in [environment.yml](../environment.yml):

* `fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `python-dotenv`
* `requests`, `pymysql`, `psycopg2`, `mysql-connector-python`
* `pandas`, `geopandas`, `shapely`, `matplotlib`, `openpyxl`

NPM packages in [package.json](../../electricity/package.json):

* Runtime: `d3`, `maplibre-gl`, `@observablehq/plot`, `@turf/turf`
* Tooling: `@observablehq/framework`, `concurrently`, `rimraf`

## 2. Repository layout relevant to startup

These are the main files involved in local startup:

* [makefile](../../makefile): launches the tunnel and both app processes.
* [environment.yml](../environment.yml): Conda environment definition for Python dependencies.
* [package.json](../../electricity/package.json): frontend and backend npm scripts.
* [backend.py](../../electricity/api/backend.py): FastAPI backend, including `.env` loading and database connection setup.

## 3. Clone the repository

```bash
git clone https://github.com/nudataviz/electricity-price-comparison-tool
cd electricity-price-comparison-tool
```

## 4. Create the Conda environment

The environment file already exists in the repository and should be used directly.

```bash
conda env create -f electricity/environment.yml
conda activate lmp-lite
```

This setup creates a separate lightweight environment (`lmp-lite`) and does not modify an existing `lmp-env`.

If you already created the environment earlier and dependencies changed, update it with:

```bash
conda env update -f electricity/environment.yml --prune
```

After updating Conda dependencies, reinstall JavaScript packages to keep lockfiles and local modules aligned:

```bash
cd electricity
npm install
cd ..
```

## 5. Install JavaScript dependencies

The Observable frontend and concurrent startup scripts can be found in `electricity/`.

```bash
cd electricity
npm install
cd ..
```

## 6. Create the `.env` file for the backend

The backend reads environment variables with `load_dotenv()`. The simplest approach is to create a `.env` file at the repository root.

Add the following keys:

```ini
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_HOST=127.0.0.1
DB_PORT=5433
DB_NAME=your_database_name
```

Notes:

* The backend currently builds a PostgreSQL connection string from these values.
* `DB_PORT=5433` is used because the Makefile SSH tunnel forwards local port `5433` to the remote database server.
* If your tunnel target or local forwarding port differs, update both the Makefile and `.env` accordingly.

## 7. Verify the SSH tunnel command in the Makefile

The `app` target relies on `TUNNEL_CMD` in [makefile](../../makefile).

Check all of the following before trying to launch:

* the SSH private key file exists,
* the file permissions on the key are valid,
* the remote host is reachable,
* the remote database host/port forwarding is correct,
* the local forwarded database port matches the `.env` file.

The Makefile currently also:

* closes an existing matching SSH tunnel if one is already running,
* checks whether ports `3000` and `8000` are busy,
* kills processes holding those ports before startup.

## 8. Run the application

From the repository root:

```bash
make app
```

On success, this starts:

* the Observable frontend on `http://127.0.0.1:3000`,
* the FastAPI backend on `http://127.0.0.1:8000`.

## 9. Stop the SSH tunnel

To close the tunnel manually:

```bash
make stop
```

## 10. Troubleshooting

### `make app` exits immediately

Check [makefile](../../makefile) first. The most common causes are:

* invalid SSH key path,
* unreachable SSH host,
* Conda not available in the current shell,
* missing `npm` dependencies in `electricity/`.

### Backend fails to start

Check the following:

* `.env` exists and contains `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, and `DB_NAME`,
* the database is reachable through the configured SSH tunnel,
* the Conda environment was created from [environment.yml](../environment.yml).
* if needed, refresh the environment with `conda env update -f electricity/environment.yml --prune`.

### Frontend fails to start

Run:

```bash
cd electricity
npm install
```

Then retry `make app` from the repository root.

### Ports 3000 or 8000 are already in use

The Makefile now attempts to free those ports automatically. If startup still fails, run:

```bash
lsof -i :3000 -i :8000
```

and verify that no unrelated protected process is holding those ports.

## 11. Data population status

Running the UI is not the same as reproducing the full historical dataset.

The application can start once the environment, tunnel, and backend connection are configured, but the visualizations still depend on the underlying PostgreSQL database already containing the expected tables and data.

The ingestion scripts remain in [hydrate](../hydrate), but this guide does not attempt to present them as fully polished end-user setup steps yet. That material should be treated as a separate infrastructure workflow.