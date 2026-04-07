# User Guide

This guide describes the **current checked-in interface** for the Electricity Retail/Wholesale Comparison Tool.

The app combines:

- retail service territory polygons,
- wholesale LMP point locations,
- average and month-by-month price views,
- animation controls and a time slider,
- a sidebar listing retail territories.

## 1. Key Terms

| Term | Meaning | Why it matters in this app |
| :--- | :--- | :--- |
| **PJM** | Pennsylvania-New Jersey-Maryland Interconnection | The regional transmission organization whose market data powers this application |
| **Retail Price** | Service-territory retail electricity price | Used to color the territory polygons in price view |
| **Wholesale Price** | Aggregated LMP-based wholesale price | Used to color the LMP point markers in price view |
| **Locational View** | A non-price territory map | Helps users orient themselves spatially |
| **Price View** | A value-based map view | Used to compare retail and wholesale pricing patterns |

## 2. Main Screen Layout

The main page has three primary areas:

1. a top control bar,
2. the map and legend area,
3. the **Retail Territories** sidebar on the right.

### Top Control Bar

The top controls currently include:

- **Price Type →** label: click this label to toggle between **Locational View** and **Price View**.
- **Retail** checkbox: shows or hides the retail territory polygons.
- **Wholesale** checkbox: shows or hides the wholesale LMP point markers.
- **Selected Months** box: opens the filter dialog.

## 3. Using the Selected Months Filter

Click the **Selected Months** box to open the filter modal.

This dialog controls the time window used to summarize the data shown on the map.

You can adjust:

- start year,
- end year,
- month selection.

When the filter is applied, the page URL is updated and the map reloads the corresponding data.

## 4. Locational View vs Price View

### Locational View

Locational View is the default startup mode.

In this view:

- each service territory is assigned a categorical territory color,
- wholesale points inherit territory-based coloring,
- the sidebar rows use matching territory colors,
- the legend reflects territory identity rather than price magnitude.

This view is intended for orientation and region identification.

### Price View

Click the **Price Type →** label to switch from Locational View into Price View.

In this view:

- service territory polygons are colored by **retail price**,
- wholesale point markers are colored by **wholesale price**,
- the legend changes to the active quantitative color scale,
- the sidebar rows stay synchronized with the active price coloring.

## 5. Retail and Wholesale Layer Checkboxes

The **Retail** and **Wholesale** checkboxes control layer visibility independently.

This lets you:

- show only retail polygons,
- show only wholesale points,
- show both layers together.

The wholesale checkbox controls the LMP point markers directly.

## 6. Map Interactions

### Service territory polygons

Clicking a service territory polygon will:

- select the territory,
- highlight its border,
- center or refocus the map,
- synchronize the selection with the sidebar row.

### Wholesale point markers

Clicking a wholesale LMP point opens a popup.

Depending on the current view, the popup shows either:

- **Locational details** such as node name, `pnode_id`, type, voltage, coordinates, and location context, or
- **Price information** for the selected period.

When the app is in **Avg Price View**, the popup shows the average price over the selected period.

When **Animate Months** is running or the timeline slider is moved to a specific month, the popup updates to match the month currently shown on screen.

## 7. Retail Territories Sidebar

The **Retail Territories** sidebar lists all service territories plus a **PJM** overview entry.

Current behavior:

- clicking a row selects and centers that territory,
- the selected row is visually highlighted,
- row background colors stay aligned with the current map coloring,
- row text automatically switches for contrast.

## 8. Bottom Controls

The bottom control bar includes:

- **Avg Price View**,
- **Animate Months**,
- **Speed** slider,
- timeline slider,
- time display readout.

### Avg Price View

This returns the map to an aggregated average across the currently selected time window.

### Animate Months

This steps through the loaded monthly sequence automatically.

### Time slider

This lets you manually move through the available month index.

### Speed slider

This controls the playback speed of the month animation.

## 9. How to Read the Map

### In Locational View

Colors identify territories rather than price magnitude.

Use this mode to understand:

- which territory is where,
- which points belong to which service territory,
- how the sidebar corresponds to the map.

### In Price View

Colors represent value ranges.

In general:

- **bluer tones** indicate lower values,
- **redder tones** indicate higher values,
- the legend should be used to interpret the current thresholds,
- retail polygons and wholesale points may occupy different value ranges even when displayed together.

## 10. Current Notes

This guide reflects the current interface in the repository.

If other project documents use older terminology, the actual on-screen UI labels and behaviors should be treated as the source of truth.
