# DS5500 - Capstone, Spring 2026

## Project Goal and Overview

**To provide transparency in electricity pricing.**

The Electricity Retail/Wholesale Comparison Tool is designed to enable users to visualize and compare wholesale electricity prices (LMPs) with retail utility rates. By automating the comparison process, users can easily identify trends, price spreads, and regional variations, ultimately facilitating informed decision-making in energy trading. This tool bridges the gap between volatile wholesale electricity prices and fixed retail rates by automating the comparison of aggregated LMPs against utility standard offer rates, enhancing transparency and understanding of market dynamics.

# PJM ISO Retail Electricity Service Provider Territories 

<div align="center">
  <img src="docs/dashboard.png" alt="Retail Service Territories" width="600">
  <p><em>This map visualizes the physical territory served by Electric Service Providers within the PJM footprint</em></p>
</div>

## Quick Start Guide
*Prerequisites: Git, Miniconda, Node.js 18+, npm, OpenSSH.*

### 1. Clone the repository

```bash

git clone https://github.com/nucapstone/project-spring26-darbyatNE.git

```

### 2. Create the Conda environment and NPM dependencies

```bash
cd electricity
conda env create -f environment.yml
conda activate lmp-lite
npm install
cd ..
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

Place the `.env` file you were sent privately in the /electrciity directory of the cloned repository (the same directory as `README.MD` and `makefile`). The required credentials are already included there.

### 5. Run the Application

With either the AWS Key or a Temp Key Installed, startup the app from the project root with the following terminal command:

```bash
make app
```

## Documentation

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