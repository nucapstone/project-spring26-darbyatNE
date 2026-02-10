---
title: PJM Market Map
theme: dashboard
toc: false
sidebar: false
pager: false
---

<script>
  try { localStorage.setItem("observablehq:sidebar", "false"); } catch (e) {}
</script>

<link rel="stylesheet" href="./styles/main.css">
<link href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" rel="stylesheet" />

<!-- 1. Header With Ribbon for Help Docs & View Control -->
<div id="page-header">
  <div class="header-left"></div>
  <h1>Interactive PJM LMP Map</h1>
  
  <div class="header-right" style="display: flex; align-items: center; gap: 15px;">    
    <!-- View Mode Selector -->
    <div class="control-group" style="display: flex; align-items: center; gap: 5px;">
        <label for="view-mode-selector" style="color: white; font-size: 12px; font-weight: bold;">View:</label>
        <select id="view-mode-selector" class="header-select-box" style="padding: 4px; border-radius: 4px; border: none;">
            <option value="2d">Flat Map (2D)</option>
            <option value="3d">Height Map (3D)</option>
            <option value="contour">Heatmap (Contour)</option>
        </select>
    </div>
    <!-- Getting Started Menu -->
    <div style="position: relative;">
      <button onclick="const m = document.getElementById('header-help-menu'); m.style.display = m.style.display === 'block' ? 'none' : 'block';" 
              class="header-btn">
          🚀 Getting Started <span style="font-size: 10px;">▼</span>
      </button>
      <!-- Dropdown Menu -->
      <div id="header-help-menu" class="header-dropdown right-aligned" style="min-width: 175px;">
          <a href="#" id="btn-guide">📖 User Guide</a>
          <a href="#" id="btn-setup">⚙️ Setup Guide</a>
          <a href="#" id="btn-arch">🏗️ System Architecture</a>
      </div>
    </div>
  </div>
</div>

<!-- Top Controls (Price Type & Filter) -->
<div class="top-controls-wrapper">
  <div class="price-selector">
    <span class="price-label">Price Type &rarr;</span>
    <input type="radio" id="price-da" name="price-type" value="da" checked><label for="price-da">Day-Ahead</label>
    <input type="radio" id="price-rt" name="price-type" value="rt"><label for="price-rt">Real-Time</label>
    <input type="radio" id="price-net" name="price-type" value="net"><label for="price-net">NET</label>
    <input type="radio" id="price-cong" name="price-type" value="congestion"><label for="price-cong">Congestion</label>
  </div>

  <!-- Filter Trigger -->
  <div class="filter-container" id="filter-trigger" style="cursor: pointer; margin-left: auto;" title="Click to configure filters">
    <span class="filter-label">⚙️ Filters &rarr;</span><div id="top-filter-display"></div>
  </div>
</div>

<!-- Main Container -->
<div id="main-container">
  <div id="map-container">
    <div id="map"></div>
    <div id="legend"></div>
    <div id="controls-container">
      <!-- REMOVED: <button id="filter-btn">⚙ Filter</button> -->
      <button id="avg-btn">Avg Price View</button>
      <div id="speed-box">
        <label>Speed</label>
        <input type="range" id="speed-slider" min="100" max="3000" step="100" value="1000">
      </div>
      <button id="play-btn">Animate Hours</button>
      <input type="range" id="slider" min="0" max="1" value="0" style="flex-grow: 1; margin: 0 10px;">
      <div id="time-display">Ready</div>
    </div>
  </div>
  
  <!-- Sidebar -->
  <div id="sidebar">
    <div id="zone-section">
      <h4>PJM Zones</h4>
      <div id="zone-list"></div>
    </div>
    <div id="constraint-section">
      <div class="constraint-header-wrapper">
        <h4>Active Constraints</h4>
          <div class="c-toggle-container">
              <label><input type="radio" name="c-mode" value="global" checked disabled> Period Avg</label>
              <label><input type="radio" name="c-mode" value="current" disabled> Current Hour</label>
          </div>
      </div>
      <div id="constraint-list">
        <div class="empty-state">No active constraints</div>
      </div>
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
  <div id="setup-content" style="padding: 30px; background: white; max-height: 80vh; overflow-y: auto; font-family: sans-serif; line-height: 1.6;">
      <div style="text-align:center; color:#999;">Loading Setup Guide...</div>
  </div>
</dialog>

<!-- Guide Modal -->
<dialog id="guide-modal" style="border: none; border-radius: 8px; padding: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 90vw; width: 800px;">
  <div class="modal-header">
    <span>📖 User Guide</span>
    <button onclick="document.getElementById('guide-modal').close()" class="close-btn">&times;</button>
  </div>
  <div id="guide-content" style="padding: 30px; background: white; max-height: 80vh; overflow-y: auto; font-family: sans-serif; line-height: 1.6;">
      <div style="text-align:center; color:#999;">Loading User Guide...</div>
  </div>
</dialog>

<!-- NEW: Architecture Modal -->
<dialog id="arch-modal" style="border: none; border-radius: 8px; padding: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 90vw; width: 800px;">
  <div class="modal-header">
    <span>🏗️ System Architecture</span>
    <button onclick="document.getElementById('arch-modal').close()" class="close-btn">&times;</button>
  </div>
  <div id="arch-content" style="padding: 30px; background: white; max-height: 80vh; overflow-y: auto; font-family: sans-serif; line-height: 1.6;">
      <div style="text-align:center; color:#999;">Loading Architecture...</div>
  </div>
</dialog>

<!-- 3. INITIALIZATION & CONTENT LOADING -->
```js
import { marked } from "npm:marked"; 

import { initApp } from "./components/map.js";
import { initInfoModals } from "./components/ui.js";

// 1. Initialize UI (Buttons & Modals)
initInfoModals();

// 2. Helper to strip YAML frontmatter
function cleanMarkdown(text) {
  return text.replace(/^---[\s\S]*?---/, '').trim();
}

// 3. Load Content (Setup, Guide, Architecture)
(async () => {
  try {
    const [setupText, guideText, archText] = await Promise.all([
      FileAttachment("./SETUP.md").text(),
      FileAttachment("./USER_GUIDE.md").text(),
      FileAttachment("./ARCHITECTURE.md").text()
    ]);

    document.getElementById('setup-content').innerHTML = marked.parse(cleanMarkdown(setupText));
    document.getElementById('guide-content').innerHTML = marked.parse(cleanMarkdown(guideText));
    document.getElementById('arch-content').innerHTML = marked.parse(cleanMarkdown(archText));
    
  } catch (err) {
    console.error("Error loading docs:", err);
  }
})();

// 4. Architecture Button logic
const btnArch = document.getElementById('btn-arch');
if (btnArch) {
  btnArch.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('arch-modal').showModal();
    document.getElementById('header-help-menu').style.display = 'none';
  });
}

// 5. Initialize Map App
initApp();

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const menu = document.getElementById('header-help-menu');
  const btn = event.target.closest('.header-btn');
  if (menu && menu.style.display === 'block' && !btn && !menu.contains(event.target)) {
    menu.style.display = 'none';
  }
});
```