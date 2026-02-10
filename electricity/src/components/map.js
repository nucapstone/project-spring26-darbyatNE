// src/components/map.js

import maplibregl from "npm:maplibre-gl";
import * as d3 from "npm:d3";

import { filter, saveFilter } from "./filter.js"; 
import { buildLegend, displayCurrentFilter } from "./ui.js";
import { zonePlotManager } from "./zone_plot.js";
import { dateTimeRangePicker } from "./picker.js"; 

import { API_BASE_URL, ZONE_LABEL_OVERRIDES, COLOR_SCALE, NET_COLOR_SCALE } from "../utils/config.js";
import { MapController } from "../managers/app_controller.js";


export function initApp() {
    // 1. Initialize Map
    const map = new maplibregl.Map({
        container: "map",
        zoom: 5.4,
        center: [-82, 38.6],
        pitch: 0, // Start Flat (2D)
        hash: true,
        style: 'https://api.maptiler.com/maps/streets/style.json?key=eDHUbUTyNqfZvtDLiUCT',
        attributionControl: false
    });
    
    window.mapInstance = map;
    
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));
    map.addControl(new maplibregl.AttributionControl(), 'bottom-right');

    // 2. Initialize Controller
    const controller = new MapController(map, {
        timeDisplay: document.getElementById('time-display'),
        slider: document.getElementById('slider'),
        playBtn: document.getElementById('play-btn'),
    });
    
    window.mapController = controller;

    // 3. Map Load Logic
    map.on('load', async () => {
        try {
            const shapesResponse = await fetch(`${API_BASE_URL}/api/zones`);
            const shapes = await shapesResponse.json();

            // 🚨 SAVE GLOBALLY & GENERATE MASK FOR CONTOURS
            window.pjmGeoJsonData = shapes;
            if (controller.contourLayer) {
                controller.contourLayer.generateMaskFromZones(shapes);
            }

            shapes.features.forEach(f => {
                f.properties.Zone_Name = f.properties.transact_z; 
                f.properties.Zone_Code = f.properties.transact_z; 
                f.properties.Zone_FullName = f.properties.zone_name; 
            });

            // Generate Label Points
            const labelFeatures = shapes.features.flatMap(f => {
                const zDisplay = f.properties.Zone_Code; 
                const coords = ZONE_LABEL_OVERRIDES[zDisplay] 
                    ? ZONE_LABEL_OVERRIDES[zDisplay].map(c => [c[1], c[0]]) 
                    : [d3.geoCentroid(f)];
                
                return coords.map(c => ({ 
                    type: 'Feature', 
                    geometry: { type: 'Point', coordinates: c }, 
                    properties: { Label_Text: zDisplay } 
                }));
            });

            map.addSource('zoneShapes', { type: 'geojson', data: shapes });
            map.addSource('zoneLabelPoints', { type: 'geojson', data: { type: 'FeatureCollection', features: labelFeatures } });
            
            // --- LAYERS ---

            // 1. Standard 2D Fill (Default Visible)
            map.addLayer({ 
                id: 'zoneFill', 
                type: 'fill', 
                source: 'zoneShapes', 
                layout: { 'visibility': 'visible' },
                paint: { 
                    "fill-color": '#cccccc', 
                    "fill-opacity": 0.7 
                } 
            });

            // 2. New 3D Extrusion (Default Hidden)
            map.addLayer({
                id: 'zoneFill-3d',
                type: 'fill-extrusion',
                source: 'zoneShapes',
                layout: { 'visibility': 'none' },
                paint: {
                    'fill-extrusion-color': '#cccccc',
                    'fill-extrusion-height': 0, // Will be updated by controller
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 0.9,
                    'fill-extrusion-vertical-gradient': true
                }
            });
            
            map.addLayer({ 
                id: 'zoneLines', 
                type: 'line', 
                source: 'zoneShapes', 
                paint: { 
                    'line-color': '#000', 
                    'line-width': 1.5 
                } 
            });
            
            map.addLayer({ 
                id: 'zoneLines-selected', 
                type: 'line', 
                source: 'zoneShapes', 
                paint: { 
                    'line-color': '#000', 
                    'line-width': 5 
                },
                filter: ['==', 'Zone_Code', ''] 
            });

            map.addLayer({ id: 'zoneLabels', type: 'symbol', source: 'zoneLabelPoints', 
                layout: { 'text-field': ['get', 'Label_Text'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true }, 
                paint: { 'text-color': '#000000', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1 } });

            // Update Zone List
            const zoneListEl = document.getElementById('zone-list');
            const zones = [
                { name: "PJM", center: [-82, 38.6] }, 
                ...shapes.features.map(f => ({ 
                    name: f.properties.Zone_Code, 
                    center: d3.geoCentroid(f) 
                })).sort((a, b) => a.name.localeCompare(b.name))
            ];
            
            if (zoneListEl) {
                zoneListEl.innerHTML = zones.map(z => `<div class="zone-item" data-zone-name="${z.name}"><span class="zone-name">${z.name}</span><span class="zone-price"></span></div>`).join('');
                
                // Handle clicks on the Zone List (Sidebar)
                zoneListEl.addEventListener('click', (e) => {
                    const item = e.target.closest('.zone-item');
                    if (!item) return;

                    document.querySelectorAll('.zone-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');

                    const zData = zones.find(z => z.name === item.dataset.zoneName);
                    
                    if (zData) {
                        if (zData.name === 'PJM') {
                            // Reset view based on current mode (2D vs 3D)
                            const is3D = map.getPitch() > 10;
                            map.flyTo({ 
                                center: zData.center, 
                                zoom: 5.4, 
                                pitch: is3D ? 30 : 0, 
                                bearing: is3D ? -2 : 0, 
                                essential: true 
                            });
                            controller.selectedZoneName = null;
                            map.setFilter('zoneLines-selected', ['==', 'Zone_Code', '']);
                        } 
                        else {
                            map.setFilter('zoneLines-selected', ['==', 'Zone_Code', zData.name]);

                            if (e.target.classList.contains('zone-checkbox')) {
                                map.flyTo({ center: [-82, 40.0 - 9], zoom: 4.3, pitch: map.getPitch(), bearing: map.getBearing() });
                            } else {
                                map.flyTo({ center: zData.center, zoom: 6, pitch: map.getPitch(), bearing: map.getBearing() });
                            }
                            
                            controller.selectedZoneName = zData.name;
                        }

                        controller.updateZoneBorders();
                        controller.renderCurrentView();
                    }
                });
            }

            zonePlotManager.initialize(map, filter);
            window.zonePlotManager = zonePlotManager;

            // Hover Logic
            ['zoneFill', 'zoneFill-3d'].forEach(layerId => {
                map.on('mousemove', layerId, (e) => controller.handleMapHover(e));
                map.on('mouseleave', layerId, () => controller.hoverPopup.remove());
                map.on('click', layerId, (e) => {
                    const feature = e.features[0];
                    const zoneCode = feature.properties.Zone_Code; 
                    map.setFilter('zoneLines-selected', ['==', 'Zone_Code', zoneCode]);
                    const zData = zones.find(z => z.name === zoneCode);
                    if (zData) {
                        map.flyTo({ 
                            center: zData.center, 
                            zoom: 6, 
                            pitch: map.getPitch(), 
                            bearing: map.getBearing() 
                        });

                        document.querySelectorAll('.zone-item').forEach(i => i.classList.remove('selected'));
                        const listItem = document.querySelector(`.zone-item[data-zone-name="${zoneCode}"]`);
                        if (listItem) {
                            listItem.classList.add('selected');
                            listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                        
                        controller.selectedZoneName = zoneCode;
                    }
                    controller.handleMapClick(e, false);
                });
            });

            buildLegend(COLOR_SCALE);
            const legendEl = document.getElementById('legend');
            if (legendEl) legendEl.style.display = 'block';

            if (!filter.startDate) {
                const today = new Date().toISOString().split('T')[0];
                Object.assign(filter, { startDate: today, endDate: today, startTime: 0, endTime: 24, daysOfWeek: Array(7).fill(true) });
            }
            displayCurrentFilter(filter);
            controller.loadData(filter);

        } catch (e) { console.error("Map Load Error", e); }
    });

    // 4. Bind DOM Controls
    const priceSelector = document.querySelector('.price-selector');
    if (priceSelector) {
        priceSelector.addEventListener('change', (e) => {
            if (e.target.type === 'radio') {
                const priceType = e.target.value;
                buildLegend((priceType === 'net' || priceType === 'congestion') ? NET_COLOR_SCALE : COLOR_SCALE);
                controller.setPriceType(priceType);
            }
        });
    }

    // NOTE: View Mode Selector logic has been moved to AppController
    
    // Play Button
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.onclick = () => controller.togglePlay();
    }

    // Average Button
    const avgBtn = document.getElementById('avg-btn');
    if (avgBtn) {
        avgBtn.onclick = () => { controller.stopAnimation(); controller.renderAverageView(); };
    }

    // Time Slider
    const slider = document.getElementById('slider');
    if (slider) {
        slider.oninput = (e) => { 
            controller.stopAnimation(); 
            const index = parseInt(e.target.value);
            controller.renderTimeStep(index); 
            
            if (zonePlotManager.timeSeriesData && zonePlotManager.timeSeriesData[index]) {
                zonePlotManager.updateTimeCursor(zonePlotManager.timeSeriesData[index].datetime);
            }
        };
    }
    
    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) {
        speedSlider.oninput = (e) => controller.setPlaybackSpeed(parseInt(e.target.value));
    }

    // Filter Trigger (Top Label)
    const filterBtn = document.getElementById('filter-trigger'); 
    const modal = document.getElementById('filter-modal');
    const mountPoint = document.getElementById('picker-mount-point');

    if (filterBtn && modal && mountPoint) {
        filterBtn.onclick = async () => {
            mountPoint.innerHTML = ''; 
            const activeConstraints = controller.constraintsData ? [...new Set(controller.constraintsData.map(c => c.monitored_facility || c.name))] : [];
            let allConstraints = [];
            try {
                const response = await fetch(`${API_BASE_URL}/api/constraints/list`, { headers: { "ngrok-skip-browser-warning": "true" } });
                if (response.ok) {
                    const data = await response.json();
                    allConstraints = data.constraints || [];
                } else {
                    allConstraints = activeConstraints;
                }
            } catch (error) {
                allConstraints = activeConstraints;
            }

            const picker = dateTimeRangePicker({
                width: 520, 
                initialStartTime: filter.startTime,
                initialEndTime: filter.endTime,
                initialStartDate: filter.startDate,
                initialEndDate: filter.endDate,
                initialDaysOfWeek: filter.daysOfWeek,
                initialConstraint: filter.selectedConstraint,
                activeConstraints: activeConstraints,
                allConstraints: allConstraints
            });

            picker.addEventListener('apply', (e) => {
                const newFilter = e.detail;
                Object.assign(filter, newFilter);
                saveFilter(filter);
                displayCurrentFilter(filter);
                controller.loadData(filter);
                modal.close();
            });

            mountPoint.appendChild(picker);
            modal.showModal();
        };
    }
}