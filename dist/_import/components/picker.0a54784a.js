import * as d3 from "../../_npm/d3@7.9.0/e780feca.js";

console.log("✅ picker.js loaded (Callback Version)");

export function dateTimeRangePicker(options = {}) {
  const {
    width = 800,
    minYear = 2020,
    maxYear = 2026,
    initialStartYear = 2025,
    initialEndYear = 2025,
    initialMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // NEW: Direct callbacks
    onInput = null, 
    onApply = null
  } = options;

  const container = d3.create("div")
    .style("font-family", "system-ui, -apple-system, sans-serif")
    .style("max-width", `${width}px`);

  // --- State ---
  let startYear = Math.max(minYear, initialStartYear);
  let endYear = Math.min(maxYear, initialEndYear);
  
  let selectedMonths = Array(12).fill(false);
  if (initialMonths && Array.isArray(initialMonths)) {
      initialMonths.forEach(idx => {
          if (idx >= 0 && idx <= 11) selectedMonths[idx] = true;
      });
  } else {
      selectedMonths.fill(true);
  }

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // --- UI ---
  const controlFrame = container.append("div")
    .style("background-color", "#f8f9fa")
    .style("border", "1px solid #ddd")
    .style("border-radius", "8px")
    .style("padding", "20px")
    .style("margin-bottom", "20px");

  // 1. Month Selector
  const monthSection = controlFrame.append("div").style("margin-bottom", "25px");
  monthSection.append("label")
    .style("font-weight", "bold")
    .style("display", "block")
    .style("margin-bottom", "8px")
    .style("font-size", "13px")
    .text("Select Months");

  const monthsContainer = monthSection.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(6, 1fr)") 
    .style("gap", "8px");

  monthLabels.forEach((label, i) => {
      monthsContainer.append("button")
          .text(label) 
          .style("padding", "8px 0")
          .style("border", "1px solid #007bff")
          .style("border-radius", "4px")
          .style("background-color", selectedMonths[i] ? "#007bff" : "white")
          .style("color", selectedMonths[i] ? "white" : "#007bff")
          .style("cursor", "pointer")
          .style("font-size", "12px")
          .style("font-weight", "500")
          .on("click", function() {
              selectedMonths[i] = !selectedMonths[i];
              const isActive = selectedMonths[i];
              d3.select(this)
                  .style("background-color", isActive ? "#007bff" : "white")
                  .style("color", isActive ? "white" : "#007bff");
              triggerUpdate(); 
          });
  });

  // 2. Year Slider
  const yearSection = controlFrame.append("div").style("margin-bottom", "15px");
  const yearHeaderBox = yearSection.append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("margin-bottom", "10px");
  
  const yearLabel = yearHeaderBox.append("label")
    .style("font-weight", "bold")
    .style("font-size", "13px")
    .text("Year Range");
    
  const yearDisplay = yearHeaderBox.append("div")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .style("color", "#007bff");

  const svgWidth = (width - 40); 
  const svgHeight = 50;
  const margin = { top: 10, right: 20, bottom: 20, left: 20 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const svg = yearSection.append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .style("overflow", "visible");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const yearScale = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([0, innerWidth])
    .clamp(true);

  // Track
  g.append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", innerHeight / 2)
    .attr("y2", innerHeight / 2)
    .attr("stroke", "#e9ecef")
    .attr("stroke-width", 6)
    .attr("stroke-linecap", "round");

  // Range Bar
  const rangeRect = g.append("rect")
    .attr("y", innerHeight / 2 - 3)
    .attr("height", 6)
    .attr("fill", "#007bff")
    .attr("rx", 3);

  // Handle Creator
  const createHandle = (cx) => g.append("circle")
    .attr("cy", innerHeight / 2)
    .attr("r", 12)
    .attr("fill", "white")
    .attr("stroke", "#007bff")
    .attr("stroke-width", 2)
    .attr("cursor", "ew-resize")
    .attr("cx", cx)
    .style("pointer-events", "all");

  // --- DRAG HANDLERS ---
  const startHandle = createHandle(yearScale(startYear))
    .call(d3.drag()
      .on("start", () => yearLabel.style("color", "red"))
      .on("drag", function(event) {
        const [x] = d3.pointer(event, g.node());
        const val = yearScale.invert(x);
        const snapped = Math.round(val); 
        
        if (snapped < endYear && snapped >= minYear) {
          startYear = snapped;
          updateSliderVisuals();
          updateDisplay();
          triggerUpdate(); // <--- Calls the callback
        }
      })
      .on("end", () => yearLabel.style("color", "black"))
    );

  const endHandle = createHandle(yearScale(endYear))
    .call(d3.drag()
      .on("start", () => yearLabel.style("color", "red"))
      .on("drag", function(event) {
        const [x] = d3.pointer(event, g.node());
        const val = yearScale.invert(x);
        const snapped = Math.round(val); 
        
        if (snapped > startYear && snapped <= maxYear) {
          endYear = snapped;
          updateSliderVisuals();
          updateDisplay();
          triggerUpdate(); // <--- Calls the callback
        }
      })
      .on("end", () => yearLabel.style("color", "black"))
    );

  function updateSliderVisuals() {
    const x1 = yearScale(startYear);
    const x2 = yearScale(endYear);
    startHandle.attr("cx", x1);
    endHandle.attr("cx", x2);
    rangeRect.attr("x", x1).attr("width", x2 - x1);
  }

  function updateDisplay() {
    yearDisplay.text(`${startYear} - ${endYear}`);
  }

  function getCurrentValue() {
      const activeMonthIndices = selectedMonths
        .map((isSelected, index) => isSelected ? index : -1)
        .filter(index => index !== -1);
      
      return {
          startYear,
          endYear,
          months: activeMonthIndices
      };
  }

  // --- DIRECT CALLBACK TRIGGER ---
  function triggerUpdate() {
      const val = getCurrentValue();
      container.node().value = val;
      
      // 1. Call the direct callback if provided (Bulletproof)
      if (onInput && typeof onInput === 'function') {
          console.log("⚡ picker.js calling onInput callback with:", val);
          onInput(val);
      }
      
      // 2. Also dispatch event for standard listeners (Backup)
      container.node().dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // 3. Apply Button
  const actionContainer = controlFrame.append("div")
    .style("display", "flex")
    .style("justify-content", "flex-end")
    .style("gap", "10px")
    .style("margin-top", "20px")
    .style("padding-top", "15px")
    .style("border-top", "1px solid #eee");

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
      const val = getCurrentValue();
      
      if (onApply && typeof onApply === 'function') {
          onApply(val);
      } else {
          container.node().dispatchEvent(new CustomEvent('apply', {
              bubbles: true,
              detail: val
          }));
      }
    });

  // Initialize
  updateSliderVisuals();
  updateDisplay();
  container.node().value = getCurrentValue();

  return container.node();
}
