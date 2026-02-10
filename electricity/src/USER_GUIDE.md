## Key Terms & Acronyms
*Essential vocabulary for understanding the domain logic of this application.*

| Acronym / Term | Full Name | What it is & Why it matters |
| :--- | :--- | :--- |
| **PJM** | **Pennsylvania-New Jersey-Maryland** | **The Grid Operator.**  PJM is the Regional Transmission Organization (RTO) that orchestrates the Day-Ahead and Real-Time energy auctions between hundreds of member companies 24/7. Though named for its original footprint (plus Delaware), it is now the largest RTO in the U.S., serving 65 million people across 13 states and D.C. <br><br> Congestion Management: PJM balances the grid by "splitting" LMP prices. This pricing mechanism intentionally encourages or discourages generation at specific locations to reduce flow on constrained transmission lines. <br><br> Relevance: Our app visualizes the financial impact of PJM's congestion management, specifically tracking the volatile price differences that emerge when grid constraints force Day-Ahead and Real-Time prices to deviate from the unconstrained, lowest-cost ideal. |
| **DA / RT** | **Day-Ahead / Real-Time** | **Two Settlement System.** <br>• **Day-Ahead (DA):** A *financial* market where prices are locked in as the plan about 8-12 hours in advance based of actual flow based on forecasts and the results of a daily market auction.<br>• **Real-Time (RT):** The *physical* spot market based on actual reality of grid conditions and the required actions PJM must take to ensure balance and reliability.<br> *Relevance:* Our tool compares the "Plan" (DA) vs. the "Reality" (RT) as "NET". |
| **NET** | **Real-Time less Day-Ahead** | **The Two Settlement Basis.** Calculated as the Real-Time price minus the Day-Ahead price (`RT - DA`). <br> *Relevance:* This reveals forecast error. A **positive NET** means Real-Time prices spiked higher than expected (under-forecasted). A **negative NET** means Real-Time prices dropped lower than the Day-Ahead commitment (over-forecasted). |
| **Congestion** | **Load Zone less Remote Zone** | **The "Traffic Jam" Premium.** Calculated as the price at your selected Load Zone (Sink) minus the price at a Remote Zone (Source). <br> *Relevance:* This highlights the cost of grid limitations. A **positive value (Red)** indicates that cheap power exists elsewhere but cannot reach your zone due to transmission constraints. |
| **ISO / RTO** | **Independent System Operator** | **The Referee.** A non-profit organization (like PJM) that runs the power grid and the market to ensure reliability and fair competition. <br> *Relevance:* Understanding that PJM is a neutral marketplace, not a utility company, explains why public data is available. |
| **AWS RDS** | **Amazon Relational Database Service** | **The Cloud Storage.** A managed SQL database service provided by Amazon. <br> *Relevance:* We use this to host our 9GB+ dataset, allowing the app to query millions of historical rows without crashing a local machine. |

---

## Using the Query Tool to Map Data
Access this page by clicking the **Filter** button on the main map.

> **⚠️ Important:** The map starts empty. You **must** use this tool to query and load data before any visualization will appear.

1. **Define Search Criteria:**
   * **Date Range** (*Required*): Select the historical period you want to analyze.
   * **Additional Filters** (*Optional*): Narrow your search by:
        * **Days of the Week**
        * **Hours of the Day**
        * **RT Transmission Constraint**.

2. **Save Filter:** (*Optional*): Click this button to store your current configuration, allowing you to quickly recall it for future queries.

3. **Map Data:** (*Required*): Click this button to initiate the data fetch and return to the main visualization. The map will populate with the historical **"Like Days"** that match your conditions.

---

## ⏳ Data Loading & Status
When returning to the map view with a query pending, the first thing you'll notice is the **Estimated Hours** counter. This is a preliminary calculation based on the full calendar duration selected.

When the **Fetch Operation** is complete, the **Actual Hours**—the specific count of historical intervals that matched your filter criteria—will overwrite the estimate.

---

## 🕹️ Map Controls & Time Navigation
Once the data loads, the map defaults to the **Average Price** view. Use the control bar at the bottom to navigate the data.

*   **📊 Average Price Button (Default):** This is the starting view. It aggregates *all* queried hours into a single static heatmap, showing you the "average" congestion pattern for your selected criteria.
*   **▶️ Animate Hours / ⏸️ Pause:** Starts the animation to cycle through the hours sequentially. Press pause to freeze the map on a specific timestamp for deeper analysis.
*   **⏱️ Hourly Slider:** Manually drag the scrubber to jump to a specific hour of the day.
*   **🚀 Speed Slider:** Adjusts how fast the animation plays (slow for analysis, fast for trends).

---

## 🗺️ How to Read the Map (The Legends)
The map uses two distinct color scales depending on which data mode you select.

### 1. Settlement Views (DA & RT)
**Uses Legend #1: The Absolute Spectrum**
This mode displays the total cost ($/MWh) using a full-spectrum heatmap.
*   **🟣 Purple:** **Negative Pricing.** Extreme generation surplus. The grid is paying resources to curtail power.
*   **🔵 Blue / 🟢 Green:** **Low to Moderate Price.** The "Normal" operating range ($0 - $30).
*   **🟠 Orange / 🔴 Red:** **High Price.** Significant congestion or peak demand ($50 - $100+).

### 2. Differential Views (NET & Congestion)
**Uses Legend #2: The Diverging Scale**
This mode compares two factors (like RT vs DA) and centers on **White** (Zero/Neutral).
*   **⚪ White:** **Neutral / Accurate.** The difference is near zero. The DA Plan nearly matched the RT Reality.
*   **🔴 Red Shades (Pink to Deep Red):** **Positive Delta.** The value is higher than the baseline.
    *   *In Net View:* RT price spiked higher than the DA plan (Bullish).
*   **🔵 Blue Shades (Light to Deep Blue):** **Negative Delta.** The value is lower than the baseline.
    *   *In Net View:* RT price crashed lower than the DA plan (Bearish).

---

## 📉 Data Panels & Details

### 📍 Zone List
Located on the side panel, this list displays all PJM zones.
*   **Color Matching:** The background color of each value corresponds exactly to that zone's color on the map.
*   **Precise Values:** While the map gives a visual heat check, this list provides the exact dollar value for the currently selected timestamp.

### ⚡ Active Constraints
This section lists the **Top 10 Transmission Constraints** affecting the grid for the current timestamp.
*   **The Constraint:** The specific transmission line or transformer that is "clogged."
*   **Shadow Price:** This value indicates the **severity** of the bottleneck. It represents the marginal savings the system would realize if that specific line could carry just 1 more MW of power.
    *   *Higher Shadow Price = More Severe Congestion.*
