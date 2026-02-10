## System Architecture

The application is built on a modular architecture to ensure scalability and separation of functionality:

| Component | Tech Stack | Role |
| :--- | :--- | :--- |
| **Data Sources** | PJM Data Miner 2 & ArcGIS Online | Harnesses the PJM "Data Vault" for market data and retrieves GeoShapes for PJM zone geodata. |
| **Database** | AWS RDS (MySQL) | Currently Storing 9GB+ of historical PJM market data. |
| **Frontend** | Observable Framework (JS/D3) | Interactive visualizations and state management. |
| **Mapping** | MapLibre GL JS | High-performance vector tile mapping for zone shapes and ISO border identification. |
| **Backend** | Python (FastAPI) | Handles API requests and executes complex SQL queries. |
| **Version Control** | GitHub | Source code management and team collaboration. |

---

### 1. Infrastructure & Data Setup (Crucial Step)

To transition this project from a static demo to a fully functional analytics tool, you must also configure the underlying data infrastructure (MySQL, PJM API, MapTiler) and ingest historical data.

👉 Click the **System Architecture** link in the **Gettting Started** section for more information on Architecture & Deployment

This guide provides a comprehensive, step-by-step manual on:
*   **Acquiring Credentials:** How to set up PJM Data Miner, MapTiler, and AWS/Local MySQL accounts.
*   **Data Ingestion:** Running the Python scripts in `src/data/` to populate the database with historical market prices and other data.

> **Note:** The application requires this data foundation to be in place before the visualization features will function correctly.

### 2. Configuration (.env)

Once you have acquired your credentials as detailed in the PDF guide above, create a file named `.env` at the project root.

**Add the following keys to your `.env` file:**
```ini
PJM_API_KEY=your_pjm_api_key_here
USER=database_username
DB_PASSWORD=database_password
DB_NAME=database_name
DB_HOST=aws_rds_endpoint
DB_PORT=3306
BACKEND_URL=http://127.0.0.1:8000
MAP_KEY=your_maptiler_map_key
```
### 3. Environment Setup

Create the Conda environment using the provided YAML file. This installs all necessary Python dependencies.

```bash
# Create the environment from file
conda env create -f lmp_env.yml

# Activate the environment
conda activate lmp-env
```
### 4. Database Schema Reference

The ingestion scripts (detailed in the PDF guide) will automatically structure your database according to the schema file:

Please refer to the image <span style="color: DodgerBlue; font-weight: bold;">db_schema.png</span> located in the img directory.
<!-- <div align="center">
  <img src="./img/db_schema.png" alt="Schema of DB" width="600">
</div> -->

---