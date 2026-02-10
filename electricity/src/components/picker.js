// src/components/picker.js
 
import * as d3 from "npm:d3";

// import { formatDateForInput } from "../utils/formatters.js";

export function dateTimeRangePicker(options = {}) {
  const {
    width = 800,
    height = 400,
    initialStartTime = 0,
    initialEndTime = 24,
    initialStartDate = new Date(), 
    initialEndDate = new Date(),
    initialDaysOfWeek = [true, true, true, true, true, true, true],
    // ⚠️ CHANGED: Now accepts two lists
    activeConstraints = [], 
    allConstraints = [],
    initialConstraint = ""
  } = options;

  const container = d3.create("div")
    .style("font-family", "system-ui, -apple-system, sans-serif")
    .style("max-width", `${width}px`);
  
  function parseLocal(input) {
      if (!input) return new Date();
      if (typeof input === 'string') {
          const [y, m, d] = input.split('-').map(Number);
          return new Date(y, m - 1, d); 
      }
      if (input instanceof Date) {
          if (input.getUTCHours() === 0 && input.getUTCMinutes() === 0) {
               return new Date(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate());
          }
          return new Date(input.getFullYear(), input.getMonth(), input.getDate());
      }
      return new Date();
  }

  let startTime = Math.round(initialStartTime ?? 0);
  let endTime = Math.round(initialEndTime ?? 24);
  let startDate = parseLocal(initialStartDate);
  let endDate = parseLocal(initialEndDate);
  let daysOfWeek = [...(initialDaysOfWeek || [true, true, true, true, true, true, true])];
  let selectedConstraint = initialConstraint || "";
  let showAllConstraints = false; // Toggle State
  let savedFilters = [];

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const controlFrame = container.append("div")
    .style("background-color", "#f8f9fa") 
    .style("border", "1px solid #ddd")    
    .style("border-radius", "8px")
    .style("padding", "15px")
    .style("margin-bottom", "20px");

  // 1. Constraint Section
  const constraintSection = controlFrame.append("div").style("margin-bottom", "15px");
  
  // Header Row with Toggle
  const cHeader = constraintSection.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("margin-bottom", "5px");

  cHeader.append("label")
    .style("font-weight", "bold")
    .style("font-size", "13px")
    .text("Monitored Constraint");

  // Toggle Controls
  const toggleContainer = cHeader.append("div").style("font-size", "11px").style("display", "flex").style("gap", "10px");
  
  const addRadio = (label, value, checked) => {
      const wrapper = toggleContainer.append("label").style("cursor", "pointer").style("display", "flex").style("align-items", "center").style("gap", "3px");
      wrapper.append("input")
        .attr("type", "radio")
        .attr("name", "c-filter-mode")
        .property("checked", checked)
        .on("change", () => {
            showAllConstraints = (value === 'all');
            updateConstraintDropdown();
        });
      wrapper.append("span").text(label);
  };

  addRadio("Active Only", "active", true);
  addRadio("Show All", "all", false);

  const constraintSelect = constraintSection.append("select")
    .style("width", "100%")
    .style("padding", "6px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .on("change", function() { selectedConstraint = this.value; updateDisplay(); });

  function updateConstraintDropdown() {
      const list = showAllConstraints ? allConstraints : activeConstraints;
      // Ensure unique and sorted
      let displayList = [...new Set(list)].sort();
      
      // Always keep the "None" option
      if (displayList.length === 0 || displayList[0] !== "") displayList.unshift("");
      
      // Keep selected value if it exists in the new list, otherwise reset
      const currentVal = constraintSelect.property("value");
      
      const options = constraintSelect.selectAll("option").data(displayList, d => d);
      options.exit().remove();
      const enter = options.enter().append("option").attr("value", d => d).text(d => d === "" ? "-- Select Constraint --" : d);
      options.merge(enter).property("selected", d => d === selectedConstraint);
  }

  // Initial Render
  updateConstraintDropdown();


  // 2. Date Section
  const dateSection = controlFrame.append("div").style("margin-bottom", "15px");
  dateSection.append("label").style("font-weight", "bold").style("display", "block").style("margin-bottom", "5px").style("font-size", "13px").text("Date Range");
  const dateInputs = dateSection.append("div").style("display", "flex").style("gap", "10px").style("align-items", "center");

  const dateStyle = "flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;";
  const startDateInput = dateInputs.append("input").attr("type", "date").attr("value", formatDateForInput(startDate)).attr("style", dateStyle)
    .on("change", function() { startDate = parseLocal(this.value); updateDisplay(); });
  
  dateInputs.append("span").text("to");
  
  const endDateInput = dateInputs.append("input").attr("type", "date").attr("value", formatDateForInput(endDate)).attr("style", dateStyle)
    .on("change", function() { endDate = parseLocal(this.value); updateDisplay(); });

  // 3. Days Section
  const daysSection = controlFrame.append("div").style("margin-bottom", "15px");
  daysSection.append("label").style("font-weight", "bold").style("display", "block").style("margin-bottom", "5px").style("font-size", "13px").text("Days of Week");
  const daysContainer = daysSection.append("div").style("display", "flex").style("justify-content", "space-between").style("gap", "4px");
  const dayButtons = dayLabels.map((label, i) => {
    return daysContainer.append("button")
      .style("flex", "1")
      .style("padding", "6px 0")
      .style("border", "1px solid #007bff")
      .style("border-radius", "4px")
      .style("background-color", daysOfWeek[i] ? "#007bff" : "white")
      .style("color", daysOfWeek[i] ? "white" : "#007bff")
      .style("cursor", "pointer")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .text(label)
      .on("click", function() { 
          daysOfWeek[i] = !daysOfWeek[i]; 
          d3.select(this).style("background-color", daysOfWeek[i] ? "#007bff" : "white").style("color", daysOfWeek[i] ? "white" : "#007bff"); 
          updateDisplay(); 
      });
  });

  // 4. Time Section (Slider)
  const timeSection = controlFrame.append("div").style("margin-bottom", "15px");
  const timeHeaderBox = timeSection.append("div").style("display", "flex").style("justify-content", "space-between").style("margin-bottom", "5px");
  timeHeaderBox.append("label").style("font-weight", "bold").style("font-size", "13px").text("Time Range (Hour Ending)");
  const timeDisplay = timeHeaderBox.append("div").style("font-size", "13px").style("font-weight", "bold").style("color", "#007bff");

  const svgWidth = (width - 30) - 10; 
  const svgHeight = 45; 
  const margin = { top: 10, right: 15, bottom: 20, left: 15 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const svg = timeSection.append("svg").attr("width", svgWidth).attr("height", svgHeight);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const timeScale = d3.scaleLinear().domain([0, 24]).range([0, innerWidth]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(timeScale)
        .tickValues([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]) 
        .tickFormat(d => `${d}:00`)
    )
    .selectAll("text")
    .style("font-size", "10px")
    .style("color", "#666");

  g.append("line").attr("x1", 0).attr("x2", innerWidth).attr("y1", innerHeight / 2).attr("y2", innerHeight / 2).attr("stroke", "#ddd").attr("stroke-width", 4).attr("stroke-linecap", "round");
  const rangeRect = g.append("rect").attr("y", innerHeight / 2 - 2).attr("height", 4).attr("fill", "#007bff").attr("rx", 2);
  
  const createHandle = (cx) => g.append("circle").attr("cy", innerHeight / 2).attr("r", 8).attr("fill", "white").attr("stroke", "#007bff").attr("stroke-width", 2).attr("cursor", "ew-resize").attr("cx", cx);
  const startHandle = createHandle(timeScale(startTime)).call(d3.drag().on("drag", function(event) { 
      const newTime = Math.round(timeScale.invert(Math.max(0, Math.min(innerWidth, event.x)))); 
      if (newTime < endTime) { startTime = newTime; updateTimeSlider(); updateDisplay(); } 
  }));
  const endHandle = createHandle(timeScale(endTime)).call(d3.drag().on("drag", function(event) { 
      const newTime = Math.round(timeScale.invert(Math.max(0, Math.min(innerWidth, event.x)))); 
      if (newTime > startTime) { endTime = newTime; updateTimeSlider(); updateDisplay(); } 
  }));

  function updateTimeSlider() {
    const x1 = timeScale(startTime), x2 = timeScale(endTime);
    startHandle.attr("cx", x1); endHandle.attr("cx", x2);
    rangeRect.attr("x", x1).attr("width", x2 - x1);
  }

  // 5. Action Buttons
  const actionContainer = controlFrame.append("div").style("display", "flex").style("justify-content", "flex-end").style("gap", "10px").style("margin-top", "20px").style("padding-top", "15px").style("border-top", "1px solid #eee");

  actionContainer.append("button").style("padding", "8px 16px").style("background-color", "white").style("color", "#333").style("border", "1px solid #ccc").style("border-radius", "4px").style("font-size", "13px").style("cursor", "pointer").text("Save Filter").on("click", saveFilter);
  
  actionContainer.append("button").style("padding", "8px 20px").style("background-color", "#007bff").style("color", "white").style("border", "none").style("border-radius", "4px").style("font-weight", "bold").style("font-size", "13px").style("cursor", "pointer").text("Apply & Load Data")
    .on("click", function() {
        container.node().dispatchEvent(new CustomEvent('apply', { detail: getCurrentFilter(), bubbles: true }));
    });

  // 6. Saved Filters
  const savedSection = container.append("div").style("margin-top", "15px").style("border-top", "1px solid #eee").style("padding-top", "15px");
  savedSection.append("h4").style("margin", "0 0 10px 0").style("font-size", "13px").style("color", "#666").text("Saved Filters");
  const savedList = savedSection.append("div").style("display", "flex").style("flex-direction", "column").style("gap", "8px");

  function formatDateForInput(date) {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  function formatTime(hours) { return `${Math.floor(hours).toString().padStart(2, '0')}:00`; }

  function getCurrentFilter() {
    return {
      startDate: formatDateForInput(startDate),
      endDate: formatDateForInput(endDate),
      startTime: startTime, endTime: endTime, daysOfWeek: [...daysOfWeek],
      selectedConstraint: selectedConstraint || null
    };
  }

  function updateDisplay() {
    timeDisplay.text(`${formatTime(startTime)} - ${formatTime(endTime)}`);
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
    if (savedFilters.length === 0) { savedList.append("div").style("color", "#999").style("font-size", "12px").style("font-style", "italic").text("No saved filters"); return; }
    
    savedFilters.forEach((filter, index) => {
      const row = savedList.append("div").style("display", "flex").style("justify-content", "space-between").style("align-items", "center").style("padding", "8px").style("background", "#f8f9fa").style("border-radius", "4px").style("font-size", "12px");
      row.append("span").html(`<b>${filter.startDate}</b> (${filter.startTime}-${filter.endTime})`);
      const btns = row.append("div").style("display", "flex").style("gap", "5px");
      btns.append("button").text("Load").style("border","1px solid #ccc").style("background","white").style("cursor","pointer").on("click", () => loadFilter(filter));
      btns.append("button").text("×").style("border","none").style("color","red").style("background","none").style("cursor","pointer").style("font-weight","bold").on("click", () => { savedFilters = savedFilters.filter(f => f.id !== filter.id); updateSavedList(); });
    });
  }

  function loadFilter(filter) {
    startDate = parseLocal(filter.startDate);
    endDate = parseLocal(filter.endDate);
    startTime = filter.startTime; endTime = filter.endTime; daysOfWeek = [...filter.daysOfWeek];
    selectedConstraint = filter.selectedConstraint || "";
    
    startDateInput.property("value", formatDateForInput(startDate)); 
    endDateInput.property("value", formatDateForInput(endDate));
    constraintSelect.property("value", selectedConstraint);
    dayButtons.forEach((btn, i) => { d3.select(btn).style("background-color", daysOfWeek[i] ? "#007bff" : "white").style("color", daysOfWeek[i] ? "white" : "#007bff"); });
    updateTimeSlider(); updateDisplay();
  }

  updateTimeSlider(); updateDisplay(); updateSavedList();
  return container.node();
}
