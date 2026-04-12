---
title: User Guide
toc: true
---

# User Guide

The completed dashboard helps users compare **retail electricity rates** with **aggregated wholesale PJM prices** across service territories and over time.

Use this guide to understand what the map is showing, how to use the controls, and how to interpret the legend and chart outputs.

## 1. What the dashboard does

The application brings together:

- retail service territory polygons,
- wholesale point markers associated with those territories,
- average-period and month-by-month comparisons,
- a synchronized legend for retail and wholesale values,
- a zone-level **Price Analysis** panel for selected territories.

This final project version is focused on **monthly comparison and visual interpretation**, not raw hourly trading operations.

## 2. Key terms

| Term | Meaning in this project | Why it matters |
| :--- | :--- | :--- |
| **PJM** | The regional transmission organization whose market data underlies the app | Provides the wholesale market context |
| **Retail Price** | Monthly utility/service-territory electricity rate | Colors the territory polygons in price view |
| **Wholesale Price** | Monthly aggregated PJM price associated with a service territory | Colors the wholesale point markers in price view |
| **Locational View** | A non-price orientation view | Helps users understand territory identity and geography |
| **Price View** | A value-based comparison view | Shows where retail and wholesale prices are higher or lower |
| **Avg Price View** | An average across the selected filter window | Useful for the big-picture summary |
| **Price Analysis Panel** | The chart that opens for selected territories | Used to compare retail and wholesale trends over time |

## 3. Main screen layout

The page is organized into five working areas:

1. **Header / Getting Started menu** for quick documentation access.
2. **Top control bar** for view mode and month filtering.
3. **Map and legend area** for the main visualization.
4. **Retail Territories sidebar** for zone lookup and selection.
5. **Bottom time controls** for average view, animation, speed, and month scrubbing.

The **Price Analysis** panel stays hidden until one or more territories are explicitly selected with sidebar checkboxes.

## 4. Recommended workflow

If you are using the tool for the first time, this is the easiest way to explore it:

1. Click **Selected Months →** and choose the year range and months you want to analyze.
2. Start in **Locational View** to orient yourself geographically.
3. Click the **Locational / Price View** label to switch into **Price View**.
4. Use the **Retail** and **Wholesale** checkboxes to compare either layer independently or together.
5. Use **Avg Price View** for the overall summary, or **Animate Months** / the time slider for month-by-month change.
6. Check territories in the sidebar to open the **Price Analysis** panel and compare selected zones over time.

## 5. Top controls

### View label

The label at the left side of the top bar is clickable.

- In **Locational View**, colors represent territory identity.
- In **Price View**, colors represent retail and wholesale value ranges.

### Retail / Wholesale checkboxes

These checkboxes control layer visibility independently:

- **Retail** toggles the service-territory polygons.
- **Wholesale** toggles the LMP point markers.

This lets you compare:

- retail only,
- wholesale only,
- or both layers together.

### Selected Months filter

Click the filter box to open the month/year picker.

You can change:

- the **start year**,
- the **end year**,
- the set of **months** included in the query.

After you click **Apply & Load Data**, the dashboard refreshes to the selected period and the current filter summary updates in the top bar.

## 6. Map behavior and interactions

### Service territory polygons

Clicking a territory will:

- select that zone,
- highlight its outline,
- synchronize the selection with the sidebar,
- show a popup in **Price View** with the current retail or wholesale value for the displayed period.

### Wholesale point markers

Clicking a wholesale point opens a popup.

Depending on the current view, the popup may show:

- location information such as node name, `pnode_id`, type, voltage, and coordinates, or
- current price information for the selected month or average period.

### Legend behavior

The legend updates automatically based on the current mode:

- **Locational View** shows territory identity colors.
- **Price View** shows the current retail and wholesale value bands.

## 7. Sidebar and territory selection

The **Retail Territories** sidebar lists service territories and includes a **PJM** overview row.

You can use it in two ways:

- **Click a row** to select and focus that territory on the map.
- **Check a row’s checkbox** to include that territory in the **Price Analysis** panel.

The sidebar colors stay synchronized with the active map view so the list remains visually connected to the map.

## 8. Bottom controls and time navigation

The bottom control bar includes:

- **Avg Price View**
- **Animate Months**
- **Speed** slider
- **month slider**
- **time display**

### Avg Price View

This returns the map to an aggregated view across the entire selected filter window.

### Animate Months

This steps through the loaded monthly sequence automatically so you can watch prices change over time.

### Month slider

This lets you manually scrub to a specific month in the selected time window.

### Speed slider

This controls how quickly the month animation advances.

## 9. Price Analysis panel

The **Price Analysis** panel is the chart view for detailed comparison.

Important behavior:

- it remains hidden until one or more sidebar checkboxes are selected,
- it appears when territories are explicitly added,
- **Clear Selection** removes all selected zones and hides the panel again,
- **×** closes the panel without removing the data state.

Use this panel when you want to compare multiple territories side by side across the selected months.

## 10. How to interpret the colors and values

### In Locational View

Colors identify territories, not value magnitude.

This mode is best for:

- learning where each service territory is located,
- seeing which wholesale points align with which territory,
- orienting yourself before switching into price comparison mode.

### In Price View

Colors represent value ranges.

As a general rule:

- **cooler / bluer tones** indicate lower values,
- **warmer / redder tones** indicate higher values,
- **gray or muted values** typically indicate missing or unavailable data.

Always read the legend together with the active filter window, since the scale updates to the currently displayed data.

## 11. Practical tips

- If the map looks unfamiliar, switch back to **Locational View** first.
- If you want a stable summary, use **Avg Price View**.
- If you want to see change through time, use **Animate Months** or drag the slider manually.
- If the chart is not visible, select one or more zones with the sidebar checkboxes.

## 12. Related project documents

- For environment and startup instructions, see [Setup / Environment](./SETUP).
- For the technical design of the application, see [System Architecture](./ARCHITECTURE).

This guide reflects the final capstone interface and should be treated as the source of truth for current UI behavior.

