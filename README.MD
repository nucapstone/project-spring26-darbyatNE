# DS5500 - Capstone, Spring 2026

> ## Project Name: Electricity
> 
> ## Team Lead: Ben Darby
> 
> ### Focus
> A web-based visualization tool to contextualize retail electricity prices with wholesale data, enabling transparent comparison of trends and spreads.
> 
> ### Stakeholders - Center for Energy and Environmental Research (CEEPR)
> - Zehra Khan
> - Steven Berit
> - Lauren Sidner
> - Brian Deese
> 
> ### Story
> The gap between volatile wholesale electricity prices and fixed retail rates creates significant opacity for consumers and analysts, as retail charges often lag behind real-time grid conditions and fuel costs. In the PJM territory, stakeholders lack tools to easily compare trends in wholesale and retail prices over time and across regions.
> 
> This project develops a web-based visualization tool to transparently display wholesale-retail spreads, starting with PJM by automating comparison of aggregated LMPs against utility standard offer rates—a significant effort involving mapping retail electricity providers with native territories to their corresponding PJM load zones. PJM provides LMP data via their API, but we may need to derive a method for calculating an average wholesale price for a utility service area/load zone to ensure accurate regional comparisons. Stretch goals include adding economic context (e.g., natural gas prices and heat rates), predictive modeling, and expansion to other RTO/ISO regions (prioritizing this once the method is working). Down the road, we would also be interested in isolating the different components of the LMPs to compare to the components of retail prices—we can discuss this as a stretch goal as we progress.
> 
> ### Data
> - **PJM Aggregated LMP**: [PJM Data Miner 2 API](https://dataminer2.pjm.com/)
> - **Utility Standard Offer Rates**: Provided by CEEPR sharing their collected data
> - **Natural Gas Prices (Stretch)**: [EIA Open Data API](https://www.eia.gov/opendata/), Series: NG.RNGWHHD.W (Henry Hub) and regional citygates
> - **Heating Degree Days (Stretch)**: [NOAA Climate Data API](https://www.ncdc.noaa.gov/cdo-web/)
> 
> ### Additional Information
> - **Technologies**: Python (FastAPI), PostgreSQL (Lightsail instance based), React.js, Data Visualization (e.g., Observable, Plotly)
> - **Communication**: As needed weekly meetings/checkins with stakeholders via Zoom
