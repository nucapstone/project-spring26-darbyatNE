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
            // 1. Get list of unique zone names
            const uniqueZones = [...new Set(shapes.features.map(f => f.properties.Zone_Code))].sort();

            // 2. Create a D3 Ordinal Scale
            const zoneColorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(uniqueZones);

            // 3. Build MapLibre 'match' expression
            const fillColorExpression = ['match', ['get', 'Zone_Code']];
            uniqueZones.forEach(zone => {
                fillColorExpression.push(zone, zoneColorScale(zone));
            });
            fillColorExpression.push('#cccccc'); // Fallback color

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
            // 1. Standard 2D Fill
            map.addLayer({ 
                id: 'serviceTerritoryFill', 
                type: 'fill', 
                source: 'serviceTerritories', 
                layout: { 'visibility': 'visible' },
                paint: { 
                    "fill-color": fillColorExpression, // Apply unique colors
                    "fill-opacity": 0.7 
                } 
            });

            // 2. 3D Extrusion
            map.addLayer({
                id: 'serviceTerritoryFill-3d',
                type: 'fill-extrusion',
                source: 'serviceTerritories',
                layout: { 'visibility': 'none' },
                paint: {
                    'fill-extrusion-color': fillColorExpression, // Apply unique colors
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
                paint: { 
                    'line-color': '#000', 
                    'line-width': 1.5 
                } 
            });
            
            map.addLayer({ 
                id: 'serviceTerritoryLines-selected', 
                type: 'line', 
                source: 'serviceTerritories', 
                paint: { 
                    'line-color': '#000', 
                    'line-width': 5 
                },
                filter: ['==', 'Zone_Code', ''] 
            });
            
            map.addLayer({ 
                id: 'serviceTerritoryLabels', 
                type: 'symbol', 
                source: 'zoneLabelPoints', 
                layout: { 
                    'text-field': ['get', 'Label_Text'], 
                    'text-size': 12, 
                    'text-allow-overlap': false, // Changed to false to prevent clutter if names are long
                    'text-ignore-placement': false 
                }, 
                paint: { 
                    'text-color': '#000000', 
                    'text-halo-color': '#FFFFFF', 
                    'text-halo-width': 1 
                } 
            });
            
            // --- NEW: Fetch LMP Data for Retail Territories ---
            console.log("Attempting to fetch LMP data from:", `${API_BASE_URL}/api/retail_lmps`);

            const lmpResponse = await fetch(`${API_BASE_URL}/api/retail_lmps`).catch(error => {
                console.error("Network error fetching LMP data:", error);
                return null; // Return null to indicate failure
            });

            let lmpData = [];
            if (lmpResponse && lmpResponse.ok) {
                try {
                    const responseData = await lmpResponse.json();
                    console.log("LMP Data Response (full structure for debugging):", responseData); // Log the entire response for debugging
                    
                    // Extract the array from the 'data' key as per API structure
                    if (responseData && Array.isArray(responseData.data)) {
                        lmpData = responseData.data;
                        console.log("Response contains 'data' array, using it. First few records:", responseData.data.slice(0, 3));
                        console.log("Total records in response:", responseData.count);
                    } else {
                        console.error("LMP Data response does not contain a 'data' array as expected:", responseData);
                        lmpData = []; // Fallback to empty array to prevent errors
                    }
                } catch (error) {
                    console.error("Error parsing LMP data JSON:", error);
                    lmpData = []; // Fallback to empty array
                }
            } else {
                console.error("Failed to fetch LMP data, response not OK or fetch failed:", lmpResponse ? { status: lmpResponse.status, statusText: lmpResponse.statusText } : "No response");
                console.log("Using empty dataset as fallback due to API unavailability.");
                lmpData = []; // Empty array to avoid breaking the map rendering
            }

            // Create GeoJSON for LMP Pins using latitude and longitude from retail_lmps data
            const lmpFeatures = lmpData.map((lmp, index) => {
                // Access latitude and longitude as double precision numbers
                const latVal = lmp.latitude;
                const lonVal = lmp.longitude;
                
                // Log raw values for debugging (limited to first few records)
                if (index < 5) { // Limit to first few records to avoid console clutter
                    console.log(`Record ${index} raw coordinates for ${lmp.service_territory || 'unknown'} (${lmp.name || 'N/A'}): latitude=${latVal}, longitude=${lonVal}, type of latitude=${typeof latVal}, type of longitude=${typeof lonVal}`);
                }
                
                // Parse as float to ensure numeric values (even if stored as strings)
                const lat = parseFloat(latVal);
                const lon = parseFloat(lonVal);
                
                // Check if coordinates are valid numbers; skip if not
                if (isNaN(lat) || isNaN(lon)) {
                    console.warn(`Invalid coordinates for LMP record in ${lmp.service_territory || 'unknown'} (${lmp.name || 'N/A'}): latitude=${latVal}, longitude=${lonVal}, Parsed lat=${lat}, Parsed lon=${lon}`);
                    return null;
                }
                
                // Validate geographic range for latitude and longitude
                if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    console.warn(`Out of range coordinates for LMP record in ${lmp.service_territory || 'unknown'} (${lmp.name || 'N/A'}): latitude=${lat}, longitude=${lon}`);
                    return null;
                }
                
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lon, lat] // MapLibre expects [longitude, latitude]
                    },
                    properties: {
                        service_territory: lmp.service_territory || 'Unknown',
                        name: lmp.name || 'N/A',
                        pnode_id: lmp.pnode_id || 'N/A',
                        type: lmp.type || 'N/A',
                        voltage: lmp.voltage || 'N/A',
                        latitude: lat, // Store the parsed numeric value for display
                        longitude: lon, // Store the parsed numeric value for display
                        location_context: lmp.location_context || 'N/A'
                    }
                };
            }).filter(feature => feature !== null); // Filter out invalid features

            console.log(`Total LMP records processed: ${lmpData.length}, Valid features created: ${lmpFeatures.length}`);

            const lmpGeoJson = {
                type: 'FeatureCollection',
                features: lmpFeatures
            };

            // Add source for LMP pins
            map.addSource('retailLmpPins', {
                type: 'geojson',
                data: lmpGeoJson
            });

            // Add layer for LMP pins (above zones layer)
            map.addLayer({
                id: 'retailLmpPinsLayer',
                type: 'circle', // Could also use 'symbol' for custom icons
                source: 'retailLmpPins',
                layout: {
                    'visibility': 'visible'
                },
                paint: {
                    'circle-radius': 6,
                    'circle-color': ['match', ['get', 'service_territory'], ...fillColorExpression.slice(2)], // Reuse the same color expression as territories
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#FFFFFF'
                }
            }, 'serviceTerritoryLabels'); // Place above zones but below labels if desired, adjust as needed

            // Add hover popup for metadata
            const popup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false
            });

            map.on('mouseenter', 'retailLmpPinsLayer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                const coordinates = e.features[0].geometry.coordinates.slice();
                const props = e.features[0].properties;

                // Create popup content with metadata, excluding 'zone'
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

                // Ensure popup displays even if coordinates are slightly off-screen
                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                }

                popup.setLngLat(coordinates)
                    .setHTML(description)
                    .addTo(map);
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
                ...shapes.features.map(f => ({ 
                    name: f.properties.Zone_Code, 
                    center: d3.geoCentroid(f) 
                })).sort((a, b) => a.name.localeCompare(b.name))
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
                            map.flyTo({ 
                                center: zData.center, 
                                zoom: 5, 
                                pitch: is3D ? 30 : 0, 
                                bearing: is3D ? -2 : 0, 
                                essential: true 
                            });
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

            // Hover Logic
            ['serviceTerritoryFill', 'serviceTerritoryFill-3d'].forEach(layerId => {
                map.on('mousemove', layerId, (e) => controller.handleMapHover(e));
                
                // FIXED: Check if popup exists before removing
                map.on('mouseleave', layerId, () => {
                    if (controller.hoverPopup) {
                        controller.hoverPopup.remove();
                    }
                });
                map.on('click', layerId, (e) => {
                    const feature = e.features[0];
                    const zoneCode = feature.properties.Zone_Code; 
                    map.setFilter('serviceTerritoryLines-selected', ['==', 'Zone_Code', zoneCode]);
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

            const picker = dateTimeRangePicker({
                width: 520, 
                initialStartYear: filter.startYear, // Use the start year from filter
                initialEndYear: filter.endYear,     // Use the end year from filter
                initialMonths: filter.months,       // Use the months from filter
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
                controller.loadData(filter);
                modal.close();
            });

            mountPoint.appendChild(picker);
            modal.showModal();
        };
    }
}
