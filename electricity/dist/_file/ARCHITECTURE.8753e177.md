---
title: Architecture
toc: true
---

# Application Architecture

This document describes the current runtime architecture of the Electricity Retail/Wholesale Comparison Tool and how the major pieces fit together.

It is intended to explain how the checked-in application runs today. For environment creation and launch instructions, use [SETUP.md](SETUP.md). For the quickest startup path, use the top-level [README.MD](../../README.MD).

## 1. System Overview

The application is split into four main layers:

1. Observable Framework frontend for the UI and page structure.
2. MapLibre-based map rendering and interactive overlays.
3. FastAPI backend for API endpoints and database access.
4. PostgreSQL-backed data store accessed through SQLAlchemy.

At runtime, the frontend talks to the backend over local HTTP, and the backend queries the database using credentials loaded from `.env`.

## 2. Runtime Flow

The normal local startup path is:

1. `make app` is run from the repository root.
2. The Makefile opens an SSH tunnel for the database and frees local app ports if needed.
3. The Conda environment `lmp-env` is activated.
4. The working directory changes into `electricity/`.
5. `npm run dev` launches both:
   - the Observable frontend on port `3000`
   - the FastAPI backend on port `8000`
6. Frontend requests under `/api` are proxied to the backend.

## 3. Major Components

| Layer | Technology | Responsibility |
| :--- | :--- | :--- |
| Frontend UI | Observable Framework, JavaScript, CSS | Page structure, filter controls, legends, sidebar, and documentation pages |
| Mapping | MapLibre GL, D3 | Service territory rendering, labels, pin layers, hover and selection behavior |
| Backend API | FastAPI, SQLAlchemy | Serves service territory geometry, retail/wholesale data, and filtered aggregates |
| Data Store | PostgreSQL | Stores service territories, PJM pricing data, and derived monthly values |

## 4. Frontend Structure

The frontend entry point is [index.md](index.md). The most important supporting files are:

* [components/map.js](components/map.js): map initialization, layer creation, sidebar interactions, and view toggles.
* [managers/app_controller.js](managers/app_controller.js): controller logic for loading data, computing map colors, and switching views.
* [components/ui.js](components/ui.js): legends, filter display, and supporting UI helpers.
* [components/filter.js](components/filter.js): current filter state and persisted query parameters.
* [components/picker.js](components/picker.js): date/month selection UI.
* [styles/main.css](styles/main.css): application layout and visual styling.

## 5. Backend Structure

The backend entry point is [../../electricity/api/backend.py](../../electricity/api/backend.py).

Key backend responsibilities:

* loading environment variables with `load_dotenv()`,
* building the PostgreSQL connection string,
* exposing API endpoints consumed by the frontend,
* querying service territory geometries and pricing aggregates.

The frontend proxy is configured in [../../electricity/observablehq.config.js](../../electricity/observablehq.config.js), where `/api` is forwarded to `http://127.0.0.1:8000` by default or to `BACKEND_URL` if provided.

## 6. Data and Hydration Scripts

The data ingestion and maintenance scripts live in [hydrate](hydrate).

These scripts are part of the broader infrastructure workflow, not the minimum path required to launch the application UI. They are used to populate and maintain the database tables the app expects.

Examples include:

* historical LMP ingestion scripts,
* retail price update scripts,
* status and watchdog utilities,
* database maintenance helpers.

This distinction matters:

* launching the app requires the environment, backend, and database connection to be configured,
* fully reproducing the dataset additionally requires populated source tables and ingestion workflows.

## 7. External Dependencies

The application depends on several external systems:

* a reachable PostgreSQL database,
* SSH access to the remote host used by the Makefile tunnel,
* PJM data sources for ingestion workflows,
* a map tile provider for the basemap.

Current note:

* the checked-in map configuration currently references a MapTiler style URL directly in [components/map.js](components/map.js) rather than reading a map key from `.env`. That is part of the current code path and should be treated as an implementation detail that may be externalized later.

## 8. Repository Areas Relevant to Reproduction

These files are the most important for a new developer trying to understand or reproduce the app:

* [../../README.MD](../../README.MD): top-level quick start.
* [SETUP.md](SETUP.md): environment and startup preparation.
* [USER_GUIDE.md](USER_GUIDE.md): domain and UI usage context.
* [../../makefile](../../makefile): startup automation and SSH tunnel behavior.
* [../../electricity/environment.yml](../../electricity/environment.yml): Conda environment definition.
* [../../electricity/package.json](../../electricity/package.json): npm scripts and JavaScript dependencies.

## 9. Current Boundaries and Incomplete Areas

Some project documentation and infrastructure workflows are still evolving.

In particular:

* the runtime startup path is cleaner than the full ingestion/rebuild story,
* some ingestion scripts are operational but not yet documented as a polished end-user workflow,
* some architecture details in older notes may lag behind the current PostgreSQL and `make app` flow.

This file should therefore be read as a current-state architecture summary, not as a claim that every infrastructure workflow has already been packaged for first-time users.