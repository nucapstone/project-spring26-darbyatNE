# Plan.md for Electricity / PJM Price Transparency Tool

## Approach
- **Technical Objectives**: Develop a web-based visualization tool to automate comparison of wholesale PJM LMPs against retail utility standard offer rates, enabling transparent analysis of price spreads, trends, and regional variations.
- **Backend Development**: Use Python (FastAPI) and PostgreSQL (AWS Lightsail) to fetch/aggregate LMP data from PJM's Data Miner 2 API, integrate CEEPR retail rate data, and implement custom averaging for retail territories via EIA Open Data API geospatial mapping (e.g., ZIP code alignment with PJM load zones).
- **Frontend and Visualization**: Build with React.js and libraries like D3.js/Plotly for interactive charts, maps, and dashboards displaying spreads, LMP components (energy/congestion/losses), and predictive models.
- **Unique Contributions**: As a new project extending CEEPR's manual data collection, this adds automated wholesale-retail pairings and visualization capabilities, with stretch goals for multi-region expansion, economic context (e.g., natural gas prices), and predictive modeling—sequenced post-PJM validation.
- **Accessibility**: Technical details use standard tools (RESTful APIs, pandas for data processing, open-source libs) putting many classroom taught principles into action.

### Key Challenges and Considerations
To ensure realistic planning, the following unresolved challenges have been identified that may impact implementation:
- **Challenge #1: Visual Mapping of Retail Service Territories**: Mapping the territories of all retail service companies tracked by CEEPR in a visual way is feasible using EIA's Electric Retail Service Territories dataset (shapefiles for geospatial boundaries), which can be visualized in the frontend. However, data gaps for smaller providers, potential overlaps, and integration effort with PJM zones must be addressed through cross-referencing and supplementation.
- **Challenge #2: Consistent Separation of Retail Bill Items**: Isolating the "retail energy" cost (e.g., generation/supply charges) from retail bills for direct comparison to wholesale LMPs is possible for many providers via rate schedule parsing, but inconsistency in bundling (e.g., generation mixed with T&D) may require estimation or manual validation. We'll develop a reproducible algorithm to extract relevant PJM wholesale components and calculate the avg per KWhr charges on the target rate class.
- **Challenge #3: Identifying Retail Classes for Comparison**: We'll focus on residential retail class for initial comparisons, starting with Residential (e.g., Delmarva's Residential Time-of-Use Rates, with on-peak/off-peak structures). Retail likely represents the majority of customers and aligns with LMP volatility. 

## Project Management
### Milestones 
- **Milestone 1: Data Integration Setup (Weeks 1-2)**  
  - **Roles**: Coordinate API integrations and initial data fetches; CEEPR Team (Stakeholders) – Provide retail rate data in CSV/Excel format.  
  - **Objectives**: Configure access to PJM Data Miner 2 API and EIA Open Data API; receive and validate CEEPR retail data; set up PostgreSQL database schema for storing LMPs, rates, and mappings.  
  - **Deliverables**: Database populated with sample data, API scripts tested for data pulls.

- **Milestone 2: Backend Development and Aggregation Logic (Weeks 3-5)**  
  - **Roles**: Develop FastAPI endpoints for data processing and custom averaging (e.g., spatial weighting for territories like City of Dover); optionally, involve class peers for code reviews.  
  - **Objectives**: Implement aggregation algorithms to compute average LMPs per retail territory; handle edge cases like mismatched zones via geospatial tools (e.g., lat/long to ZIP mapping).  
  - **Deliverables**: Functional backend API with endpoints for querying spreads; unit tests for aggregation accuracy.

- **Milestone 3: Frontend Visualization and UI (Weeks 6-8)**  
  - **Roles**: Build React.js components for charts (using Plotly/D3.js); CEEPR Team – Provide feedback on visualization requirements.  
  - **Objectives**: Create interactive dashboards for comparing wholesale-retail trends, isolating LMP components, and displaying regional maps.  
  - **Deliverables**: Deployable web app prototype; user-friendly interface for filtering by date, zone, or provider.

- **Milestone 4: Validation, Testing, and Stretch Goals (Weeks 9-10)**  
  - **Roles**: Conduct end-to-end testing and accuracy checks; CEEPR Team – Validate outputs against known spreads.  
  - **Objectives**: Test with real data; implement initial stretch features (e.g., natural gas integration); document code and results.  
  - **Deliverables**: Final tool with validated comparisons; GitHub repository with README; optional predictive model prototype.

### Timeline
- **Week 1**: Kickoff meeting with stakeholders; finalize data formats and API access.
- **Weeks 2-5**: Iterative development of backend and data processing (focus on aggregation logic).
- **Weeks 6-8**: Frontend build and integration testing.
- **Week 9**: Full system testing, bug fixes, and stakeholder demos.
- **Week 10**: Documentation, deployment to GitHub Pages, and project wrap-up.

### Risks
- **Data Access Delays**: CEEPR may take time to provide retail data or approve API keys, risking milestone slippage—mitigate by scheduling early data handoff and having backup synthetic data for testing.
- **API Limitations**: PJM or EIA APIs could have rate limits or data gaps—mitigate by caching data in PostgreSQL and implementing error handling.
- **Technical Complexity**: Custom averaging for small territories definitions may be abstract, confirm assumptions about ambiguities with stakeholders.
- **Scope Creep**: Stretch goals (e.g., predictive modeling) could extend timelines—therefire as directed PJM functionality will be prioritized first.
- **Challenge-Specific Risks**: Visual mapping may face incomplete territory data (mitigate via EIA supplements); bill item separation could be inconsistent (mitigate with estimation algorithms); retail class prioritization might need refinement based on CEEPR input (mitigate by starting simple and iterating).

## Stakeholder Involvement
Stakeholders (CEEPR Team: Zehra Khan, Steven Berit, Lauren Sidner, Brian Deese) will review and approve the proposal.md before project start. As team lead, Ben Darby is responsible for coordinating all meetings, including scheduling and agendas. The first stakeholder meeting will include the instructor if possible, to align on expectations and technical scope. For this non-official XN project, direct coordination with CEEPR will suffice.  Weekly check-ins via Zoom will be held as needed, with updates on milestones and demos for feedback. Stakeholders' input on data accuracy and visualization usability will be critical for validation.
