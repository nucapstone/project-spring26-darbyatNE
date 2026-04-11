---
title: System Architecture
toc: true
---

# System Architecture

This document summarizes the final architecture of the completed Electricity Retail / Wholesale Comparison Tool.

It explains how the app starts, how data moves through the system, and which files are responsible for the major behaviors seen in the dashboard.

For environment setup, see [Setup / Environment](./SETUP). For product usage, see [User Guide](./USER_GUIDE).

## 1. Architecture summary

The application has five main runtime layers:

1. **Root startup automation** via the repository `makefile`
2. **Observable Framework frontend** for page layout and documentation pages
3. **MapLibre + D3 interaction layer** for the map, legend, animation, and chart behavior
4. **FastAPI backend** for API endpoints and database access
5. **PostgreSQL data layer** for service territory, retail, and wholesale pricing data

At runtime, the frontend talks to the backend over local HTTP, and the backend queries the PostgreSQL database using credentials loaded from the repository-root `.env` file.

## 2. End-to-end runtime flow

The normal local startup path is:

1. The user runs `make app` from the repository root.
2. The root `makefile`:
   - verifies an SSH key is available,
   - frees local ports if necessary,
   - opens the SSH tunnel used for database access.
3. The `lmp-lite` Conda environment is activated.
4. The working directory stays at the repository root.
5. `npm run dev` starts both services:
   - Observable frontend on port `3000`
   - FastAPI backend on port `8000`
6. The frontend loads the map shell from `src/index.md`.
7. `MapController.loadData()` requests `/api/service_territory_price_data`.
8. The backend joins retail and wholesale monthly data and returns the filtered records.
9. The frontend computes:
   - average values for summary view,
   - `monthlyFrames` for animation and time scrubbing,
   - the current color scales for the map and legend.
10. The map, sidebar, popups, and **Price Analysis** panel all update from that shared state.

## 3. Major subsystems

| Layer | Primary technology | Responsibility |
| :--- | :--- | :--- |
| Startup / orchestration | `make`, SSH, Conda | Opens the tunnel, activates the environment, and launches the app |
| Frontend shell | Observable Framework | Hosts pages, layout, modal docs, and app bootstrapping |
| Interactive map layer | MapLibre GL + D3 | Renders territories, wholesale pins, legends, selection state, and time-based interactions |
| Backend API | FastAPI + SQLAlchemy | Exposes service territory and pricing endpoints to the frontend |
| Persistence layer | PostgreSQL | Stores the geography and retail/wholesale comparison data |

## 4. Frontend design

The frontend entry page is `src/index.md`.

The most important UI modules are:

| File | Role |
| :--- | :--- |
| `src/index.md` | Page structure, modals, top controls, map container, sidebar, and initial app bootstrapping |
| `src/components/map.js` | Initializes the MapLibre map, wires UI controls, attaches click/hover behavior, and syncs the app view state |
| `src/managers/app_controller.js` | Central state manager for data loading, color scales, average/monthly views, animation, popups, and zone highlighting |
| `src/components/zone_plot.js` | Builds the **Price Analysis** panel and updates the chart for selected territories |
| `src/components/ui.js` | Renders the legend, filter summary, and information modals |
| `src/components/filter.js` | Reads and stores the current filter state from the URL |
| `src/components/picker.js` | Month and year selection control used by the filter modal |
| `src/styles/main.css` | Layout, sidebar, legend, modal, and plot panel styling |

### Frontend interaction model

The interface is built around two main map modes:

- **Locational View** for orientation and territory identity
- **Price View** for retail/wholesale comparison

It also supports two time perspectives:

- **Avg Price View** for the selected filter window
- **month-by-month playback** for time navigation and animation

The **Price Analysis** panel is intentionally hidden until the user explicitly selects one or more territories from the sidebar.

## 5. Backend design

The backend is implemented in `api/backend.py` using **FastAPI** and **SQLAlchemy**.

Its responsibilities include:

- loading environment variables with `load_dotenv()`,
- building the PostgreSQL connection string,
- opening database sessions,
- serving geometry and pricing endpoints consumed by the frontend.

### Key API routes

| Endpoint | Purpose |
| :--- | :--- |
| `/api/service-terr` | Returns service territory geometries used for the polygon layer |
| `/api/nodes` | Returns PJM node coordinates used for point mapping |
| `/api/service_territory_price_data` | Returns monthly retail + wholesale comparison data filtered by year and month |
| `/api/zones` and related utility routes | Support additional geometry and data access workflows |

### Proxy behavior

`observablehq.config.js` proxies `/api` requests to `http://127.0.0.1:8000` by default, which keeps frontend code simple during local development.

## 6. Data model used by the dashboard

The current dashboard is driven by a small number of core data sources:

| Table / source | Role in the app |
| :--- | :--- |
| `service_territories` | Retail service territory polygons |
| `retail_monthly_rates_pjm` | Monthly retail rate values by utility / territory |
| `wholesale_month_price` | Aggregated monthly wholesale values by service territory |
| `pjm_lat_long` | Node-level point coordinates for wholesale markers |
| `pjm_zone_shapes` | Zone geometry support for additional overlays and highlighting |

The main comparison endpoint performs a **FULL OUTER JOIN** between retail and wholesale monthly tables so the UI can still render even when one side has missing data for a territory-month combination.

## 7. State and rendering flow in the frontend

The most important state object lives in `MapController`.

That controller is responsible for:

- loading the filtered dataset,
- building `monthlyFrames` from the API result,
- calculating average retail and wholesale prices,
- updating dynamic color scales,
- switching between locational and price modes,
- driving the animation controls and time slider,
- refreshing popups, legend content, and sidebar colors.

This design keeps the map, legend, sidebar, and chart synchronized from one shared source of truth.

## 8. Supporting data-maintenance scripts

The `src/hydrate/` directory contains the data ingestion and maintenance workflow for the broader project.

These scripts are **supporting infrastructure**, not part of the minimum runtime path for viewing the dashboard.

Typical responsibilities in that area include:

- refreshing wholesale data,
- updating retail mapping tables,
- monitoring database sync status,
- database maintenance and watchdog tasks.

In other words:

- **running the app** requires the environment, tunnel, backend, and populated database,
- **rebuilding or refreshing the dataset** uses the hydrate scripts.

## 9. External dependencies and assumptions

The application depends on:

- a reachable PostgreSQL database,
- SSH access for the tunnel configured in the root `makefile`,
- PJM-derived source data that has already been loaded into the expected tables,
- a working map tile provider for the basemap.

The current checked-in frontend uses a MapTiler style URL directly in `src/components/map.js`, which is part of the deployed implementation for this capstone submission.

## 10. Repository areas most relevant to future contributors

If you are extending or reviewing the completed project, these are the highest-value places to start:

- `README.MD` for the root quick start
- `makefile` for launch and SSH tunnel behavior
- `environment.yml` for Python dependencies
- `package.json` for frontend/backend scripts
- `src/index.md` for the app shell
- `src/managers/app_controller.js` for the core interaction logic
- `src/components/zone_plot.js` for the price analysis chart

## 11. Final note

This architecture reflects the final state of the capstone application: a complete interactive comparison tool built around an Observable frontend, a FastAPI backend, and a PostgreSQL-backed pricing dataset.

It should be read as the technical source of truth for how the finished system is organized and how its runtime pieces fit together.
