import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";

export class ZonePlotManager {
  constructor() {
    this.selectedZones = new Set();
    this.plotContainer = null;
    this.currentFilter = null;
    this.timeSeriesData = null;
    this.currentPriceType = 'da';
    
    // Chart references for external updates
    this.xScale = null;
    this.focusGroup = null;
    this.cursorGroup = null;
    this.chartDimensions = null;
  }

  initialize(map, filter, priceType = 'da') {
    this.currentFilter = filter;
    this.currentPriceType = priceType;
    this.setupPlotContainer();
    setTimeout(() => {
      this.setupZoneCheckboxes();
    }, 100);
  }

  setupPlotContainer() {
    // 1. Remove existing style if it exists to prevent conflicts
    const existingStyle = document.getElementById('plot-panel-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    // 2. Inject CSS with a specific ID
    const style = document.createElement('style');
    style.id = 'plot-panel-style';
    style.textContent = `
      .plot-panel {
        position: fixed;
        bottom: 0;        /* Anchor to bottom edge */
        right: 0%;        /* Anchor to right edge */
        
        /* 
           VISIBLE STATE:
           X: -5% (Shift left slightly)
           Y: 40px (Move DOWN by 40px to sit lower on screen)
        */
        transform: translate(-4px, -7px) !important;
        
        background: rgba(255, 255, 255, 0.95);
        z-index: 1000;
        box-shadow: 0 -4px 12px rgba(0,0,0,0.15);
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        transition: transform 0.3s ease-in-out;
        width: min(1400px, 100vw);
        max-height: 50vh;
        overflow: hidden;
        box-sizing: border-box;
      }
      
      .plot-panel.hidden {
        /* 
           HIDDEN STATE:
           Y: 100vh (Move down by full screen height)
           This guarantees it is completely off-screen.
        */
        transform: translate(-5%, 100vh) !important; 
      }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'plot-panel';
    panel.className = 'plot-panel hidden';
    
    panel.innerHTML = `
      <div class="plot-header" style="padding: 4px 10px; margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; border-bottom: 1px solid #eee;">
        <h3 style="margin: 0; font-size: 16px; color: #333;">Price Analysis</h3>
        <div class="plot-controls" style="display: flex; gap: 10px; align-items: center;">
          <span id="selected-zones-count" style="font-size: 12px; color: #666;">0 zones selected</span>
          <button id="clear-zones-btn" style="padding: 2px 8px; font-size: 12px; cursor: pointer;">Clear Selection</button>
          <button id="close-plot-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">&times;</button>
        </div>
      </div>
      <div id="plot-content" style="padding: 0;">
        <p class="empty-state" style="padding: 10px; text-align: center; color: #666;">Select zones using checkboxes in the sidebar to begin</p>
      </div>
    `;
    document.body.appendChild(panel);

    this.plotContainer = document.getElementById('plot-content');

    document.getElementById('clear-zones-btn').addEventListener('click', () => {
      this.clearSelection();
    });

    document.getElementById('close-plot-btn').addEventListener('click', () => {
      panel.classList.add('hidden');
    });
  }

  setupZoneCheckboxes() {
    const zoneItems = document.querySelectorAll('.zone-item');
    
    zoneItems.forEach(item => {
      const zoneName = item.dataset.zoneName;
      if (zoneName === 'PJM') return;
      if (item.querySelector('.zone-checkbox')) return;
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'zone-checkbox';
      checkbox.dataset.zone = zoneName;
      
      item.insertBefore(checkbox, item.firstChild);
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.handleZoneCheckbox(zoneName, checkbox.checked);
      });
    });
  }

  handleZoneCheckbox(zoneName, isChecked) {
    if (isChecked) {
      this.selectedZones.add(zoneName);
    } else {
      this.selectedZones.delete(zoneName);
    }

    this.updateZoneHighlights();
    this.updateSelectionCount();
    
    if (this.selectedZones.size > 0 && this.timeSeriesData) {
      this.plotDataFromExisting(this.timeSeriesData);
      document.getElementById('plot-panel').classList.remove('hidden');
    } else if (this.selectedZones.size === 0) {
      this.plotContainer.innerHTML = '<p class="empty-state" style="padding: 20px; text-align: center; color: #666;">Select zones using checkboxes in the sidebar to begin</p>';
      document.getElementById('plot-panel').classList.add('hidden');
    }
  }

  updateZoneHighlights() {
    const map = window.mapInstance;
    if (!map) return;
    
    // --- FIX: Safety Check ---
    // If the map hasn't loaded the 'zoneShapes' source yet, stop immediately.
    if (!map.getSource('zoneShapes')) {
      // console.warn("ZonePlotManager: 'zoneShapes' source not ready yet. Skipping highlight.");
      return;
    }

    if (!map.getLayer('zone-selected')) {
      map.addLayer({
        id: 'zone-selected',
        type: 'line',
        source: 'zoneShapes',
        paint: {
          'line-color': '#cdd1d1ff',
          'line-width': 4
        },
        filter: ['in', ['get', 'Zone_Name'], ['literal', []]]
      }, 'zoneLabels');
    }

    const selectedArray = Array.from(this.selectedZones);
    map.setFilter('zone-selected', ['in', ['get', 'Zone_Name'], ['literal', selectedArray]]);
  }

  updateSelectionCount() {
    const count = this.selectedZones.size;
    document.getElementById('selected-zones-count').textContent = 
      `${count} zone${count !== 1 ? 's' : ''} selected`;
  }

  clearSelection() {
    this.selectedZones.clear();
    document.querySelectorAll('.zone-checkbox').forEach(cb => {
      cb.checked = false;
    });
    this.updateSelectionCount();
    this.updateZoneHighlights();
    this.plotContainer.innerHTML = '<p class="empty-state" style="padding: 20px; text-align: center; color: #666;">Select zones using checkboxes in the sidebar to begin</p>';
    document.getElementById('plot-panel').classList.add('hidden');
  }

  plotDataFromExisting(timeSeriesData) {
    if (this.selectedZones.size === 0) return;

    try {
      this.plotContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Processing data...</div>';
      const plotData = this.transformDataForPlot(timeSeriesData);
      this.renderFocusContextPlot(plotData);
    } catch (error) {
      console.error('Error preparing plot data:', error);
      this.plotContainer.innerHTML = '<p class="error" style="padding: 20px; text-align: center; color: red;">Error processing data</p>';
    }
  }

  transformDataForPlot(timeSeriesData) {
    const plotData = [];
    const selectedZonesArray = Array.from(this.selectedZones);

    const keyMap = {
        'da': ['da', 'total_lmp_da'],
        'rt': ['rt', 'total_lmp_rt'],
        'net': ['net', 'net_load'],
        'congestion': ['rt', 'total_lmp_rt']  
    };

    const potentialKeys = keyMap[this.currentPriceType] || [this.currentPriceType];

    timeSeriesData.forEach(timeStep => {
      const timestamp = new Date(timeStep.datetime);
      selectedZonesArray.forEach(zoneName => {
        if (timeStep.readings && timeStep.readings[zoneName]) {
          const zoneInfo = timeStep.readings[zoneName];
          
          let price;
          for (const k of potentialKeys) {
              if (zoneInfo[k] !== undefined && zoneInfo[k] !== null) {
                  price = zoneInfo[k];
                  break;
              }
          }

          if (price !== undefined) {
            plotData.push({
              timestamp: timestamp,
              zone: zoneName,
              price: price,
              priceType: this.currentPriceType
            });
          }
        }
      });
    });

    return plotData;
  }

  renderFocusContextPlot(data) {
    if (!data || data.length === 0) {
      this.plotContainer.innerHTML = '<p class="empty-state" style="padding: 20px; text-align: center; color: #666;">No data available for selected zones</p>';
      return;
    }

    const priceTypeLabels = {
      da: 'Day-Ahead',
      rt: 'Real-Time',
      net: 'NET',
      congestion: 'Congestion'
    };

    this.plotContainer.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '0px'; 
    wrapper.style.padding = '0px'; 
    
    const containerWidth = Math.min(window.innerWidth - 80, 1400);
    
    // Increased focusHeight to fill space
    const focusHeight = 460; 
    const contextHeight = 80;

    // --- MARGINS HANDLING ---
    const marginLeft = 80;   
    const marginRight = 20;
    const marginTop = 10;    
    const marginBottom = 80; 

    this.chartDimensions = { marginTop, marginBottom, focusHeight };

    const uniqueTimestamps = Array.from(new Set(data.map(d => d.timestamp.getTime())))
      .sort((a, b) => a - b)
      .map(t => new Date(t));

    const xScale = d3.scalePoint()
      .domain(uniqueTimestamps.map(d => d.getTime()))
      .range([marginLeft, containerWidth - marginRight])
      .padding(0.1);

    this.xScale = xScale;

    const yExtent = d3.extent(data, d => d.price);
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([focusHeight - marginBottom, marginTop]);

    const xScaleContext = d3.scalePoint()
      .domain(uniqueTimestamps.map(d => d.getTime()))
      .range([marginLeft, containerWidth - marginRight])
      .padding(0.1);

    const yScaleContext = d3.scaleLinear()
      .domain(yExtent)
      .range([contextHeight - 20, 10]);

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10)
      .domain(Array.from(this.selectedZones));

    const svg = d3.create("svg")
      .attr("width", containerWidth)
      .attr("height", focusHeight + contextHeight + 10)
      .attr("viewBox", [0, 0, containerWidth, focusHeight + contextHeight + 10])
      .style("max-width", "100%")
      .style("height", "auto");

    svg.append("defs").append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("x", marginLeft)
      .attr("y", marginTop)
      .attr("width", containerWidth - marginLeft - marginRight)
      .attr("height", focusHeight - marginTop - marginBottom);

    const focus = svg.append("g").attr("class", "focus");
    this.focusGroup = focus;
    const context = svg.append("g").attr("class", "context").attr("transform", `translate(0,${focusHeight + 10})`);

    focus.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${focusHeight - marginBottom})`)
      .call(d3.axisBottom(xScale).tickSize(-(focusHeight - marginTop - marginBottom)).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#e0e0e0"));

    focus.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(yScale).tickSize(-(containerWidth - marginLeft - marginRight)).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#e0e0e0"));

    const dataByZone = d3.group(data, d => d.zone);
    const focusLines = focus.append("g").attr("clip-path", "url(#clip)");

    this.cursorGroup = focus.append("g")
      .attr("class", "cursor-group")
      .attr("clip-path", "url(#clip)");

    const line = d3.line()
      .x(d => xScale(d.timestamp.getTime()))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    dataByZone.forEach((zoneData, zoneName) => {
      const sortedData = zoneData.sort((a, b) => a.timestamp - b.timestamp);
      
      focusLines.append("path")
        .datum(sortedData)
        .attr("class", `line-${zoneName.replace(/\W/g, '_')}`)
        .attr("fill", "none")
        .attr("stroke", colorScale(zoneName))
        .attr("stroke-width", 2)
        .attr("opacity", 0.8)
        .attr("d", line);

      focusLines.selectAll(`.dot-${zoneName.replace(/\W/g, '_')}`)
        .data(sortedData)
        .join("circle")
        .attr("class", `dot-${zoneName.replace(/\W/g, '_')}`)
        .attr("cx", d => xScale(d.timestamp.getTime()))
        .attr("cy", d => yScale(d.price))
        .attr("r", 3)
        .attr("fill", colorScale(zoneName))
        .attr("stroke", "white")
        .attr("stroke-width", 1);
    });
    
    const xAxisGroup = focus.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${focusHeight - marginBottom})`);
    
    const renderXAxis = (group, scale) => {
      group.call(d3.axisBottom(scale)
        .tickValues(scale.domain()) 
        .tickFormat(d => d3.timeFormat("%m/%d/%y-%H:%M")(new Date(d)))
      )
      .selectAll("text")
        .style("font-size", "12px")  
        .attr("transform", "rotate(-90)") 
        .attr("dx", "-0.8em")
        .attr("dy", "-0.5em")
        .style("text-anchor", "end");
    };

    renderXAxis(xAxisGroup, xScale);

    focus.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("font-size", "14px"); 

    focus.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(focusHeight / 2))
      .attr("y", 20)
      .style("text-anchor", "middle")
      .style("font-size", "12px") 
      .style("font-weight", "500")
      .text(`${priceTypeLabels[this.currentPriceType]} Price ($/MWh)`);

    const lineContext = d3.line()
      .x(d => xScaleContext(d.timestamp.getTime()))
      .y(d => yScaleContext(d.price))
      .curve(d3.curveMonotoneX);

    dataByZone.forEach((zoneData, zoneName) => {
      const sortedData = zoneData.sort((a, b) => a.timestamp - b.timestamp);
      context.append("path")
        .datum(sortedData)
        .attr("class", `line-context-${zoneName.replace(/\W/g, '_')}`)
        .attr("fill", "none")
        .attr("stroke", colorScale(zoneName))
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.7)
        .attr("d", lineContext);
    });

    context.append("g")
      .attr("transform", `translate(0,${contextHeight - 20})`)
      .call(d3.axisBottom(xScaleContext)
        .tickValues(xScaleContext.domain().filter((d, i) => {
          const totalTicks = xScaleContext.domain().length;
          const interval = Math.max(1, Math.floor(totalTicks / 8));
          return i % interval === 0;
        }))
        .tickFormat(d => d3.timeFormat("%m/%d")(new Date(d))))
      .selectAll("text")
      .style("font-size", "10px");

    // --- LEGEND SETUP ---
    const legendContainer = svg.append("foreignObject")
      .attr("x", containerWidth - 250) 
      .attr("y", 0)
      .attr("width", 240) 
      .attr("height", 400);

    const legendDiv = legendContainer.append("xhtml:div")
      .style("background-color", "rgba(255, 255, 255, 0.95)")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("box-shadow", "0 2px 8px rgba(0, 0, 0, 0.2)")
      .style("font-family", "sans-serif")
      .style("font-size", "14px") 
      .style("line-height", "1.4");

    // Legend Header Row
    legendDiv.append("xhtml:div")
      .style("display", "grid")
      .style("grid-template-columns", "1fr 70px 70px") 
      .style("gap", "5px")
      .style("font-weight", "bold")
      .style("border-bottom", "1px solid #ccc")
      .style("padding-bottom", "4px")
      .style("margin-bottom", "6px")
      .style("color", "#333")
      .html(`
        <span>Zone</span>
        <span style="text-align:right">Avg</span>
        <span style="text-align:right">Std Dev</span>
      `);

    const legendItemsContainer = legendDiv.append("xhtml:div");

    // --- LEGEND UPDATE FUNCTION ---
    const updateLegendStats = (filteredData) => {
      legendItemsContainer.html(""); // Clear existing items

      // Group filtered data by zone
      const grouped = d3.group(filteredData, d => d.zone);

      this.selectedZones.forEach(zoneName => {
        const zonePoints = grouped.get(zoneName) || [];
        
        // Filter to ensure we only calculate valid numbers
        const prices = zonePoints
            .map(d => d.price)
            .filter(p => typeof p === 'number' && isFinite(p));
        
        const avg = prices.length ? d3.mean(prices) : 0;
        
        // Sample Standard Deviation
        const std = prices.length > 1 ? d3.deviation(prices) : 0;

        const item = legendItemsContainer.append("xhtml:div")
          .style("display", "grid")
          .style("grid-template-columns", "1fr 70px 70px")
          .style("gap", "5px")
          .style("align-items", "center")
          .style("margin-bottom", "4px")
          .style("border-bottom", "1px solid #f0f0f0")
          .style("padding-bottom", "2px");

        // Col 1: Zone Name + Color
        const zoneLabel = item.append("xhtml:div")
          .style("display", "flex")
          .style("align-items", "center")
          .style("overflow", "hidden")
          .style("white-space", "nowrap");

        zoneLabel.append("xhtml:span")
          .style("width", "12px")
          .style("height", "12px")
          .style("border-radius", "2px")
          .style("margin-right", "6px")
          .style("flex-shrink", "0")
          .style("background-color", colorScale(zoneName));

        zoneLabel.append("xhtml:span")
          .style("text-overflow", "ellipsis")
          .style("overflow", "hidden")
          .text(zoneName);

        // Col 2: Avg
        item.append("xhtml:div")
          .style("text-align", "right")
          .style("font-weight", "500")
          .text(`$${avg.toFixed(2)}`);

        // Col 3: Std
        item.append("xhtml:div")
          .style("text-align", "right")
          .style("color", "#666")
          .text(`$${std.toFixed(2)}`);
      });
    };

    // Initial Legend Render (Full Data)
    updateLegendStats(data);

    // --- BRUSH SETUP ---
    const brush = d3.brushX()
      .extent([[marginLeft, 0], [containerWidth - marginRight, contextHeight - 20]])
      .on("brush end", (event) => brushed(event));

    const brushG = context.append("g")
      .attr("class", "brush")
      .call(brush);

    brushG.selectAll(".selection")
      .attr("fill", "#007bff")
      .attr("fill-opacity", 0.2)
      .attr("stroke", "#007bff");

    const brushed = (event) => {
      if (!event.selection) {
          // If selection is cleared, reset to full data
          xScale.domain(uniqueTimestamps.map(d => d.getTime()));
          updateLegendStats(data);
          
          // Redraw lines
          dataByZone.forEach((zoneData, zoneName) => {
              focusLines.select(`.line-${zoneName.replace(/\W/g, '_')}`).attr("d", line);
              focusLines.selectAll(`.dot-${zoneName.replace(/\W/g, '_')}`)
                  .attr("cx", d => xScale(d.timestamp.getTime()))
                  .attr("cy", d => yScale(d.price));
          });
          xAxisGroup.selectAll("*").remove();
          renderXAxis(xAxisGroup, xScale);
          return;
      }
      
      const [x0Px, x1Px] = event.selection;
      
      // Find timestamps inside the brush
      const selectedTimestamps = uniqueTimestamps.filter(t => {
        const pos = xScaleContext(t.getTime());
        return pos >= x0Px && pos <= x1Px;
      });

      if (selectedTimestamps.length === 0) return;

      // Update Domain
      xScale.domain(selectedTimestamps.map(d => d.getTime()));

      // Filter data for stats
      const visibleData = data.filter(d => 
          selectedTimestamps.some(t => t.getTime() === d.timestamp.getTime())
      );

      // Update Legend
      updateLegendStats(visibleData);

      // Redraw Lines
      dataByZone.forEach((zoneData, zoneName) => {
        const sortedData = zoneData
          .filter(d => selectedTimestamps.some(t => t.getTime() === d.timestamp.getTime()))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        focusLines.select(`.line-${zoneName.replace(/\W/g, '_')}`)
          .datum(sortedData)
          .attr("d", line);

        focusLines.selectAll(`.dot-${zoneName.replace(/\W/g, '_')}`)
          .data(sortedData, d => d.timestamp.getTime())
          .join("circle")
          .attr("class", `dot-${zoneName.replace(/\W/g, '_')}`)
          .attr("cx", d => xScale(d.timestamp.getTime()))
          .attr("cy", d => yScale(d.price))
          .attr("r", 3)
          .attr("fill", colorScale(zoneName))
          .attr("stroke", "white")
          .attr("stroke-width", 1);
      });

      xAxisGroup.selectAll("*").remove();
      renderXAxis(xAxisGroup, xScale);
    };

    context.append("text")
      .attr("x", containerWidth / 2)
      .attr("y", contextHeight + 5)
      .style("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#666")
      .text("Drag to select time range");

    wrapper.appendChild(svg.node());
    this.plotContainer.appendChild(wrapper);
  }

  getVisibleRange() {
    if (!this.xScale) return null;
    const domain = this.xScale.domain();
    if (!domain || domain.length === 0) return null;
    
    const start = new Date(domain[0]);
    const end = new Date(domain[domain.length - 1]);
    
    return [start, end];
  }

  updateTimeCursor(timestamp) {
    if (!this.xScale || !this.cursorGroup || !this.chartDimensions) return;
    if (!timestamp) {
        this.cursorGroup.selectAll(".time-cursor-line").remove();
        return;
    }

    const timeValue = new Date(timestamp).getTime();
    const xPos = this.xScale(timeValue);
    const line = this.cursorGroup.selectAll(".time-cursor-line")
      .data(xPos !== undefined ? [xPos] : []);

    line.join(
      enter => enter.append("line")
        .attr("class", "time-cursor-line")
        .attr("stroke", "#ff0000")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5 3")
        .attr("y1", this.chartDimensions.marginTop)
        .attr("y2", this.chartDimensions.focusHeight - this.chartDimensions.marginBottom)
        .attr("pointer-events", "none"),
      update => update
    )
    .attr("x1", d => d)
    .attr("x2", d => d);
  }

  updateData(newTimeSeriesData) {
    this.timeSeriesData = newTimeSeriesData;
    if (this.selectedZones.size > 0) {
      this.plotDataFromExisting(newTimeSeriesData);
    }
  }

  updatePriceType(newPriceType) {
    this.currentPriceType = newPriceType;
    if (this.selectedZones.size > 0 && this.timeSeriesData) {
      this.plotDataFromExisting(this.timeSeriesData);
    }
  }

  updateFilter(newFilter) {
    this.currentFilter = newFilter;
  }
}

export const zonePlotManager = new ZonePlotManager();
