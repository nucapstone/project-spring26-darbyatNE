// src/components/picker.js

import * as d3 from "npm:d3";

export function dateTimeRangePicker(options = {}) {
  const {
    width = 800,
    // Year Configuration
    minYear = 2020,
    maxYear = 2026,
    initialStartYear = 2020,
    initialEndYear = 2026,
    // Month Configuration (Array of indices 0-11 that are selected)
    initialMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] 
  } = options;

  const container = d3.create("div")
    .style("font-family", "system-ui, -apple-system, sans-serif")
    .style("max-width", `${width}px`);

  // --- State Management ---
  let startYear = Math.max(minYear, initialStartYear);
  let endYear = Math.min(maxYear, initialEndYear);
  
  // Create boolean array for 12 months. Default to true if index is in initialMonths
  let selectedMonths = Array(12).fill(false);
  if (initialMonths && Array.isArray(initialMonths)) {
      initialMonths.forEach(idx => {
          if (idx >= 0 && idx <= 11) selectedMonths[idx] = true;
      });
  } else {
      selectedMonths.fill(true);
  }

  let savedFilters = [];

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // --- UI Construction ---
  const controlFrame = container.append("div")
    .style("background-color", "#f8f9fa")
    .style("border", "1px solid #ddd")
    .style("border-radius", "8px")
    .style("padding", "20px")
    .style("margin-bottom", "20px");

  // 1. Month Selector Section (Replaces Days of Week)
  const monthSection = controlFrame.append("div").style("margin-bottom", "25px");
  monthSection.append("label")
    .style("font-weight", "bold")
    .style("display", "block")
    .style("margin-bottom", "8px")
    .style("font-size", "13px")
    .text("Select Months");

  const monthsContainer = monthSection.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(6, 1fr)") // 2 rows of 6
    .style("gap", "8px");

  const monthButtons = monthLabels.map((label, i) => {
    return monthsContainer.append("button")
      .style("padding", "8px 0")
      .style("border", "1px solid #007bff")
      .style("border-radius", "4px")
      .style("background-color", selectedMonths[i] ? "#007bff" : "white")
      .style("color", selectedMonths[i] ? "white" : "#007bff")
      .style("cursor", "pointer")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("transition", "all 0.2s")
      .text(label)
      .on("click", function() {
        selectedMonths[i] = !selectedMonths[i];
        const isActive = selectedMonths[i];
        d3.select(this)
          .style("background-color", isActive ? "#007bff" : "white")
          .style("color", isActive ? "white" : "#007bff");
        updateDisplay();
      });
  });

  // 2. Year Slider Section (Replaces Hourly Slider)
  const yearSection = controlFrame.append("div").style("margin-bottom", "15px");
  const yearHeaderBox = yearSection.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("margin-bottom", "10px");
  
  yearHeaderBox.append("label")
    .style("font-weight", "bold")
    .style("font-size", "13px")
    .text("Year Range");
    
  const yearDisplay = yearHeaderBox.append("div")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .style("color", "#007bff");

  // D3 Slider Setup
  const svgWidth = (width - 40); // padding adjustment
  const svgHeight = 50;
  const margin = { top: 10, right: 20, bottom: 20, left: 20 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const svg = yearSection.append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scale for Years (Linear)
  const yearScale = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([0, innerWidth])
    .clamp(true);

  // Axis
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(yearScale)
      .ticks(maxYear - minYear) // One tick per year
      .tickFormat(d3.format("d")) // Remove comma (2,020 -> 2020)
    )
    .selectAll("text")
    .style("font-size", "11px")
    .style("color", "#666");

  // Slider Track
  g.append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", innerHeight / 2)
    .attr("y2", innerHeight / 2)
    .attr("stroke", "#e9ecef")
    .attr("stroke-width", 6)
    .attr("stroke-linecap", "round");

  // Selected Range Bar
  const rangeRect = g.append("rect")
    .attr("y", innerHeight / 2 - 3)
    .attr("height", 6)
    .attr("fill", "#007bff")
    .attr("rx", 3);

  // Handle Logic
  const createHandle = (cx) => g.append("circle")
    .attr("cy", innerHeight / 2)
    .attr("r", 9)
    .attr("fill", "white")
    .attr("stroke", "#007bff")
    .attr("stroke-width", 2)
    .attr("cursor", "ew-resize")
    .attr("cx", cx)
    .style("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.1))");

  const startHandle = createHandle(yearScale(startYear))
    .call(d3.drag().on("drag", function(event) {
      const val = yearScale.invert(event.x);
      const snapped = Math.round(val); // Snap to integer year
      if (snapped < endYear && snapped >= minYear) {
        startYear = snapped;
        updateSliderVisuals();
        updateDisplay();
      }
    }));

  const endHandle = createHandle(yearScale(endYear))
    .call(d3.drag().on("drag", function(event) {
      const val = yearScale.invert(event.x);
      const snapped = Math.round(val); // Snap to integer year
      if (snapped > startYear && snapped <= maxYear) {
        endYear = snapped;
        updateSliderVisuals();
        updateDisplay();
      }
    }));

  function updateSliderVisuals() {
    const x1 = yearScale(startYear);
    const x2 = yearScale(endYear);
    
    startHandle.attr("cx", x1);
    endHandle.attr("cx", x2);
    rangeRect
      .attr("x", x1)
      .attr("width", x2 - x1);
  }

  // 3. Action Buttons
  const actionContainer = controlFrame.append("div")
    .style("display", "flex")
    .style("justify-content", "flex-end")
    .style("gap", "10px")
    .style("margin-top", "20px")
    .style("padding-top", "15px")
    .style("border-top", "1px solid #eee");

  actionContainer.append("button")
    .style("padding", "8px 16px")
    .style("background-color", "white")
    .style("color", "#333")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("font-size", "13px")
    .style("cursor", "pointer")
    .text("Save Filter")
    .on("click", saveFilter);

  actionContainer.append("button")
    .style("padding", "8px 20px")
    .style("background-color", "#007bff")
    .style("color", "white")
    .style("border", "none")
    .style("border-radius", "4px")
    .style("font-weight", "bold")
    .style("font-size", "13px")
    .style("cursor", "pointer")
    .text("Apply & Load Data")
    .on("click", function() {
      container.node().dispatchEvent(new CustomEvent('apply', { detail: getCurrentFilter(), bubbles: true }));
    });

  // 4. Saved Filters Section
  const savedSection = container.append("div")
    .style("margin-top", "15px")
    .style("border-top", "1px solid #eee")
    .style("padding-top", "15px");
    
  savedSection.append("h4")
    .style("margin", "0 0 10px 0")
    .style("font-size", "13px")
    .style("color", "#666")
    .text("Saved Filters");
    
  const savedList = savedSection.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "8px");

  // --- Helpers ---

  function getCurrentFilter() {
    // Return indices of selected months
    const activeMonthIndices = selectedMonths
        .map((isSelected, index) => isSelected ? index : -1)
        .filter(index => index !== -1);

    return {
      startYear,
      endYear,
      months: activeMonthIndices,
      // Metadata for UI restoration
      _fullMonthState: [...selectedMonths] 
    };
  }

  function updateDisplay() {
    yearDisplay.text(`${startYear} — ${endYear}`);
    // Dispatch event for live updates if needed
    container.node().dispatchEvent(new CustomEvent('filterchange', { detail: getCurrentFilter(), bubbles: true }));
  }

  function saveFilter() {
    const filter = getCurrentFilter();
    filter.id = Date.now();
    savedFilters.push(filter);
    updateSavedList();
  }

  function updateSavedList() {
    savedList.selectAll("*").remove();
    
    if (savedFilters.length === 0) {
      savedList.append("div")
        .style("color", "#999")
        .style("font-size", "12px")
        .style("font-style", "italic")
        .text("No saved filters");
      return;
    }

    savedFilters.forEach((filter) => {
      const row = savedList.append("div")
        .style("display", "flex")
        .style("justify-content", "space-between")
        .style("align-items", "center")
        .style("padding", "10px")
        .style("background", "#f8f9fa")
        .style("border-radius", "4px")
        .style("font-size", "12px");

      const monthCount = filter.months.length;
      const monthText = monthCount === 12 ? "All Months" : `${monthCount} Months`;

      row.append("span")
        .html(`<b>${filter.startYear}-${filter.endYear}</b> <span style="color:#666; margin-left:5px">(${monthText})</span>`);

      const btns = row.append("div").style("display", "flex").style("gap", "5px");
      
      btns.append("button")
        .text("Load")
        .style("border", "1px solid #ccc")
        .style("background", "white")
        .style("cursor", "pointer")
        .style("border-radius", "3px")
        .on("click", () => loadFilter(filter));
        
      btns.append("button")
        .text("×")
        .style("border", "none")
        .style("color", "#dc3545")
        .style("background", "none")
        .style("cursor", "pointer")
        .style("font-weight", "bold")
        .style("font-size", "14px")
        .on("click", () => {
          savedFilters = savedFilters.filter(f => f.id !== filter.id);
          updateSavedList();
        });
    });
  }

  function loadFilter(filter) {
    startYear = filter.startYear;
    endYear = filter.endYear;
    
    // Restore month selection
    if (filter._fullMonthState) {
        selectedMonths = [...filter._fullMonthState];
    } else {
        // Fallback if loading from simple index array
        selectedMonths.fill(false);
        filter.months.forEach(idx => selectedMonths[idx] = true);
    }

    // Update UI Elements
    monthButtons.forEach((btn, i) => {
      const isActive = selectedMonths[i];
      d3.select(btn)
        .style("background-color", isActive ? "#007bff" : "white")
        .style("color", isActive ? "white" : "#007bff");
    });

    updateSliderVisuals();
    updateDisplay();
  }

  // Initialize
  updateSliderVisuals();
  updateDisplay();
  updateSavedList();

  return container.node();
}
