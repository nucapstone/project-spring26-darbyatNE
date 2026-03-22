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
        zoom: 5,
        center: [-85, 38.6],
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
    controller.init(map); // Initialize the controller's map listeners

    // 3. Map Load Logic
    map.on('load', async () => {
        try {
            // Fetch service territories
            const shapesResponse = await fetch(`${API_BASE_URL}/api/service-terr`);
            const shapes = await shapesResponse.json();

            window.pjmGeoJsonData = shapes;
            if (controller.contourLayer) {
                controller.contourLayer.generateMaskFromZones(shapes);
            }

            // Map the Database columns to the App's expected properties
            shapes.features.forEach(f => {
                const dbName = f.properties.name || "Unknown";
                f.properties.Zone_Name = dbName; 
                f.properties.Zone_Code = dbName; // Used for coloring and matching
                f.properties.Zone_FullName = dbName; 
            });

            // --- COLOR GENERATION LOGIC ---
            const uniqueZones = [...new Set(shapes.features.map(f => f.properties.Zone_Code))].sort();
            const zoneColorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(uniqueZones);

            const fillColorExpression = ['match', ['get', 'Zone_Code']];
            uniqueZones.forEach(zone => {
                fillColorExpression.push(zone, zoneColorScale(zone));
            });
            fillColorExpression.push('#cccccc'); // Fallback color

            // Save the locational colors to the controller so we can toggle back to them
            controller.locationalColorExpression = fillColorExpression;

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

            // Add sources
            map.addSource('serviceTerritories', { type: 'geojson', data: shapes });
            map.addSource('zoneLabelPoints', { type: 'geojson', data: { type: 'FeatureCollection', features: labelFeatures } });
            
            // --- LAYERS ---
            map.addLayer({ 
                id: 'serviceTerritoryFill', 
                type: 'fill', 
                source: 'serviceTerritories', 
                layout: { 'visibility': 'visible' },
                paint: { 
                    "fill-color": fillColorExpression, 
                    "fill-opacity": 0.7 
                } 
            });

            map.addLayer({
                id: 'serviceTerritoryFill-3d',
                type: 'fill-extrusion',
                source: 'serviceTerritories',
                layout: { 'visibility': 'none' },
                paint: {
                    'fill-extrusion-color': fillColorExpression, 
                    'fill-extrusion-height': 0, 
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 0.9,
                    'fill-extrusion-vertical-gradient': true
                }
            });
            
            map.addLayer({ 
                id: 'serviceTerritoryLines', 
                type: 'line', 
                source: 'serviceTerritories', 
                paint: { 'line-color': '#000', 'line-width': 1.5 } 
            });
            
            map.addLayer({ 
                id: 'serviceTerritoryLines-selected', 
                type: 'line', 
                source: 'serviceTerritories', 
                paint: { 'line-color': '#000', 'line-width': 5 },
                filter: ['==', 'Zone_Code', ''] 
            });
            
            map.addLayer({ 
                id: 'serviceTerritoryLabels', 
                type: 'symbol', 
                source: 'zoneLabelPoints', 
                layout: { 
                    'text-field': ['get', 'Label_Text'], 
                    'text-size': 12, 
                    'text-allow-overlap': false, 
                    'text-ignore-placement': false 
                }, 
                paint: { 
                    'text-color': '#000000', 
                    'text-halo-color': '#FFFFFF', 
                    'text-halo-width': 1 
                } 
            });
            
            // --- Fetch LMP Data for Retail Territories ---
            const lmpResponse = await fetch(`${API_BASE_URL}/api/retail_lmps`).catch(error => {
                console.error("Network error fetching LMP data:", error);
                return null;
            });

            let lmpData = [];
            if (lmpResponse && lmpResponse.ok) {
                try {
                    const responseData = await lmpResponse.json();
                    if (responseData && Array.isArray(responseData.data)) {
                        lmpData = responseData.data;
                    }
                } catch (error) {
                    console.error("Error parsing LMP data JSON:", error);
                }
            }

            const lmpFeatures = lmpData.map((lmp) => {
                const lat = parseFloat(lmp.latitude);
                const lon = parseFloat(lmp.longitude);
                
                if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    return null;
                }
                
                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [lon, lat] },
                    properties: {
                        service_territory: lmp.service_territory || 'Unknown',
                        name: lmp.name || 'N/A',
                        pnode_id: lmp.pnode_id || 'N/A',
                        type: lmp.type || 'N/A',
                        voltage: lmp.voltage || 'N/A',
                        latitude: lat, 
                        longitude: lon, 
                        location_context: lmp.location_context || 'N/A'
                    }
                };
            }).filter(feature => feature !== null);

            map.addSource('retailLmpPins', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: lmpFeatures }
            });

            map.addLayer({
                id: 'retailLmpPinsLayer',
                type: 'circle', 
                source: 'retailLmpPins',
                layout: { 'visibility': 'visible' },
                paint: {
                    'circle-radius': 6,
                    'circle-color': ['match', ['get', 'service_territory'], ...fillColorExpression.slice(2)], 
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#FFFFFF'
                }
            }, 'serviceTerritoryLabels');

            // Add hover popup for pins
            const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

            map.on('mouseenter', 'retailLmpPinsLayer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                const coordinates = e.features[0].geometry.coordinates.slice();
                const props = e.features[0].properties;

                const description = `
                    <h4>${props.service_territory}</h4>
                    <p><strong>Name:</strong> ${props.name}</p>
                    <p><strong>PNode ID:</strong> ${props.pnode_id}</p>
                    <p><strong>Type:</strong> ${props.type}</p>
                    <p><strong>Voltage:</strong> ${props.voltage}</p>
                    <p><strong>Latitude:</strong> ${props.latitude.toFixed(3)}</p>
                    <p><strong>Longitude:</strong> ${props.longitude.toFixed(3)}</p>
                    <p><strong>Location Context:</strong> ${props.location_context}</p>
                `;

                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                }

                popup.setLngLat(coordinates).setHTML(description).addTo(map);
            });

            map.on('mouseleave', 'retailLmpPinsLayer', () => {
                map.getCanvas().style.cursor = '';
                popup.remove();
            });
            
            // --- GENERATE LEGEND ---
            const legendEl = document.getElementById('legend');
            if (legendEl) {
                legendEl.style.display = 'block';
                
                const legendItems = uniqueZones.map(zone => {
                    const color = zoneColorScale(zone);
                    return `
                        <div style="display: flex; align-items: center; margin-bottom: 4px;">
                            <span style="background-color: ${color}; width: 15px; height: 15px; display: inline-block; margin-right: 8px; border: 1px solid #ccc;"></span>
                            <span style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${zone}</span>
                        </div>
                    `;
                }).join('');

                legendEl.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">Territories</div>
                    <div style="max-height: 300px; overflow-y: auto; overflow-x: hidden;">
                        ${legendItems}
                    </div>
                `;
            }
            
            // Update Zone List (Sidebar)
            const zoneListEl = document.getElementById('zone-list');
            const zones = [
                { name: "PJM", center: [-85, 38.6] }, 
                ...shapes.features.map(f => ({ name: f.properties.Zone_Code, center: d3.geoCentroid(f) })).sort((a, b) => a.name.localeCompare(b.name))
            ];
            
            if (zoneListEl) {
                zoneListEl.innerHTML = zones.map(z => `<div class="zone-item" data-zone-name="${z.name}"><span class="zone-name">${z.name}</span><span class="zone-price"></span></div>`).join('');
                
                zoneListEl.addEventListener('click', (e) => {
                    const item = e.target.closest('.zone-item');
                    if (!item) return;

                    document.querySelectorAll('.zone-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');

                    const zData = zones.find(z => z.name === item.dataset.zoneName);
                    
                    if (zData) {
                        if (zData.name === 'PJM') {
                            const is3D = map.getPitch() > 10;
                            map.flyTo({ center: zData.center, zoom: 5, pitch: is3D ? 30 : 0, bearing: is3D ? -2 : 0, essential: true });
                            controller.selectedZoneName = null;
                            map.setFilter('serviceTerritoryLines-selected', ['==', 'Zone_Code', '']);
                        } else {
                            map.setFilter('serviceTerritoryLines-selected', ['==', 'Zone_Code', zData.name]);
                            map.flyTo({ center: zData.center, zoom: 6, pitch: map.getPitch(), bearing: map.getBearing() });
                            controller.selectedZoneName = zData.name;
                        }
                        controller.updateZoneBorders();
                        controller.renderCurrentView();
                    }
                });
            }

            zonePlotManager.initialize(map, filter);
            window.zonePlotManager = zonePlotManager;

            // Hover Logic for Sidebar scrolling
            ['serviceTerritoryFill', 'serviceTerritoryFill-3d'].forEach(layerId => {
                map.on('click', layerId, (e) => {
                    const feature = e.features[0];
                    const zoneCode = feature.properties.Zone_Code; 
                    map.setFilter('serviceTerritoryLines-selected', ['==', 'Zone_Code', zoneCode]);
                    const zData = zones.find(z => z.name === zoneCode);
                    if (zData) {
                        map.flyTo({ center: zData.center, zoom: 6, pitch: map.getPitch(), bearing: map.getBearing() });
                        document.querySelectorAll('.zone-item').forEach(i => i.classList.remove('selected'));
                        const listItem = document.querySelector(`.zone-item[data-zone-name="${zoneCode}"]`);
                        if (listItem) {
                            listItem.classList.add('selected');
                            listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                        controller.selectedZoneName = zoneCode;
                    }
                });
            });

            if (!filter.startDate) {
                const today = new Date().toISOString().split('T')[0];
                Object.assign(filter, { startDate: today, endDate: today, startTime: 0, endTime: 24, daysOfWeek: Array(7).fill(true) });
            }
            displayCurrentFilter(filter);
            
            // Fetch the price data in the background!
            controller.loadData(filter);

        } catch (e) { console.error("Map Load Error", e); }
    });

    // 4. Bind DOM Controls (Layer Toggles & View Mode)
    const priceSelectorBox = document.querySelector('.price-selector'); 
    const legendBox = document.getElementById('legend'); 
    const priceLabel = document.querySelector('.price-label'); 
    
    // Remove master highlight box and hide legend on load
    if (priceSelectorBox) priceSelectorBox.classList.remove('highlighted');
    if (legendBox) legendBox.style.display = 'none';

    // --- A. Master View Toggle (Clicking the Text Label) ---
    if (priceLabel) {
        // Start by displaying "Locational View" since that's the default map state
        priceLabel.innerHTML = 'Locational View &rarr;';
        priceLabel.style.cursor = 'pointer';
        priceLabel.style.padding = '4px 8px';
        priceLabel.style.borderRadius = '4px';
        priceLabel.style.transition = 'background 0.2s';
        
        // Hover effect to make it feel clickable
        priceLabel.onmouseenter = () => priceLabel.style.background = '#e9ecef';
        priceLabel.onmouseleave = () => priceLabel.style.background = 'transparent';

        priceLabel.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Check if the label currently says Locational View
            const isLocational = priceLabel.innerHTML.includes('Locational View');
            
            if (isLocational) {
                // SWITCHING TO PRICE VIEW
                priceLabel.innerHTML = 'Price View &rarr;';
                if (legendBox) legendBox.style.display = 'block';
                buildLegend(COLOR_SCALE, "Retail Price ($/MWh)"); 
                controller.setPriceType('retail'); // Triggers the heatmap
            } else {
                // SWITCHING BACK TO LOCATIONAL VIEW
                priceLabel.innerHTML = 'Locational View &rarr;';
                if (legendBox) legendBox.style.display = 'none';
                controller.setPriceType('locational'); // Resets to default colors
            }
        });
    }

    // --- B. Independent Layer Toggles (Retail = Shapes, Wholesale = Pins) ---
    const retailInput = document.getElementById('price-retail');
    const wholesaleInput = document.getElementById('price-wholesale');

    const updateCheckboxStyles = () => {
        const retailLabel = document.querySelector('label[for="price-retail"]');
        const wholesaleLabel = document.querySelector('label[for="price-wholesale"]');
        
        // Highlight in blue when active
        if (retailLabel && retailInput) {
            retailLabel.style.color = retailInput.checked ? '#007bff' : '#555';
            retailLabel.style.fontWeight = retailInput.checked ? 'bold' : 'normal';
        }
        if (wholesaleLabel && wholesaleInput) {
            wholesaleLabel.style.color = wholesaleInput.checked ? '#007bff' : '#555';
            wholesaleLabel.style.fontWeight = wholesaleInput.checked ? 'bold' : 'normal';
        }
    };

    const handleLayerToggle = () => {
        updateCheckboxStyles();
        const showRetail = retailInput ? retailInput.checked : true;
        const showWholesale = wholesaleInput ? wholesaleInput.checked : true;
        
        // Tell the controller to show/hide the specific map layers
        controller.toggleLayerVisibility(showRetail, showWholesale);
    };

    // Initialize styles and listeners
    updateCheckboxStyles();
    if (retailInput) retailInput.addEventListener('change', handleLayerToggle);
    if (wholesaleInput) wholesaleInput.addEventListener('change', handleLayerToggle);

    // Play Button
    const playBtn = document.getElementById('play-btn');
    if (playBtn) { playBtn.onclick = () => controller.togglePlay(); }

    // Average Button
    const avgBtn = document.getElementById('avg-btn');
    if (avgBtn) { avgBtn.onclick = () => { controller.stopAnimation(); controller.renderAverageView(); }; }

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
    if (speedSlider) { speedSlider.oninput = (e) => controller.setPlaybackSpeed(parseInt(e.target.value)); }

    // Filter Trigger (Top Label)
    const filterBtn = document.getElementById('filter-trigger'); 
    const modal = document.getElementById('filter-modal');
    const mountPoint = document.getElementById('picker-mount-point');

    if (filterBtn && modal && mountPoint) {
        filterBtn.onclick = async () => {
            mountPoint.innerHTML = ''; 

            const picker = dateTimeRangePicker({
                width: 520, 
                initialStartYear: filter.startYear, 
                initialEndYear: filter.endYear,     
                initialMonths: filter.months,       
                initialStartTime: filter.startTime,
                initialEndTime: filter.endTime,
                initialStartDate: filter.startDate,
                initialEndDate: filter.endDate,
                initialDaysOfWeek: filter.daysOfWeek,
            });

            picker.addEventListener('apply', (e) => {
                const newFilter = e.detail;
                Object.assign(filter, newFilter);
                saveFilter(filter);
                displayCurrentFilter(filter);
                
                // --- NEW LOGIC ADDED HERE ---
                // Automatically switch the UI and Map to 'Retail' view so the user 
                // sees the heatmap they just loaded (this also hides the pins!)
                const retailRadio = document.querySelector('input[value="retail"]');
                if (retailRadio) retailRadio.checked = true;
                controller.setPriceType('retail');
                // ----------------------------

                controller.loadData(filter);
                modal.close();
            });

            mountPoint.appendChild(picker);
            modal.showModal();
        };
    }
}
