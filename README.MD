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

- If you need full local access, request the **temporary private SSH key** from the repository owner. You can then install it with a single copy/paste block:

```bash
make temp <<'EOF'
-----BEGIN OPENSSH PRIVATE KEY-----
[paste the full private key here exactly as provided]
-----END OPENSSH PRIVATE KEY-----
EOF
```

> Use the full private key block as provided.

### 4. Save the provided `.env` file at the repository root

If you need full local access, request the `.env` file from the repository owner and place it in the cloned repository root (the same directory as `README.MD`, `makefile`, and `package.json`). The required credentials are expected to be included there.

### 5. Run the Application

With either the AWS Key or a Temp Key Installed, startup the app from the project root with the following terminal command:

```bash
make app
```

## GitHub Pages (docs folder)

This repository is configured to publish the static frontend from `docs/`.

> **Note for GitHub Pages visitors:** The data shown on the hosted site is a static demo/sample snapshot.
> To access the full live workflow and backend-connected data retrieval, you must clone the repository and request the `.env` file and temporary private SSH key from the repository owner.


## Documentation

The most useful reading order is:

1. [Project Overview & Findings](src/OVERVIEW.md)
2. [Setup / Environment](src/SETUP.md)
3. [User Guide & Domain Logic](src/USER_GUIDE.md)

### 1. [Project Overview & Findings](src/OVERVIEW.md) 👈 *Start Here for General Context*
*   **Front-facing summary:** What the project does, what is in the repository, and what the main results mean.
*   **Major findings:** The main comparison takeaways the dashboard is designed to make visible.
*   **Challenges:** The main practical constraints that shaped the final implementation.

### 2. [Setup / Environment](src/SETUP.md) 👈 *Start Here for Reproducing Results*
*   **Environment preparation:** Conda, npm, credentials, and SSH key setup.
*   **Runtime flow:** How frontend, backend, and database interact in local mode.
*   **Reproducibility:** Static demo snapshot workflow and full local workflow in one place.

### 3. [User Guide & Domain Logic](src/USER_GUIDE.md) 👈 *Start Here for Interface Context*
*   **Key Terms:** What are PJM, LMP, retail rates, and price spreads?
*   **How to Use the Tool:** Navigating the interface and interpreting visualizations.
*   **Workflow:** Steps to compare historical wholesale and retail prices.

## Attribution

This project depends on a combination of public data, mapping tools, and open-source libraries.

- **CEEPR** provdies the retail service territory standard offer rates.
- **PJM-derived market data** provides the wholesale market context used throughout the dashboard.
- **OpenStreetMap contributors** are an underlying source for some geographic reference materials used during data preparation workflows.
- **MapTiler** provides the basemap style used by the interactive map.
- **Observable Framework**, **FastAPI**, **SQLAlchemy**, **D3**, and **MapLibre GL** provide the main application and visualization infrastructure.

---

## Feedback & Contact

Feedback and suggestions are welcome. Please send your thoughts to:

Please email **Ben Darby** @ darby.b@northeastern.edu