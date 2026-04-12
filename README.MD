# DS5500 - Capstone, Spring 2026

## Project Goal and Overview

**To provide transparency in electricity pricing.**

The Electricity Retail/Wholesale Comparison Tool is designed to enable users to visualize and compare wholesale electricity prices (LMPs) with retail utility rates. By automating the comparison process, users can easily identify trends, price spreads, and regional variations, ultimately facilitating informed decision-making in energy trading. This tool bridges the gap between volatile wholesale electricity prices and fixed retail rates by automating the comparison of aggregated LMPs against utility standard offer rates, enhancing transparency and understanding of market dynamics.

# PJM ISO Retail Electricity Service Provider Territories 

<div align="center">
  <img src="src/img/dashboard.png" alt="Retail Service Territories" width="600">
  <p><em>This map shows PJM retail service territories and the wholesale pricing points used to compute each territory's average price.</em></p>
</div>

## Quick Start Guide
*Prerequisites: Git, Miniconda, Node.js 18+, npm, OpenSSH.*

### 1. Clone the repository

```bash

git clone https://github.com/nucapstone/project-spring26-darbyatNE.git

```

### 2. Create the Conda environment and NPM dependencies

```bash
conda env create -f environment.yml
conda activate lmp-lite
npm install
```

### 3. Install the SSH key used by the `Makefile`

- If you were sent a **temporary evaluation key**, you can install it with a single copy/paste block:

```bash
make temp <<'EOF'
-----BEGIN OPENSSH PRIVATE KEY-----
[paste the full private key here exactly as provided]
-----END OPENSSH PRIVATE KEY-----
EOF
```

> Use the full private key block as provided.

### 4. Save the provided `.env` file at the repository root

Place the `.env` file you were sent privately in the cloned repository root (the same directory as `README.MD`, `makefile`, and `package.json`). The required credentials are already included there.

### 5. Run the Application

With either the AWS Key or a Temp Key Installed, startup the app from the project root with the following terminal command:

```bash
make app
```

## GitHub Pages (docs folder)

This repository is configured to publish the static frontend from `docs/`.

> **Note for GitHub Pages visitors:** The data shown on the hosted site is a static demo/sample snapshot.
> To access the full live workflow and backend-connected data retrieval, you must clone the repository and use the provided temporary `.env` credentials and SSH key.

### Static demo data mode (no public API)

The GitHub Pages build uses static snapshot files from `src/data/demo/`.
This lets users explore the app without backend credentials and without changing the backend query window.

To refresh the demo snapshot from a local backend session:

```bash
npm run build:demo-data
```

Optional custom window:

```bash
python3 scripts/build_demo_snapshot.py --start-year 2025 --end-year 2025 --months 1,2,3,4,5,6
```

### 1. Build the Pages output into `docs/`

```bash
npm run build:docs
```

This command builds the Observable site into `docs/` and writes `docs/.nojekyll` so folders such as `_observablehq` and `_npm` are served correctly by GitHub Pages.

### 2. Commit and push

```bash
git add docs src/data/demo package.json observablehq.config.js
git commit -m "Build docs site for GitHub Pages"
git push origin main
```

### 3. Set Pages source in GitHub

In GitHub repository settings:

- **Settings** -> **Pages**
- **Build and deployment**: **Deploy from a branch**
- **Branch**: `main`
- **Folder**: `/docs`

After that, GitHub Pages serves the dashboard from the contents of `docs/`.

### Backend note for public clones

The GitHub Pages site runs in static demo mode by default.
For full local app functionality after cloning, provide users with temporary `.env` credentials and a temporary SSH key, then follow the setup steps in this README (`make temp` + `.env` in repo root + `make app`).

## Documentation

### 1. [User Guide & Domain Logic](src/USER_GUIDE.md) 👈 *Start Here for Context*
*   **Key Terms:** What are PJM, LMP, retail rates, and price spreads?
*   **How to Use the Tool:** Navigating the interface and interpreting visualizations.
*   **Workflow:** Steps to compare historical wholesale and retail prices.

### 2. [Technical Setup & Data Ingestion](src/SETUP.md) 👈 *Start Here for Building the Infrastructure*
*   **Environment Preparation:** Building the Conda and npm environment required by `make app`.
*   **Backend Connectivity:** Setting up `.env` keys and SSH tunnel assumptions.
*   **Infrastructure Notes:** Understanding what is required beyond basic app startup.

### 3. [Architecture Overview](src/ARCHITECTURE.md)
*   **Runtime Flow:** How the frontend, backend, Makefile, and database interact.
*   **Project Layout:** Where the main application components live.
*   **Current Boundaries:** What is fully documented versus still evolving.

---

## Feedback & Contact

Feedback and suggestions are welcome. Please send your thoughts to:

Please email **Ben Darby** @ darby.b@northeastern.edu