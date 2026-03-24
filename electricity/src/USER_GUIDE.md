# User Guide

This guide explains the current user-facing workflow of the application as it exists in the repository today.

The app helps users compare retail service territories with wholesale locational price information by combining:

* service territory polygons,
* wholesale point locations,
* retail and wholesale monthly price views,
* a time slider and animation controls,
* a sidebar listing retail territories.

## 1. Key Terms

| Term | Meaning | Why it matters in this app |
| :--- | :--- | :--- |
| **PJM** | Pennsylvania-New Jersey-Maryland Interconnection | The regional transmission organization whose market and territory data drive this application |
| **Retail Price** | Utility or service-territory retail electricity price | Used to color the service territory polygons in price view |
| **Wholesale Price** | Aggregated LMP-based wholesale price | Used to color the point markers in price view |
| **Locational View** | Non-price categorical map coloring by territory/zone | Helps users distinguish territories spatially before switching to price mode |
| **Price View** | Quantitative coloring based on retail and wholesale values | Used to compare pricing patterns across territories and locations |

## 2. Main Screen Layout

The main map page has three primary areas:

1. A top control bar.
2. The map and legend area.
3. The right sidebar labeled **Retail Territories**.

### Top Control Bar

The top controls currently include:

* **Locational View / Price View** toggle: click the label box on the left to switch the overall map mode.
* **Retail** checkbox: shows or hides the retail territory polygons.
* **Wholesale** checkbox: shows or hides the wholesale point markers.
* **Selected Months** box: click this area to open the filter dialog.

## 3. Using the Selected Months Filter

Click the **Selected Months** box to open the filter modal.

This dialog controls the date range used to query and summarize the data shown in the map.

Users can adjust:

* start year,
* end year,
* month selection,
* additional date and time settings exposed by the picker.

When the filter is applied:

1. the current filter state is updated,
2. the display box in the header is refreshed,
3. the app reloads the page parameters,
4. the map data is reloaded for the selected period.

## 4. Locational View vs Price View

### Locational View

Locational View is the default startup mode.

In this view:

* each service territory is given a categorical map color,
* retail territory polygons are visible,
* wholesale points inherit matching territory colors,
* the sidebar rows in **Retail Territories** use the same territory colors as the map.

This view is primarily for orientation and territory identification.

### Price View

Click the **Locational View / Price View** label box to switch into Price View.

In this view:

* service territory polygons are colored by retail price,
* wholesale point markers are colored by wholesale price,
* the sidebar rows continue to match the active map colors,
* the legend changes to reflect the quantitative pricing scale.

The app currently switches the main map color mode between locational and retail-price coloring through this label-based toggle.

## 5. Retail and Wholesale Layer Checkboxes

The **Retail** and **Wholesale** checkboxes control layer visibility independently.

This means users can:

* show only the retail territory polygons,
* show only the wholesale points,
* show both together.

This is useful when comparing how retail territory shading lines up with the underlying wholesale point distribution.

## 6. Map Interactions

### Service territory polygons

Users can click a service territory polygon to:

* select that territory,
* highlight its border,
* center the map on that area,
* synchronize the selection with the sidebar row.

### Wholesale point markers

Hovering a wholesale point displays a popup with:

* service territory,
* node name,
* pnode ID,
* type,
* voltage,
* latitude and longitude,
* location context.

## 7. Retail Territories Sidebar

The **Retail Territories** sidebar lists all territories plus a PJM overview entry.

Current behavior:

* clicking a row selects and centers that territory,
* the selected row is visually outlined,
* row background colors match the active map colors,
* row text automatically switches between light and dark for contrast,
* territory rows include checkboxes used by the plot panel workflow.

The sidebar is designed to mirror the map rather than act as a separate legend.

## 8. Bottom Controls

The lower control bar includes:

* **Avg Price View** button,
* **Animate Months** button,
* **Speed** slider,
* timeline slider,
* time display readout.

### Avg Price View

This resets the view to an aggregated summary across the current query window.

### Animate Months

This starts stepping through the loaded time sequence automatically.

### Time slider

This allows users to manually move through the available time index.

### Speed slider

This controls the playback speed of the animation.

## 9. How to Read the Map

### In Locational View

Colors identify territories, not price magnitude.

The main purpose is spatial orientation:

* which territory is where,
* which wholesale points belong to which territory,
* how the sidebar rows correspond to map regions.

### In Price View

Colors represent price ranges.

In general:

* cooler colors indicate lower values,
* warmer colors indicate higher values,
* retail polygons and wholesale points may use different value ranges even when shown together.

Users should rely on the legend and the active layer combination when interpreting pricing patterns.

## 10. Current Notes

This guide reflects the checked-in interface today.

Some surrounding project documentation still contains earlier terminology from older versions of the app. When there is a mismatch, the actual UI labels in the application should be treated as the source of truth.
