---
title: PJM Wholesale/Retail Market Map
theme: dashboard
toc: false
sidebar: false
pager: false
---

<script>
  try { localStorage.setItem("observablehq:sidebar", "false"); } catch (e) {}

  // 1. Add a click event listener to the filter trigger
  const filterTrigger = document.getElementById('filter-trigger');
  if (filterTrigger) {
      filterTrigger.addEventListener('click', (e) => {
          const filterModal = document.getElementById('filter-modal');
          if (filterModal) {
              filterModal.showModal(); 
          }
      });
  }
</script>

<link rel="stylesheet" href="./styles/main.css">
<link href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" rel="stylesheet" />

<!-- 1. Header With Ribbon for Help Docs & View Control -->
<div id="page-header">
  <div class="header-left"></div>
  <h1>Retail Electricity Service Territories Map</h1>
  
  <div class="header-right" style="display: flex; align-items: center; gap: 15px;">    
    <!-- View Mode Selector (HIDDEN) -->
    <div class="control-group" style="display: none; align-items: center; gap: 5px;">
        <label for="view-mode-selector" style="color: white; font-size: 12px; font-weight: bold;">View:</label>
        <select id="view-mode-selector" class="header-select-box" style="padding: 4px; border-radius: 4px; border: none;">
            <option value="2d">Flat Map (2D)</option>
            <option value="3d">Height Map (3D)</option>
            <option value="contour">Heatmap (Contour)</option>
        </select>
    </div>
    <!-- Getting Started Menu -->
    <div style="display: block; position: relative;">
      <button onclick="const m = document.getElementById('header-help-menu'); m.style.display = m.style.display === 'block' ? 'none' : 'block';" 
              class="header-btn">
          🚀 Getting Started <span style="font-size: 10px;">▼</span>
      </button>
      <!-- Dropdown Menu -->
      <div id="header-help-menu" class="header-dropdown right-aligned" style="min-width: 210px;">
          <a href="./OVERVIEW">🧭 Project Overview</a>
          <a href="./USER_GUIDE" id="btn-guide">📖 User Guide</a>
        <a href="./SETUP" id="btn-setup">⚙️ Setup / Environment</a>
      </div>
    </div>
  </div>
</div>

<!-- Top Controls (Price Type & Filter) -->
<div style="padding: 14px 20px 0 20px; background: linear-gradient(180deg, #fbfbf7 0%, #f4f4ef 100%); border-bottom: 1px solid #ddd;">
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px;">
    <div style="background: white; border: 1px solid #d8d8cf; border-radius: 8px; padding: 12px 14px;">
      <div style="font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #7a6f52; margin-bottom: 6px;">Project Goal</div>
      <div style="font-size: 14px; line-height: 1.4; color: #2b2b2b;">Compare retail service-territory rates with associated wholesale PJM pricing patterns in one map-based workflow.</div>
    </div>
    <div style="background: white; border: 1px solid #d8d8cf; border-radius: 8px; padding: 12px 14px;">
      <div style="font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #7a6f52; margin-bottom: 6px;">Major Finding</div>
      <div style="font-size: 14px; line-height: 1.4; color: #2b2b2b;">Retail and wholesale values vary across territories and over time, so the selected date window materially affects interpretation.</div>
    </div>
    <div style="background: white; border: 1px solid #d8d8cf; border-radius: 8px; padding: 12px 14px;">
      <div style="font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #7a6f52; margin-bottom: 6px;">Key Constraint</div>
      <div style="font-size: 14px; line-height: 1.4; color: #2b2b2b;">GitHub Pages uses a static demo snapshot. Full live access requires a local clone plus temporary credentials and SSH setup.</div>
    </div>
  </div>
</div>

<div class="top-controls-wrapper" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 20px; background: #f0f0f0; border-bottom: 1px solid #ddd; margin-bottom: 0;">
    <!-- Left: Price Selector -->
    <div class="price-selector" style="display: flex; align-items: center; gap: 12px; background: #dcdcdc; padding: 6px 12px; border: 1px solid #000; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); box-sizing: border-box; flex: 0 0 auto;">
        <span class="price-label" style="font-weight: bold; color: #555; font-size: 12px;">⚙️ Price Type &rarr;</span>
        <div style="display: flex; align-items: center; gap: 5px;">
            <input type="checkbox" id="price-retail" name="price-type" value="retail" checked style="cursor: pointer;">
            <label for="price-retail" style="cursor: pointer; font-size: 14px;">Retail</label>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <input type="checkbox" id="price-wholesale" name="price-type" value="wholesale" checked style="cursor: pointer;">
            <label for="price-wholesale" style="cursor: pointer; font-size: 14px;">Wholesale</label>
        </div>
    </div>
    <!-- Right: Filter Trigger -->
    <!-- IMPORTANT: The ID inside here must be 'current-filter-display' -->
    <div class="filter-container" id="filter-trigger" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; cursor: pointer; background: #dcdcdc; padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); box-sizing: border-box; flex: 1 1 auto; min-width: 300px; margin-left: 16px;" title="Click to configure filters">
        <span class="filter-label" style="font-size: 12px; color: #666; font-weight: 600;">⚙️ Selected Months &rarr;</span>
        <div id="current-filter-display" style="min-width: 120px; text-align: left;">
            <span style="color: #999; font-style: italic; font-size: 12px;">Loading...</span>
        </div>
    </div>
</div>


<!-- Main Container -->
<div id="main-container">
  <div id="map-container">
    <div id="map"></div>
    <div id="legend"></div>
    <div id="controls-container">
      <button id="avg-btn">Avg Price View</button>
      <div id="speed-box">
        <label>Speed</label>
        <input type="range" id="speed-slider" min="100" max="3000" step="100" value="1000">
      </div>
      <button id="play-btn">Animate Months</button>
      <input type="range" id="slider" min="0" max="1" value="0" style="flex-grow: 1; margin: 0 10px;">
      <div id="time-display">Ready</div>
    </div>
  </div>
  
  <!-- Sidebar -->
  <div id="sidebar">
    <div id="zone-section">
      <h4>Retail Territories</h4>
      <div id="zone-list"></div>
    </div>
  </div>
</div>

<!-- 2. MODALS -->

<!-- Filter Configuration Modal (JS Mount Point) -->
<dialog id="filter-modal">
  <div class="modal-header">
    <span>⚙️ Configure Data Query</span>
    <button onclick="document.getElementById('filter-modal').close()" class="close-btn">&times;</button>
  </div>
  <div style="padding: 20px; background: white;">
    <div id="picker-mount-point"></div>
  </div>
</dialog>

<!-- Setup Modal -->
<dialog id="setup-modal" style="border: none; border-radius: 8px; padding: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 90vw; width: 800px;">
  <div class="modal-header">
    <span>⚙️ Setup Guide</span>
    <button onclick="document.getElementById('setup-modal').close()" class="close-btn">&times;</button>
  </div>
  <div id="setup-content" style="padding: 30px; background: white; max-height: 90vh; overflow-y: auto; font-family: sans-serif; line-height: 1.6;">
      <div style="text-align:center; color:#999;">Loading Setup Guide...</div>
  </div>
</dialog>

<!-- Guide Modal -->
<dialog id="guide-modal" style="border: none; border-radius: 8px; padding: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 90vw; width: 800px;">
  <div class="modal-header">
    <span>📖 User Guide</span>
    <button onclick="document.getElementById('guide-modal').close()" class="close-btn">&times;</button>
  </div>
  <div id="guide-content" style="padding: 30px; background: white; max-height: 90vh; overflow-y: auto; font-family: sans-serif; line-height: 1.6;">
      <div style="text-align:center; color:#999;">Loading User Guide...</div>
  </div>
</dialog>

<!-- 3. INITIALIZATION & CONTENT LOADING -->
```js
import { marked } from "npm:marked"; 
import { initApp } from "./components/map.js";
import { initInfoModals, displayCurrentFilter } from "./components/ui.js";
import { filter, saveFilter } from "./components/filter.js";
import { dateTimeRangePicker } from "./components/picker.js";

// 1. Initialize UI
initInfoModals();

// 2. Initialize Picker
const picker = dateTimeRangePicker({
  width: 750, 
  minYear: 2020,
  maxYear: 2026,
  initialStartYear: filter.startYear || 2020,
  initialEndYear: filter.endYear || 2026,
  initialMonths: filter.months || [],
});

// 3. Mount Picker
const mountPoint = document.getElementById("picker-mount-point");
if (mountPoint) {
    mountPoint.innerHTML = "";
    mountPoint.appendChild(picker);
}

// 4. Handle Live Updates (Visual only)
picker.addEventListener('input', (e) => {
  const val = picker.value;
  if (!val) return;

  const isAllMonths = val.months && val.months.length === 12;

  const newFilterState = {
    startYear: val.startYear,
    endYear: val.endYear,
    months: isAllMonths ? null : val.months, 
  };

  saveFilter(newFilterState);
  displayCurrentFilter(newFilterState);
});

// 5. Handle APPLY Button (Reloads Data)
picker.addEventListener('apply', (e) => {
  console.log("✅ Apply button clicked");
  
  // Get the latest values from the picker
  const val = picker.value;

  // Close modal
  const modal = document.getElementById('filter-modal');
  if (modal) modal.close();

  // Show loading state
  displayCurrentFilter(val, "Loading Data...");

  // Reload page with new URL parameters
  setTimeout(() => {
    const url = new URL(window.location);
    
    // --- KEY FIX: Save the Years to URL ---
    url.searchParams.set("start_year", val.startYear);
    url.searchParams.set("end_year", val.endYear);
    
    // Save Months
    if (val.months && val.months.length > 0 && val.months.length < 12) {
        url.searchParams.set("months", val.months.join(","));
    } else {
        url.searchParams.delete("months");
    }

    url.searchParams.set("fetch", "true");
    window.location.href = url.toString();
  }, 100);
});

// 6. Initial Header Display
displayCurrentFilter(filter);

function lockTopControlBoxSize() {
  const priceBox = document.querySelector('.top-controls-wrapper .price-selector');
  const filterBox = document.getElementById('filter-trigger');
  if (!priceBox || !filterBox) return;

  // First measure natural loaded size.
  priceBox.style.width = 'auto';
  priceBox.style.height = 'auto';
  filterBox.style.height = 'auto';

  const priceRect = priceBox.getBoundingClientRect();
  const filterRect = filterBox.getBoundingClientRect();

  const targetHeight = Math.ceil(Math.max(priceRect.height, filterRect.height));
  const priceWidth = Math.ceil(priceRect.width);
  if (!filterBox.dataset.initialWidth) {
    filterBox.dataset.initialWidth = `${Math.ceil(filterRect.width)}px`;
  }

  // Keep price width fixed; keep filter at its loaded wider width.
  priceBox.style.width = `${priceWidth}px`;
  filterBox.style.width = filterBox.dataset.initialWidth;
  priceBox.style.height = `${targetHeight}px`;
  filterBox.style.height = `${targetHeight}px`;
}

setTimeout(lockTopControlBoxSize, 0);
window.addEventListener('load', lockTopControlBoxSize, {once: true});


// =========================================================
// DOCS & MAP LOADING
// =========================================================

function cleanMarkdown(text) {
  // FIX: Use hex code \x2d for hyphen (-) to prevent the Markdown parser
  // from seeing '---' and breaking the file structure.
  const dash = "\x2d\x2d\x2d"; 
  const pattern = "^" + dash + "[\\s\\S]*?" + dash;
  const regex = new RegExp(pattern);
  return text.replace(regex, '').trim();
}

(async () => {
  try {
    const [setupText, guideText] = await Promise.all([
      FileAttachment("./SETUP.md").text(),
      FileAttachment("./USER_GUIDE.md").text()
    ]);

    const setupEl = document.getElementById('setup-content');
    if (setupEl) setupEl.innerHTML = marked.parse(cleanMarkdown(setupText));

    const guideEl = document.getElementById('guide-content');
    if (guideEl) guideEl.innerHTML = marked.parse(cleanMarkdown(guideText));
    
  } catch (err) {
    console.error("Error loading docs:", err);
  }
})();

const btnGuide = document.getElementById('btn-guide');
if (btnGuide) {
  btnGuide.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('guide-modal');
    if (modal) modal.showModal();
    const menu = document.getElementById('header-help-menu');
    if (menu) menu.style.display = 'none';
  });
}

const btnSetup = document.getElementById('btn-setup');
if (btnSetup) {
  btnSetup.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('setup-modal');
    if (modal) modal.showModal();
    const menu = document.getElementById('header-help-menu');
    if (menu) menu.style.display = 'none';
  });
}

// Initialize Map App
initApp();

document.addEventListener('click', function(event) {
  const menu = document.getElementById('header-help-menu');
  const btn = event.target.closest('.header-btn');
  if (menu && menu.style.display === 'block' && !btn && !menu.contains(event.target)) {
    menu.style.display = 'none';
  }
});
