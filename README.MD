# DS5500 - Capstone, Spring 2026

## Project Goal and Overview

**To provide transparency in electricity pricing.**

The Electricity Retail/Wholesale Comparison Tool is designed to enable users to visualize and compare wholesale electricity prices (LMPs) with retail utility rates. By automating the comparison process, users can easily identify trends, price spreads, and regional variations, ultimately facilitating informed decision-making in energy trading. This tool bridges the gap between volatile wholesale electricity prices and fixed retail rates by automating the comparison of aggregated LMPs against utility standard offer rates, enhancing transparency and understanding of market dynamics.

# PJM ISO Retail Electricity Service Provider Territories 

<div align="center">
  <img src="docs/retail service territories.png" alt="Retail Service Territories" width="600">
  <p><em>This map visualizes the physical territory where Delmarva provides retail electricity</em></p>
</div>

## Quick Start Guide
*Prerequisites: Git, Conda or Miniconda, Node.js 18+, npm, OpenSSH.*

The recommended way to run the application is from the repository root with `make app`.

### 1. Clone the repository

```bash
git clone https://github.com/nudataviz/electricity-price-comparison-tool
cd electricity-price-comparison-tool
```

### 2. Create the Conda environment from the provided YAML file

The Python environment definition already exists in [electricity/environment.yml](electricity/environment.yml).

```bash
conda env create -f electricity/environment.yml
conda activate lmp-env
```

### 3. Install frontend dependencies

```bash
cd electricity
npm install
cd ..
```

### 4. Create a `.env` file for the backend

Create `.env` at the repository root with the database settings used by the FastAPI backend:

```ini
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_HOST=127.0.0.1
DB_PORT=5433
DB_NAME=your_database_name
```

Notes:

* `make app` opens an SSH tunnel that forwards local port `5433` to the remote PostgreSQL server.
* If you are not using the default tunnel target in the Makefile, update both the Makefile and `.env` values to match your environment.

### 5. Confirm the SSH tunnel settings in the Makefile

The `app` target uses the `TUNNEL_CMD` value in [makefile](makefile). Before running the app, verify:

* The SSH private key path is correct.
* The remote host is reachable.
* The forwarded ports match your database and backend expectations.

### 6. Start the application

From the repository root, run:

```bash
make app
```

What `make app` does:

* closes an existing SSH tunnel if one is already running,
* frees ports `3000` and `8000` if another process is holding them,
* activates the `lmp-env` Conda environment,
* changes into `electricity/`,
* starts the Observable frontend on port `3000`, and
* starts the FastAPI backend on port `8000`.

If the environment and tunnel are configured correctly, this is the preferred way to run the app locally.

### 7. Stop the tunnel

To close the SSH tunnel manually:

```bash
make stop
```

### Troubleshooting

* If `make app` fails immediately, first verify the SSH key path and host in [makefile](makefile).
* If the backend fails to connect, confirm that `.env` contains valid PostgreSQL credentials and that the tunnel is forwarding to the correct database.
* If `npm run dev` fails, rerun `npm install` inside `electricity/`.
* If Conda cannot find the environment, recreate it from [electricity/environment.yml](electricity/environment.yml).
---

## Documentation

*** ORIENTATION DOCUMENTS ARE PLANNED BUT NOT YET COMPLETE ***

### 1. [User Guide & Domain Logic](electricity/src/USER_GUIDE.md) 👈 *Start Here for Context*
*   **Key Terms:** What are PJM, LMP, retail rates, and price spreads?
*   **How to Use the Tool:** Navigating the interface and interpreting visualizations.
*   **Workflow:** Steps to compare historical wholesale and retail prices.

### 2. [Technical Setup & Data Ingestion](electricity/src/SETUP.md) 👈 *Start Here for Building the Infrastructure*
*   **Environment Preparation:** Building the Conda and npm environment required by `make app`.
*   **Backend Connectivity:** Setting up `.env` keys and SSH tunnel assumptions.
*   **Infrastructure Notes:** Understanding what is required beyond basic app startup.

### 3. [Architecture Overview](electricity/src/ARCHITECTURE.md)
*   **Runtime Flow:** How the frontend, backend, Makefile, and database interact.
*   **Project Layout:** Where the main application components live.
*   **Current Boundaries:** What is fully documented versus still evolving.

---

## Feedback & Contact

Feedback and suggestions are welcome. Please send your thoughts to:

Please email **Ben Darby** @ darby.b@northeastern.edu