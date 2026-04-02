import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";

export class ZonePlotManager {
  constructor() {
    this.selectedZones = new Set();
    this.plotContainer = null;
    this.currentFilter = null;
    this.timeSeriesData = null;
    this.currentPriceType = 'da';
    this.visibleSeries = { retail: true, wholesale: true };
    
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
        display: flex;
        flex-direction: column;
        transform: translateY(0) !important;
        background: #f0f0f0;
        z-index: 1000;
        box-shadow: 0 -4px 12px rgba(0,0,0,0.15);
        border-radius: 8px;
        transition: transform 0.3s ease-in-out;
        overflow: hidden;
        box-sizing: border-box;
      }
      
      .plot-panel.hidden {
        transform: translateY(calc(100% + 12px)) !important;
      }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'plot-panel';
    panel.className = 'plot-panel hidden';
    
    panel.innerHTML = `
      <div class="plot-header" style="padding: 4px 10px; margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; background: #f0f0f0; border-bottom: 1px solid #ddd;">
        <h3 style="margin: 0; font-size: 16px; color: #333;">Price Analysis</h3>
        <div class="plot-controls" style="display: flex; gap: 10px; align-items: center;">
          <span id="selected-zones-count" style="font-size: 12px; color: #666;">0 zones selected</span>
          <button id="clear-zones-btn" style="padding: 2px 8px; font-size: 12px; cursor: pointer;">Clear Selection</button>
          <button id="close-plot-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">&times;</button>
        </div>
      </div>
      <div id="plot-content" style="padding: 0; background: #f0f0f0; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
        <p class="empty-state" style="padding: 10px; text-align: center; color: #666;">Select zones using checkboxes in the sidebar to begin</p>
      </div>
    `;
    document.body.appendChild(panel);

    this.plotContainer = document.getElementById('plot-content');
    this.syncPanelToMap();

    if (!this.boundSyncPanelToMap) {
      this.boundSyncPanelToMap = () => this.syncPanelToMap();
      window.addEventListener('resize', this.boundSyncPanelToMap);
      window.addEventListener('scroll', this.boundSyncPanelToMap, { passive: true });
    }

    document.getElementById('clear-zones-btn').addEventListener('click', () => {
      this.clearSelection();
    });

    document.getElementById('close-plot-btn').addEventListener('click', () => {
      panel.classList.add('hidden');
    });
  }

  syncPanelToMap() {
    const panel = document.getElementById('plot-panel');
    const mapContainer = document.getElementById('map-container');
    if (!panel || !mapContainer) return;

    const rect = mapContainer.getBoundingClientRect();
    panel.style.left = `${Math.round(rect.left)}px`;
    panel.style.top = `${Math.round(rect.top)}px`;
    panel.style.width = `${Math.round(rect.width)}px`;
    panel.style.height = `${Math.round(rect.height)}px`;
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
      this.syncPanelToMap();
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

    // If neither price type is checked, show a prominent message
    if (!this.visibleSeries.retail && !this.visibleSeries.wholesale) {
      this.plotContainer.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:400px;">
          <p style="font-size:32px;font-weight:bold;color:#999;text-align:center;line-height:1.4;">No Price Type Selected</p>
        </div>`;
      return;
    }

    try {
      this.plotContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Processing data...</div>';
      const plotData = this.transformDataForPlot(timeSeriesData);
      if (plotData.length === 0) {
        this.plotContainer.innerHTML = '<p class="empty-state" style="padding: 20px; text-align: center; color: #666;">No retail or wholesale price data available for the selected territories</p>';
        return;
      }
      this.renderFocusContextPlot(plotData);
    } catch (error) {
      console.error('Error preparing plot data:', error);
      this.plotContainer.innerHTML = '<p class="error" style="padding: 20px; text-align: center; color: red;">Error processing data</p>';
    }
  }

  transformDataForPlot(timeSeriesData) {
    const plotData = [];
    const selectedZonesArray = Array.from(this.selectedZones);

    if (!Array.isArray(timeSeriesData) || selectedZonesArray.length === 0) {
      return plotData;
    }

    const usesMonthlyFrames = timeSeriesData.some(frame => frame && (frame.retailPrices || frame.wholesalePrices));

    if (usesMonthlyFrames) {
      timeSeriesData.forEach(frame => {
        const timestamp = new Date(frame.datetime || new Date(frame.year, (frame.month || 1) - 1, 1));

        selectedZonesArray.forEach(zoneName => {
          if (this.visibleSeries.retail) {
            const retailPrice = frame.retailPrices?.[zoneName];
            if (retailPrice !== undefined && retailPrice !== null) {
              plotData.push({
                timestamp,
                zone: zoneName,
                series: 'Retail',
                seriesKey: `${zoneName}__retail`,
                price: retailPrice
              });
            }
          }

          if (this.visibleSeries.wholesale) {
            const wholesalePrice = frame.wholesalePrices?.[zoneName];
            if (wholesalePrice !== undefined && wholesalePrice !== null) {
              plotData.push({
                timestamp,
                zone: zoneName,
                series: 'Wholesale',
                seriesKey: `${zoneName}__wholesale`,
                price: wholesalePrice
              });
            }
          }
        });
      });

      return plotData;
    }

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
              series: this.currentPriceType,
              seriesKey: `${zoneName}__${this.currentPriceType}`,
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

    this.plotContainer.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.flex = '1 1 auto';
    wrapper.style.gap = '0px'; 
    wrapper.style.padding = '0px'; 
    wrapper.style.background = '#f0f0f0';
    
    const panel = document.getElementById('plot-panel');
    const availableWidth = panel ? panel.clientWidth : window.innerWidth - 120;
    const containerWidth = Math.max(520, availableWidth - 48);

    const panelHeight = panel ? panel.clientHeight : 500;
    const headerHeight = 42;
    const plotContentHeight = this.plotContainer ? this.plotContainer.clientHeight : 0;
    const availablePlotHeight = Math.max(280, plotContentHeight || (panelHeight - headerHeight));
    const contextHeight = 82;
    const chartBottomPadding = 28;
    const focusHeight = Math.max(220, availablePlotHeight - contextHeight - chartBottomPadding);

    // --- MARGINS HANDLING ---
    const marginLeft = 80;   
    const marginRight = 85;  // wider to accommodate right Y axis
    const marginTop = 10;    
    const marginBottom = 80; 

    this.chartDimensions = { marginTop, marginBottom, focusHeight };

    // Separate data by price type for independent Y scales
    const retailData = data.filter(d => d.series === 'Retail');
    const wholesaleData = data.filter(d => d.series === 'Wholesale');
    const hasRetail = retailData.length > 0;
    const hasWholesale = wholesaleData.length > 0;

    const uniqueTimestamps = Array.from(new Set(data.map(d => d.timestamp.getTime())))
      .sort((a, b) => a - b)
      .map(t => new Date(t));

    const xScale = d3.scalePoint()
      .domain(uniqueTimestamps.map(d => d.getTime()))
      .range([marginLeft, containerWidth - marginRight])
      .padding(0.1);

    this.xScale = xScale;

    // Use the visible series min/max values as the axis range, with a small pad
    // only when the series would otherwise collapse to a single value.
    const scaleDomain = (seriesData) => {
      if (!seriesData.length) return [0, 1];
      const [lo, hi] = d3.extent(seriesData, d => d.price);
      if (lo === hi) {
        const pad = Math.max(Math.abs(lo) * 0.05, 0.5);
        return [lo - pad, hi + pad];
      }
      return [lo, hi];
    };

    // Independent Y scales so each price type uses the full vertical range.
    const yScaleRetail = d3.scaleLinear()
      .domain(scaleDomain(retailData))
      .range([focusHeight - marginBottom, marginTop]);

    const yScaleWholesale = d3.scaleLinear()
      .domain(scaleDomain(wholesaleData))
      .range([focusHeight - marginBottom, marginTop]);

    const getYScale = (seriesName) => seriesName === 'Retail' ? yScaleRetail : yScaleWholesale;
    const formatCents = (value) => (value * 100).toFixed(2);
    const formatLegendName = (name) => {
      if (typeof name !== 'string' || !name.length) return name;

      let result = '';
      let inParentheses = false;
      let shouldCapitalize = true;

      for (const ch of name) {
        if (ch === '(') {
          inParentheses = true;
          result += ch;
          continue;
        }
        if (ch === ')') {
          inParentheses = false;
          result += ch;
          continue;
        }

        if (inParentheses) {
          result += ch;
          continue;
        }

        if (/[a-zA-Z]/.test(ch)) {
          if (shouldCapitalize) {
            result += ch.toUpperCase();
            shouldCapitalize = false;
          } else {
            result += ch.toLowerCase();
          }
          continue;
        }

        result += ch;
        if (/\s|-|\//.test(ch)) {
          shouldCapitalize = true;
        }
      }

      return result;
    };

    const xScaleContext = d3.scalePoint()
      .domain(uniqueTimestamps.map(d => d.getTime()))
      .range([marginLeft, containerWidth - marginRight])
      .padding(0.1);

    const yScaleContext = d3.scaleLinear()
      .domain(d3.extent(data, d => d.price))
      .range([contextHeight - 20, 10]);

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10)
      .domain(Array.from(this.selectedZones));

    const getSeriesStroke = (seriesName, zoneName) => {
      const color = colorScale(zoneName);
      return {
        color,
        dash: seriesName === 'Wholesale' ? '6 4' : null,
        width: seriesName === 'Wholesale' ? 2.5 : 2
      };
    };

    const totalChartHeight = focusHeight + contextHeight + chartBottomPadding;

    wrapper.style.height = `${totalChartHeight}px`;
    wrapper.style.minHeight = `${totalChartHeight}px`;

    const svg = d3.create("svg")
      .attr("width", containerWidth)
      .attr("height", totalChartHeight)
      .attr("viewBox", [0, 0, containerWidth, totalChartHeight])
      .style("max-width", "100%")
      .style("height", `${totalChartHeight}px`)
      .style("background", "#f0f0f0")
      .style("display", "block");

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

    const focusXGrid = focus.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${focusHeight - marginBottom})`)
      .call(d3.axisBottom(xScale).tickSize(-(focusHeight - marginTop - marginBottom)).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#e0e0e0"));

    const focusYGrid = focus.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(yScaleRetail).tickSize(-(containerWidth - marginLeft - marginRight)).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#e0e0e0"));

    const dataBySeries = d3.group(data, d => d.seriesKey);
    const focusLines = focus.append("g").attr("clip-path", "url(#clip)");

    this.cursorGroup = focus.append("g")
      .attr("class", "cursor-group")
      .attr("clip-path", "url(#clip)");

    dataBySeries.forEach((seriesData, seriesKey) => {
      const sortedData = seriesData.sort((a, b) => a.timestamp - b.timestamp);
      const firstPoint = sortedData[0];
      const zoneName = firstPoint.zone;
      const style = getSeriesStroke(firstPoint.series, zoneName);
      const yS = getYScale(firstPoint.series);

      const line = d3.line()
        .x(d => xScale(d.timestamp.getTime()))
        .y(d => yS(d.price))
        .curve(d3.curveMonotoneX);
      
      focusLines.append("path")
        .datum(sortedData)
        .attr("class", `line-${seriesKey.replace(/\W/g, '_')}`)
        .attr("fill", "none")
        .attr("stroke", style.color)
        .attr("stroke-width", style.width)
        .attr("stroke-dasharray", style.dash)
        .attr("opacity", 0.8)
        .attr("d", line);

      focusLines.selectAll(`.dot-${seriesKey.replace(/\W/g, '_')}`)
        .data(sortedData)
        .join("circle")
        .attr("class", `dot-${seriesKey.replace(/\W/g, '_')}`)
        .attr("cx", d => xScale(d.timestamp.getTime()))
        .attr("cy", d => yS(d.price))
        .attr("r", 3)
        .attr("fill", firstPoint.series === 'Wholesale' ? '#ffffff' : style.color)
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .attr("stroke", style.color);
    });
    
    const xAxisGroup = focus.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${focusHeight - marginBottom})`);

    const leftAxisGroup = focus.append("g")
      .attr("class", "y-axis-left")
      .attr("transform", `translate(${marginLeft},0)`);

    const rightAxisGroup = focus.append("g")
      .attr("class", "y-axis-right")
      .attr("transform", `translate(${containerWidth - marginRight},0)`);

    const axisLabelLayer = focus.append("g").attr("class", "axis-label-layer");
    
    const renderXAxis = (group, scale) => {
      const tickValues = scale.domain().filter((d, i) => {
        const totalTicks = scale.domain().length;
        const interval = Math.max(1, Math.floor(totalTicks / 10));
        return i % interval === 0;
      });

      group.call(d3.axisBottom(scale)
        .tickValues(tickValues)
        .tickFormat(d => d3.timeFormat("%b %y")(new Date(d)))
      )
      .selectAll("text")
        .style("font-size", "12px")
        .attr("transform", "rotate(-45)")
        .attr("dx", "-0.8em")
        .attr("dy", "0.1em")
        .style("text-anchor", "end");
    };

    const addAxisKey = ({ x, y, text, color, dash }) => {
      const group = axisLabelLayer.append("g")
        .attr("transform", `translate(${x},${y}) rotate(-90)`);

      group.append("line")
        .attr("x1", -28)
        .attr("x2", -4)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", color)
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", dash || null)
        .attr("stroke-linecap", "round");

      group.append("text")
        .attr("x", 4)
        .attr("y", 4)
        .style("text-anchor", "start")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", color)
        .text(text);
    };

    const renderYAxes = (visibleData) => {
      const visibleRetail = visibleData.filter(d => d.series === 'Retail');
      const visibleWholesale = visibleData.filter(d => d.series === 'Wholesale');
      const retailVisible = visibleRetail.length > 0;
      const wholesaleVisible = visibleWholesale.length > 0;

      if (retailVisible) {
        yScaleRetail.domain(scaleDomain(visibleRetail));
      }
      if (wholesaleVisible) {
        yScaleWholesale.domain(scaleDomain(visibleWholesale));
      }

      const leftScale = retailVisible ? yScaleRetail : yScaleWholesale;

      focusYGrid
        .call(d3.axisLeft(leftScale).tickSize(-(containerWidth - marginLeft - marginRight)).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").attr("stroke", "#e0e0e0"));

      leftAxisGroup.style("display", null);
      leftAxisGroup.call(d3.axisLeft(leftScale).tickFormat(formatCents));
      leftAxisGroup.selectAll("text").style("font-size", "13px");

      rightAxisGroup.selectAll("*").remove();
      axisLabelLayer.selectAll("*").remove();

      if (retailVisible && wholesaleVisible) {
        rightAxisGroup.call(d3.axisRight(yScaleWholesale).tickFormat(formatCents));
        rightAxisGroup.selectAll("text").style("font-size", "13px");

        addAxisKey({
          x: 20,
          y: focusHeight / 2,
          text: "Retail",
          color: "#555555",
          dash: null
        });
        addAxisKey({
          x: containerWidth - marginRight + 58,
          y: focusHeight / 2,
          text: "Wholesale",
          color: "#555555",
          dash: "6 4"
        });
      } else if (retailVisible) {
        addAxisKey({
          x: 20,
          y: focusHeight / 2,
          text: "Retail",
          color: "#555555",
          dash: null
        });
      } else if (wholesaleVisible) {
        addAxisKey({
          x: 20,
          y: focusHeight / 2,
          text: "Wholesale",
          color: "#555555",
          dash: "6 4"
        });
      }
    };

    renderXAxis(xAxisGroup, xScale);
    renderYAxes(data);

    const lineContext = d3.line()
      .x(d => xScaleContext(d.timestamp.getTime()))
      .y(d => yScaleContext(d.price))
      .curve(d3.curveMonotoneX);

    dataBySeries.forEach((seriesData, seriesKey) => {
      const sortedData = seriesData.sort((a, b) => a.timestamp - b.timestamp);
      const firstPoint = sortedData[0];
      const style = getSeriesStroke(firstPoint.series, firstPoint.zone);
      context.append("path")
        .datum(sortedData)
        .attr("class", `line-context-${seriesKey.replace(/\W/g, '_')}`)
        .attr("fill", "none")
        .attr("stroke", style.color)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", style.dash)
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
        .tickFormat(d => d3.timeFormat("%b %y")(new Date(d))))
      .selectAll("text")
      .style("font-size", "10px");

    context.append("g")
      .attr("class", "y-axis-context")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(yScaleContext)
        .ticks(4)
        .tickFormat(formatCents)
      )
      .call(g => g.selectAll("text").style("font-size", "9px"));

    // --- LEGEND SETUP ---
    const legendWidth = 390;
    const legendHeight = 400;
    let legendX = containerWidth - marginRight - legendWidth - 10;
    let legendY = 0;

    const legendContainer = svg.append("foreignObject")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("cursor", "move");

    const legendDiv = legendContainer.append("xhtml:div")
      .style("background-color", "rgba(255, 255, 255, 0.95)")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("box-shadow", "0 2px 8px rgba(0, 0, 0, 0.2)")
      .style("font-family", "sans-serif")
      .style("font-size", "14px") 
      .style("line-height", "1.4")
      .style("user-select", "none");

    let legendMinimized = false;
    const legendToolbar = legendDiv.append("xhtml:div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "space-between")
      .style("margin-bottom", "6px")
      .style("font-weight", "bold")
      .style("font-size", "12px");

    legendToolbar.append("xhtml:span").text("Legend");

    const legendToggleButton = legendToolbar.append("xhtml:button")
      .attr("type", "button")
      .attr("aria-expanded", "true")
      .attr("title", "Minimize legend")
      .style("border", "1px solid #bbb")
      .style("border-radius", "3px")
      .style("background", "#fff")
      .style("color", "#333")
      .style("font-size", "12px")
      .style("width", "20px")
      .style("height", "20px")
      .style("line-height", "16px")
      .style("padding", "0")
      .style("cursor", "pointer")
      .text("-");

    const legendBody = legendDiv.append("xhtml:div");

    const updateLegendPosition = () => {
      const maxX = Math.max(0, containerWidth - legendWidth);
      const maxY = Math.max(0, totalChartHeight - legendHeight);
      legendX = Math.max(0, Math.min(maxX, legendX));
      legendY = Math.max(0, Math.min(maxY, legendY));
      legendContainer.attr("x", legendX).attr("y", legendY);
    };

    const legendDrag = d3.drag()
      .on("drag", (event) => {
        legendX += event.dx;
        legendY += event.dy;
        updateLegendPosition();
      });

    legendContainer.call(legendDrag);

    const getLegendSeriesColumns = (legendData) => {
      const availableSeries = Array.from(new Set(legendData.map(d => d.series)));
      const orderedSeries = ['Retail', 'Wholesale'];
      const knownSeries = orderedSeries.filter(series => availableSeries.includes(series));
      const otherSeries = availableSeries
        .filter(series => !orderedSeries.includes(series))
        .sort((left, right) => left.localeCompare(right));

      return [...knownSeries, ...otherSeries];
    };

    // Legend Header Row
    const legendHeader = legendBody.append("xhtml:div")
      .style("display", "grid")
      .style("gap", "5px")
      .style("font-weight", "bold")
      .style("border-bottom", "1px solid #ccc")
      .style("padding-bottom", "4px")
      .style("margin-bottom", "6px")
      .style("color", "#333");

    const legendItemsContainer = legendBody.append("xhtml:div");

    // --- LEGEND UPDATE FUNCTION ---
    const updateLegendStats = (filteredData) => {
      legendItemsContainer.html(""); // Clear existing items
      legendHeader.html("");

      const legendSeriesColumns = getLegendSeriesColumns(filteredData);
      const getSeriesColumnWidth = () => "88px";
      const expandedColumns = legendSeriesColumns.flatMap((seriesName) => {
        if (seriesName === 'Retail' || seriesName === 'Wholesale') {
          return [
            { kind: 'symbol', seriesName },
            { kind: 'value', seriesName }
          ];
        }

        return [{ kind: 'value', seriesName }];
      });
      const headerColumns = [
        "minmax(0, 1fr)",
        ...expandedColumns.map((column) => column.kind === 'symbol' ? "12px" : getSeriesColumnWidth(column.seriesName))
      ];

      legendHeader
        .style("grid-template-columns", headerColumns.join(" "));

      legendHeader.append("xhtml:span").text("Service Territory");

      expandedColumns.forEach((column) => {
        if (column.kind === 'symbol') {
          legendHeader.append("xhtml:span");
          return;
        }

        const headerLabel = column.seriesName === 'Retail'
          ? 'Retail Avg\n(¢/kWhr)'
          : column.seriesName === 'Wholesale'
            ? 'Wholesale Avg\n(¢/kWhr)'
            : `${column.seriesName} Avg`;

        legendHeader.append("xhtml:span")
          .style("text-align", column.seriesName === 'Retail' || column.seriesName === 'Wholesale' ? "left" : "right")
          .style("white-space", "pre-line")
          .text(headerLabel);
      });

      const grouped = d3.group(filteredData, d => d.zone);

      Array.from(grouped.entries())
        .sort((a, b) => {
          const [leftZone] = a;
          const [rightZone] = b;
          return leftZone.localeCompare(rightZone);
        })
        .forEach(([zoneName, zonePoints]) => {
          const averagesBySeries = new Map();
          const zoneColor = colorScale(zoneName);

          legendSeriesColumns.forEach((seriesName) => {
            const prices = zonePoints
              .filter(d => d.series === seriesName)
              .map(d => d.price)
              .filter(p => typeof p === 'number' && isFinite(p));

            averagesBySeries.set(seriesName, prices.length ? d3.mean(prices) : null);
          });

          const item = legendItemsContainer.append("xhtml:div")
          .style("display", "grid")
          .style("grid-template-columns", headerColumns.join(" "))
          .style("column-gap", "3px")
          .style("row-gap", "5px")
          .style("align-items", "center")
          .style("margin-bottom", "4px")
          .style("border-bottom", "1px solid #f0f0f0")
          .style("padding-bottom", "2px");

          item.append("xhtml:span")
            .style("white-space", "normal")
            .style("overflow-wrap", "anywhere")
            .text(formatLegendName(zoneName));

          expandedColumns.forEach((column) => {
            const average = averagesBySeries.get(column.seriesName);

            if (column.kind === 'symbol') {
              const symbolCell = item.append("xhtml:div")
                .style("display", "flex")
                .style("justify-content", "center")
                .style("align-items", "center");

              if (average !== null) {
                symbolCell.append("xhtml:div")
                  .style("width", "12px")
                  .style("height", "0")
                  .style("border-top", `3px ${column.seriesName === 'Wholesale' ? 'dashed' : 'solid'} ${zoneColor}`)
                  .style("border-radius", "2px");
              }
              return;
            }

            item.append("xhtml:div")
              .style("text-align", column.seriesName === 'Retail' || column.seriesName === 'Wholesale' ? "left" : "right")
              .style("font-weight", "500")
              .style("color", average === null ? "#999" : null)
              .text(average === null ? "-" : formatCents(average));
          });
        });
    };

    legendToggleButton.on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      legendMinimized = !legendMinimized;
      legendBody.style("display", legendMinimized ? "none" : "block");
      legendToggleButton
        .text(legendMinimized ? "+" : "-")
        .attr("aria-expanded", legendMinimized ? "false" : "true")
        .attr("title", legendMinimized ? "Expand legend" : "Minimize legend");
    });

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
        xScale.domain(uniqueTimestamps.map(d => d.getTime()));
        updateLegendStats(data);
        renderYAxes(data);
        dataBySeries.forEach((seriesData, seriesKey) => {
          const firstPoint = seriesData[0];
          const yS = getYScale(firstPoint.series);
          const line = d3.line()
            .x(d => xScale(d.timestamp.getTime()))
            .y(d => yS(d.price))
            .curve(d3.curveMonotoneX);
          focusLines.select(`.line-${seriesKey.replace(/\W/g, '_')}`).attr("d", line);
          focusLines.selectAll(`.dot-${seriesKey.replace(/\W/g, '_')}`)
            .attr("cx", d => xScale(d.timestamp.getTime()))
            .attr("cy", d => yS(d.price));
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
      renderYAxes(visibleData);

      // Redraw Lines
      dataBySeries.forEach((seriesData, seriesKey) => {
        const sortedData = seriesData
          .filter(d => selectedTimestamps.some(t => t.getTime() === d.timestamp.getTime()))
          .sort((a, b) => a.timestamp - b.timestamp);
        const firstPoint = sortedData[0] || seriesData[0];
        const style = getSeriesStroke(firstPoint.series, firstPoint.zone);
        const yS = getYScale(firstPoint.series);
        const lineSel = d3.line()
          .x(d => xScale(d.timestamp.getTime()))
          .y(d => yS(d.price))
          .curve(d3.curveMonotoneX);
        
        focusLines.select(`.line-${seriesKey.replace(/\W/g, '_')}`)
          .datum(sortedData)
          .attr("d", lineSel);

        focusLines.selectAll(`.dot-${seriesKey.replace(/\W/g, '_')}`)
          .data(sortedData, d => d.timestamp.getTime())
          .join("circle")
          .attr("class", `dot-${seriesKey.replace(/\W/g, '_')}`)
          .attr("cx", d => xScale(d.timestamp.getTime()))
          .attr("cy", d => yS(d.price))
          .attr("r", 3)
          .attr("fill", firstPoint.series === 'Wholesale' ? '#ffffff' : style.color)
          .attr("stroke", style.color)
          .attr("stroke-width", 1.5);
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

  setVisibleSeries(showRetail, showWholesale) {
    this.visibleSeries = {
      retail: showRetail !== false,
      wholesale: showWholesale !== false
    };

    if (this.selectedZones.size > 0 && this.timeSeriesData) {
      this.plotDataFromExisting(this.timeSeriesData);
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
