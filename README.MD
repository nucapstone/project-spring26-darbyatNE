# DS5500 - Capstone, Spring 2026

## Project Goal and Overview

**To provide transparency in electricity pricing.**

The Electricity Retail/Wholesale Comparison Tool is designed to enable users to visualize and compare wholesale electricity prices (LMPs) with retail utility rates. By automating the comparison process, users can easily identify trends, price spreads, and regional variations, ultimately facilitating informed decision-making in energy trading. This tool bridges the gap between volatile wholesale electricity prices and fixed retail rates by automating the comparison of aggregated LMPs against utility standard offer rates, enhancing transparency and understanding of market dynamics.

# Electricity Retail/Wholesale Comparison Tool

<div align="center">
  <img src="src/img/Electricity_Comparison.png" alt="I will add an Electricity Retail/Wholesale Image when complete" width="600">
  <p><em>This interface visualizes the comparison between wholesale PJM LMPs and retail utility rates, allowing users to analyze price spreads and trends effectively.</em></p>
</div>

## Quick Start Guide
*Prerequisites: Node.js, npm, Conda, and Git installed.*

**To reproduce these results follow these step to Clone the repo, Create the environment to handle python libraries, Install npm to handle javascript packages and then Run the App:**
```bash
# Clone the repo
git clone https://github.com/nudataviz/electricity-price-comparison-tool
cd electricity-price-comparison-tool
# Create and activate the Conda environment
conda env create -f environment.yml
conda activate lmp-env
# Install npm package manager
npm install
# Run the app
npm run dev
```
---

## Documentation

*** ORIENTATION DOCUMENTS ARE PLANNED BUT NOT YET COMPLETE ***

### 1. [User Guide & Domain Logic](USER_GUIDE.md) 👈 *Start Here for Context*
*   **Key Terms:** What are PJM, LMP, retail rates, and price spreads?
*   **How to Use the Tool:** Navigating the interface and interpreting visualizations.
*   **Workflow:** Steps to compare historical wholesale and retail prices.

### 2. [Technical Setup & Data Ingestion](SETUP.md) 👈 *Start Here for Building the Infrastructure*
*   **Database:** Configuration for PostgreSQL on AWS Lightsail.
*   **Data Ingestion:** Running Python scripts to fetch PJM LMP data and retail rates.
*   **Environment Variables:** Setting up `.env` keys (PJM API, PostgreSQL credentials).

---

## Feedback & Contact

Feedback and suggestions are welcome. Please send your thoughts to:

**Ben Darby:** email - darby.b@northeastern.edu