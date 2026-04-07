# DS5500 - Capstone, Spring 2026

## Project Goal and Overview

**To provide transparency in electricity pricing.**

The Electricity Retail/Wholesale Comparison Tool is designed to enable users to visualize and compare wholesale electricity prices (LMPs) with retail utility rates. By automating the comparison process, users can easily identify trends, price spreads, and regional variations, ultimately facilitating informed decision-making in energy trading. This tool bridges the gap between volatile wholesale electricity prices and fixed retail rates by automating the comparison of aggregated LMPs against utility standard offer rates, enhancing transparency and understanding of market dynamics.

# PJM ISO Retail Electricity Service Provider Territories 

<div align="center">
  <img src="docs/retail service territories.png" alt="Retail Service Territories" width="600">
  <p><em>This map visualizes the physical territory served by Electric Service Providers with the PJM footprint</em></p>
</div>

## Quick Start Guide
*Prerequisites: Git, Miniconda, Node.js 18+, npm, OpenSSH.*

### 1. Clone the repository

```bash

git clone https://github.com/nucapstone/project-spring26-darbyatNE.git

```

### 2. Create the Conda environment and NPM dependencies

The Python environment definition already exists in [electricity/environment.yml](electricity/environment.yml).

```bash
cd electricity
conda env create -f environment.yml
conda activate lmp-lite
npm install
cd ..
```

### 3. Configure the SSH key used by the `Makefile`

The project `Makefile` already handles the SSH tunnel and app startup. By default it looks for the SSH private key at:

```bash
$HOME/.ssh/AWS-Echo-Key.pem
```

If your key is already saved there, you can go straight to `make app`.

If you were sent a temporary evaluation key privately, you have **two supported options**:

#### Option A — use the default path expected by the `Makefile`

Save the key as `~/.ssh/AWS-Echo-Key.pem`:

```bash
mkdir -p ~/.ssh
nano ~/.ssh/AWS-Echo-Key.pem
```

Then:

1. Paste the full private key contents into `nano`.
2. Save with `Ctrl + O`, press `Enter`, then exit with `Ctrl + X`.
3. Set the required permissions:

```bash
chmod 600 ~/.ssh/AWS-Echo-Key.pem
```

With the key at the default path, the existing `Makefile` works as-is:

```bash
make app
```

#### Option B — keep a different key filename and override `SSH_KEY_PATH`

If you prefer to save the temporary key under another name such as `~/.ssh/prof_eval_key`, run:

```bash
mkdir -p ~/.ssh
nano ~/.ssh/prof_eval_key
chmod 600 ~/.ssh/prof_eval_key
make app SSH_KEY_PATH=$HOME/.ssh/prof_eval_key
```

### 4. Save the provided `.env` file at the repository root

Place the `.env` file you were sent privately in the root of the cloned repository (the same directory as `README.MD` and `makefile`). The required credentials are already included there.

### 5. Run the Application

From the project root:

```bash
make app
```

The `Makefile` will:

- verify the SSH key path,
- clear the required ports (`3000`, `8000`, `5433`, `8001`),
- start the SSH tunnel to the backend database,
- launch the frontend and backend development servers.

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