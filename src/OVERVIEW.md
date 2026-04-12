---
title: Project Overview & Findings
toc: true
---

# Project Overview & Findings

This project compares **retail electricity prices** with **aggregated wholesale PJM prices** across service territories.

The main deliverable is an interactive dashboard that helps users inspect:

- where retail service territories are located,
- which wholesale pricing points are associated with each territory,
- how average prices compare across territories, and
- how those comparisons change over time.

## 1. What this repository contains

The repository has three main layers:

| Area | Purpose |
| :--- | :--- |
| `src/` | Observable dashboard pages, UI components, styles, and documentation pages |
| `api/` | FastAPI backend used for local live data access |
| `src/hydrate/` | Data preparation, maintenance, and supporting scripts |

For a quick local run, see [Setup / Environment](./SETUP).
For the system structure, see [System Architecture](./ARCHITECTURE).

## 2. Major findings

This repository is designed to make a few core findings reproducible and inspectable:

1. **There are clear anomalies in the relationship between standard-offer retail electricity rates and their wholesale costs.**
   The dashboard makes it possible to compare territory-level retail rates against grouped wholesale LMP values and shows that the relationship is not uniform across the PJM footprint.

2. **Those anomalies appear both within and between service territories.**
   Neighboring territories and territory-linked wholesale point groups can behave differently even when they are part of the same larger market context.

3. **The observed pricing mismatches deserve deeper investigation.**
   The project demonstrates that the differences are real and visible in the data, but it should be understood as a transparency and exploration tool rather than a final causal explanation of why those anomalies occur.

Taken together, the reported result is not simply that prices differ, but that there are meaningful retail-versus-wholesale irregularities across territory groupings that merit follow-up analysis into root causes.

## 3. Demo site versus full local run

The GitHub Pages version of this project is a **static demo** built from a snapshot in `src/data/demo/`.

That site is intended to let readers:

- understand the dashboard layout,
- inspect the visual design,
- explore the interaction model, and
- see a reproducible example dataset.

The full local workflow adds:

- live backend access,
- credentialed database connectivity,
- SSH tunnel setup, and
- the ability to refresh or regenerate the underlying data products.

## 4. Challenges encountered

Several practical constraints shaped the final design:

1. **Backend permissions had to support both storage and timely access.**
   A major challenge was configuring backend/database permissions so the project could store the required data products while still allowing access without significant delay in local runtime use.

2. **Finding the correct representative LMPs for each service-territory grouping was non-trivial.**
   The dashboard depends on mapping service territories to the appropriate wholesale pricing points, and that matching problem required substantial data-preparation work before the visualization could be trusted.

3. **The PJM API limits made historical data collection slow and operationally difficult.**
   The API allows only six requests per minute and no more than 50,000 rows per query result, which fills quickly when collecting hourly wholesale data across several hundred LMPs over a six-year period.

4. **Older data was especially expensive to retrieve.**
   For data older than two years, filtered queries were not sufficient; in practice, the workflow had to retrieve the full 13,188 LMP records and then filter locally for the subset needed.

5. **Those infrastructure limits directly shaped the final architecture.**
   They pushed the project toward staged data hydration, database-backed storage, grouped representative pricing points, and a split between a public static demo and a credentialed full local run.

## 5. Recommended reading order

If you are new to the repository, use this order:

1. [User Guide](./USER_GUIDE) for how to interpret the dashboard.
2. [Setup / Environment](./SETUP) for local execution.
3. [Pipeline & Reproducibility](./PIPELINE) for how the data and results are assembled.
4. [System Architecture](./ARCHITECTURE) for implementation details.

## 6. Reproducibility note

The repository supports two levels of reproducibility:

- **Static demo reproducibility** through the checked-in snapshot used by GitHub Pages.
- **Full local reproducibility** through the credentialed local runtime described in the setup and pipeline documentation.

This page is intended as the front-facing summary of what the project does, what it found, and how to interpret the repository contents.