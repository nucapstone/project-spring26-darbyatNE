# Project Name: Electricity / PJM Price Transparency Tool

## Team Lead: Ben Darby

### Focus
A web-based visualization tool to contextualize retail electricity prices with wholesale data, enabling transparent comparisons of trends and spreads.

### Stakeholders - The Center for Energy and Environmental Research (CEEPR) Team
- Zehra Khan
- Steven Berit
- Lauren Sidner
- Brian Deese

### Story
The gap between volatile wholesale electricity prices and fixed retail rates creates significant opacity for consumers and analysts, as retail charges often lag behind real-time grid conditions and fuel costs. In the PJM territory, stakeholders lack tools to easily compare trends in wholesale and retail prices over time and across regions.

This project develops a web-based visualization tool to transparently display wholesale-retail spreads, starting with PJM by automating comparison of aggregated LMPs against utility standard offer rates via mapping retail providers' territories to PJM load zones. PJM's API provides LMP data, but custom averaging methods may be needed for accurate utility-area pricing.

Stretch goals include prioritizing the expansion of this method to other RTO/ISO regions once it's fully working and validated in PJM, as well as isolating the different components of LMPs (e.g., energy, congestion, and losses) to compare against retail price breakdowns further down the road. Additional goals may encompass incorporating economic context, such as natural gas prices and heat rates, and adding predictive modeling for price forecasts, to be discussed and sequenced as the project progresses.

### Data
- **PJM Aggregated LMP**: PJM Data Miner 2 API
- **Utility Standard Offer Rates**: Provided by CEEPR sharing collected data
- **Service Territory Mapping**: EIA Open Data API, , geospatial mapping to ZIP codes for localized alignment with retail service territories (e.g., via latitude/longitude coordinates from )

### Additional Information
- **Technologies**: Python (FastAPI), PostgreSQL (Lightsail instance based), React.js, Data Visualization (e.g., Observable/D3.js, Plotly)
- **Communication**: As needed weekly meetings/checkins with stakeholders via Zoom
