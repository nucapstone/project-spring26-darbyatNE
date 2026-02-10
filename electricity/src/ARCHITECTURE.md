---
title: Infrastructure Setup
toc: true
---

# PJM LMP Visualization Application Infrastructure Setup

This document provides supplemental instructions for developers wishing to go beyond a basic repository clone and transition this project into a fully functional analytics tool. To achieve this, users must establish the underlying data infrastructure and external service accounts.

## 1. Required Accounts & Services
To fully replicate the environment, the following external services are required:

*   **PJM Data Miner (E-Suite):** Required to access wholesale market APIs.
    *   [PJM Account Setup Link](https://www.pjm.com/)
*   **PostGRES Database Instance:** Required for data warehousing (e.g., AWS RDS or local instance).
    *   [Amazon RDS MySQL Setup Link](https://aws.amazon.com/rds/)
*   **MapTiler Cloud:** Required for vector basemap rendering.
    *   [MapTiler API Setup Link](https://www.maptiler.com/)

## 2. Infrastructure & Credentials
Before running the application, users must acquire valid API keys from the services listed above. These credentials must be mapped to the `.env` file located in the project root directory.

This configuration allows the backend to authenticate external requests and store the massive datasets required for analysis.

> **Note:** Once the credentials are updated in the `.env` file, the application’s internal logic automatically detects and utilizes them.

## 3. Data Ingestion & Management

Once the MySQL database is connected, it must be populated to power the visualizations. You have three tools available in the `src/hydrate/` directory to manage this: **Manual Scripts**, the **Hourly Data Updater**, and the **5min Data Updater**.

### A. Manual Ingestion (Historical Data)
You can run individual scripts to fetch specific date ranges. This is useful for initial backfilling (e.g., loading the last year of data).

**Command Syntax:** `python <script_name> <start_date> <end_date>`

Navigate to the hydration directory:
```bash
cd src/hydrate
```

Run the four core ingestion scripts as needed:

1.  **Real-Time Hourly LMPs**
    ```bash
    python pjm_query_rt_lmp.py 2024-01-01 2024-12-31
    ```
2.  **Day-Ahead Hourly LMPs**
    ```bash
    python pjm_query_da_lmp.py 2024-01-01 2024-12-31
    ```
3.  **Binding Constraints**
    ```bash
    python pjm_query_rt_constraints.py 2024-01-01 2024-12-31
    ```
4.  **Real-Time 5-Minute LMPs** (Warning: Large data volume)
    ```bash
    python pjm_query_rt_5min_unver.py 2024-12-01 2024-12-31
    ```

---

### B. Smart Backfill
Instead of manually typing dates, you can run the **Hourly Data Uploader**. This script checks the database to find the last recorded date for every table and automatically fetches data from that point up to "Yesterday."

**When to use:** Run this once a day (e.g., via Cron) or whenever you start your development server to ensure your history is complete.

```bash
python update_pjm_db.py
```

**Output Example:**
```text
--- Checking: Real-Time Hourly LMP ---
Status: OUT OF DATE. Last data: 2024-10-25
>>> Launching pjm_query_rt_lmp.py...
>>> Range: 2024-10-26 to 2024-10-27
```

---

### C. Real-Time Watchdog
To view live data on the map, you must run the **5Min Data Uploader**. This script runs in an infinite loop, waking up every 5 minutes to fetch the latest 5-minute LMPs and Binding Constraints.

**When to use:** Keep this running in a separate terminal window while using the application.

```bash
python update_watchdog.py
```

---

### D. System Status Check
To quickly see the "Health" of your database—specifically, what date ranges are currently held in each table—run the status script.

```bash
python update_status.py
```

**Typical Output:**
```text
TABLE STATUS REPORT
------------------------------------------
pjm_rt_hrl_lmps:             Up to 2024-10-27
pjm_da_hrl_lmps:             Up to 2024-10-28
pjm_binding_constraints:     Up to 2024-10-27
pjm_rt_unverified_fivemin:   Up to 2024-10-27 14:55:00
```


## 4. Launch
Only after this data foundation is laid is the application ready for interaction. Running the command below in your terminal will launch a dashboard capable of querying real historical data, allowing users to visualize congestion risks and price behavior.

```bash
npm run dev


PJM LMP Visualization App Directory Structure:


Please refer to the tree structure below to locate the specific configuration files and scripts    mentioned in the previous section.





project-root/
├── src/
│   ├── components/
│   │   ├── config.js                   # Global constants, API endpoints, and default settings
│   │   ├── controller.js               # Manages app state and orchestrates updates
│   │   ├── filter.js                   # Logic for filtering datasets by zone or time
│   │   ├── map.js                      # Initializes the MapLibre map instance and base layers
│   │   ├── math.js                     # Helper functions for color interpolation and calculations
│   │   ├── picker.js                   # Logic handling the date/time range selection inputs
│   │   ├── style.css                   # Custom CSS styling for map overlays and UI elements
│   │   ├── ui.js                       # Manages DOM elements, popups, and sidebar interactions
│   │   └── utils.js                    # General utility functions (formatting dates, cleaning text)
│   ├── data/
│   │   ├── pjm_query_da_lmp.py         # Script to ingest Day-Ahead market prices
│   │   ├── pjm_query_forecast_load.py  # Script to ingest load forecast data
│   │   ├── pjm_query_inst_load.py      # Script to ingest instantaneous load data
│   │   ├── pjm_query_metered_load.py   # Script to ingest historical metered load
│   │   ├── pjm_query_rt_constraints.py # Script to ingest real-time transmission constraints
│   │   ├── pjm_query_rt_lmp.py         # Script to ingest Real-Time market prices
│   │   ├── pjm_query_temp_set.py       # Script to ingest temperature/weather data
│   │   ├── pjm_transmission_lines.py   # Script to ingest transmission line geo-data
│   │   ├── test_connection.py          # Utility to verify database connectivity
│   │   ├── test_pjm_data_retrieval.py  # Utility to test PJM API response and ingestion
│   │   └── PJM_zones.geojson           # Geospatial polygons defining PJM load zones
│   ├── img/
│   │   ├── db_schema.png               # Diagram of the SQL database structure
│   │   ├── lmp_icon.png                # Application icon
│   │   ├── observable.png              # Framework logo
│   │   ├── PJM_Map.png                 # Screenshot of the main map interface
│   │   └── Query_Tool.png              # Screenshot of the data query interface
│   ├── backend.py                      # FastAPI server handling SQL queries from the frontend
│   ├── index.md                        # Main entry point: The interactive dashboard interface
│   ├── overview.md                     # User Guide: Narrative explanation of market concepts
│   └── picker.md                       # Query Tool: Interface for selecting historical data
├── .env                                # Environment variables (API keys, DB creds) - Ignored
├── .gitignore                          # Specifies files to exclude from version control
├── eda.md                              # Exploratory Data Analysis and preliminary findings
├── lmp_env.yml                         # Conda environment file for Python dependencies
├── observablehq.config.js              # Configuration for the Observable Framework
├── package.json                        # Node.js dependencies and build scripts
├── proposal.md                         # Original academic project proposal
├── README.md                           # Main project documentation and setup guide
└── Architecture_and_Deployment_Guide.pdf # Instructions for infrastructure setup and data ingestion