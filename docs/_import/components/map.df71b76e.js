import maplibregl from "../../_npm/maplibre-gl@5.15.0/4c3c9e9c.js";
import * as d3 from "../../_npm/d3@7.9.0/e780feca.js";

import { filter, saveFilter } from "./filter.9314faac.js"; 
import { buildLegend, displayCurrentFilter } from "./ui.1db8755a.js";
import { zonePlotManager } from "./zone_plot.c7713518.js";
import { dateTimeRangePicker } from "./picker.0a54784a.js"; 

// 1. Removed ZONE_LABEL_OVERRIDES from the import
import { API_BASE_URL, NET_COLOR_SCALE, STATIC_DEMO_MODE, DEMO_DATA_PATHS } from "../utils/config.9b02fc7a.js";
import { MapController } from "../managers/app_controller.28b0b429.js";

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return response.json();
}

export function initApp() {
    // 1. Initialize Map
    const map = new maplibregl.Map({
        container: "map",
        zoom: 5.4,
        center: [-82, 38.9],
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
            // Fetch service territories from live API or static demo snapshot.
            const shapes = STATIC_DEMO_MODE
                ? await fetchJson(DEMO_DATA_PATHS.territories)
                : await fetchJson(`${API_BASE_URL}/api/service-terr`);

            window.pjmGeoJsonData = shapes;
            if (controller.contourLayer) {
                controller.contourLayer.generateMaskFromZones(shapes);
            }

            // Map the Database columns to the App's expected properties
            shapes.features.forEach(f => {
                const dbName = (f.properties.name || "Unknown").trim();
                f.properties.Zone_Name = dbName; 
                f.properties.Zone_Code = dbName.toUpperCase(); // Normalize to uppercase for matching
                f.properties.Zone_FullName = dbName; 
            });

            console.log(`📍 LOADED ${shapes.features.length} SHAPES FROM /api/service-terr:`);
            console.log(shapes.features.map(f => f.properties.Zone_Code).join(", "));

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
            controller.locationalColorMap = new Map(uniqueZones.map(zone => [zone, zoneColorScale(zone)]));

            // Create conditional text color expression - white text for dark zones, black for light zones
            const textColorExpression = ['match', ['get', 'Zone_Code']];
            const darkZones = uniqueZones.filter(zone => {
                const color = zoneColorScale(zone);
                // Only the darkest colors from Tableau 10: dark blue, dark green, dark red, brown
                return color === '#1f77b4' || color === '#2ca02c' || color === '#d62728' || color === '#8c564b';
            });
            
            uniqueZones.forEach(zone => {
                // Use white text for dark zones, black for light zones
                const isDark = darkZones.includes(zone);
                textColorExpression.push(zone, isDark ? '#FFFFFF' : '#000000');
            });
            textColorExpression.push('#000000'); // Fallback to black

            // 2. Simplified Label Generation (Automatically centers on the shape)
            const labelFeatures = shapes.features.flatMap(f => {
                const zDisplay = f.properties.Zone_Code; 
                const coords = [d3.geoCentroid(f)]; // <--- Just uses the automatic center now
                
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
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-allow-overlap': false, 
                    'text-ignore-placement': false 
                }, 
                paint: { 
                    'text-color': textColorExpression, 
                    'text-halo-color': '#FFFFFF', 
                    'text-halo-width': 0.5 
                } 
            });
            
            // --- Fetch LMP Data for Retail Territories ---
            let lmpData = [];
            try {
                const lmpPayload = STATIC_DEMO_MODE
                    ? await fetchJson(DEMO_DATA_PATHS.retailLmps)
                    : await fetchJson(`${API_BASE_URL}/api/retail_lmps`);
                if (lmpPayload && Array.isArray(lmpPayload.data)) {
                    lmpData = lmpPayload.data;
                }
            } catch (error) {
                console.error("Error fetching LMP data:", error);
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
                        service_territory: (lmp.service_territory || 'Unknown').toUpperCase(),
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
                    'circle-stroke-color': '#4a4a4a'
                }
            }, 'serviceTerritoryLabels');

            // Single popup for pin clicks — close button, closes when clicking empty map
            const pinClickPopup = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: false,  // Must be false — closeOnClick:true self-closes on the creating click
                offset: [0, -10],
                anchor: 'bottom'
            });
            controller.pinPopup = pinClickPopup;

            const buildPinPopupContent = (popupProps) => {
                const zoneName = popupProps.service_territory;
                const latitude = Number(popupProps.latitude);
                const longitude = Number(popupProps.longitude);

                if (controller.activePriceType === 'locational') {
                    return `
                        <div style="font-size: 12px; max-width: 220px;">
                            <h4 style="margin: 0 0 8px 0;">${zoneName}</h4>
                            <p style="margin: 4px 0;"><strong>Name:</strong> ${popupProps.name}</p>
                            <p style="margin: 4px 0;"><strong>PNode:</strong> ${popupProps.pnode_id}</p>
                            <p style="margin: 4px 0;"><strong>Type:</strong> ${popupProps.type}</p>
                            <p style="margin: 4px 0;"><strong>Voltage:</strong> ${popupProps.voltage}</p>
                            <p style="margin: 4px 0;"><strong>Coords:</strong> ${Number.isFinite(latitude) ? latitude.toFixed(3) : 'N/A'}, ${Number.isFinite(longitude) ? longitude.toFixed(3) : 'N/A'}</p>
                            <p style="margin: 4px 0;"><strong>Location:</strong> ${popupProps.location_context}</p>
                        </div>
                    `;
                }

                const retailPriceMap = typeof controller.getCurrentRetailPrices === 'function'
                    ? controller.getCurrentRetailPrices()
                    : controller.retailPrices;
                const wholesalePriceMap = typeof controller.getCurrentWholesalePrices === 'function'
                    ? controller.getCurrentWholesalePrices()
                    : controller.wholesalePrices;
                const retailPrice = retailPriceMap ? retailPriceMap[zoneName] : null;
                const wholesalePrice = wholesalePriceMap ? wholesalePriceMap[zoneName] : null;
                const periodLabel = controller.showAverageView
                    ? 'Average over selected period'
                    : controller.monthlyFrames?.[controller.currentTimeIndex]?.label;

                let content = `<div style="font-size: 12px; min-width: 160px;">
                    <h4 style="margin: 0 0 8px 0;">${popupProps.name}</h4>
                    <p style="margin: 2px 0; font-size: 11px; color: #666;">${zoneName}</p>
                    <hr style="margin: 6px 0; border: none; border-top: 1px solid #ddd;">`;

                if (periodLabel) {
                    content += `<p style="margin: 2px 0 6px 0; font-size: 11px; color: #666;"><em>${periodLabel}</em></p>`;
                }
                if (retailPrice !== null && retailPrice !== undefined) {
                    content += `<p style="margin: 4px 0; font-weight: bold; color: #2c5aa0;">Retail: ${(retailPrice * 100).toFixed(2)}¢/kWh</p>`;
                }
                if (wholesalePrice !== null && wholesalePrice !== undefined) {
                    content += `<p style="margin: 4px 0; font-weight: bold; color: #d9534f;">Wholesale: ${(wholesalePrice * 100).toFixed(2)}¢/kWh</p>`;
                }
                if (retailPrice === null && wholesalePrice === null) {
                    content += `<p style="margin: 4px 0; color: #888;">No price data available</p>`;
                }
                content += '</div>';
                return content;
            };

            controller.buildPinPopupHTML = buildPinPopupContent;

            // Cursor feedback on hover — no popup
            map.on('mouseenter', 'retailLmpPinsLayer', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'retailLmpPinsLayer', () => {
                map.getCanvas().style.cursor = '';
            });

            // Click on pin: show location info (locational view) or price info (price view)
            map.on('click', 'retailLmpPinsLayer', (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const props = { ...e.features[0].properties };

                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                }

                controller.activePinPopupContext = {
                    coordinates: coordinates.slice(),
                    props
                };

                const content = buildPinPopupContent(props);
                pinClickPopup.setLngLat(coordinates).setHTML(content).addTo(map);

                // Reassert the newly selected pin context after reusing the popup instance.
                controller.activePinPopupContext = {
                    coordinates: coordinates.slice(),
                    props
                };
            });

            // Close the popup only when clicking away from the LMP pins.
            map.on('click', (e) => {
                const clickedPin = map.queryRenderedFeatures(e.point, { layers: ['retailLmpPinsLayer'] });
                if (!clickedPin.length && pinClickPopup.isOpen()) {
                    controller.activePinPopupContext = null;
                    pinClickPopup.remove();
                }
            });
            

            
            // Update Zone List (Sidebar)
            const zoneListEl = document.getElementById('zone-list');
            const zones = [
                { name: "PJM", center: [-82, 38.9] }, 
                ...shapes.features.map(f => ({ name: f.properties.Zone_Code, center: d3.geoCentroid(f) })).sort((a, b) => a.name.localeCompare(b.name))
            ];
            
            if (zoneListEl) {
                zoneListEl.innerHTML = zones.map(z => {
                    const label = z.name === 'PJM'
                        ? `PJM <span style="font-size: 11px; opacity: 0.8; font-weight: 500;">&lt;Click To Recenter&gt;</span>`
                        : z.name;
                    return `<div class="zone-item" data-zone-name="${z.name}"><span class="zone-name">${label}</span><span class="zone-price"></span></div>`;
                }).join('');
                
                zoneListEl.addEventListener('click', (e) => {
                    const item = e.target.closest('.zone-item');
                    if (!item) return;

                    document.querySelectorAll('.zone-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');

                    const zData = zones.find(z => z.name === item.dataset.zoneName);
                    
                    if (zData) {
                        if (zData.name === 'PJM') {
                            const is3D = map.getPitch() > 10;
                            map.flyTo({ center: zData.center, zoom: 5.4, pitch: is3D ? 30 : 0, bearing: is3D ? -2 : 0, essential: true });
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

                // Keep sidebar row colors aligned with whichever colors are active on the map.
                const getContrastText = (hexColor) => {
                    const hex = String(hexColor || '').replace('#', '');
                    if (hex.length !== 6) return '#111111';
                    const r = parseInt(hex.slice(0, 2), 16);
                    const g = parseInt(hex.slice(2, 4), 16);
                    const b = parseInt(hex.slice(4, 6), 16);
                    const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
                    return luminance < 140 ? '#ffffff' : '#111111';
                };

                const refreshZoneListColors = () => {
                    document.querySelectorAll('.zone-item').forEach((item) => {
                        const zoneName = item.dataset.zoneName;
                        if (!zoneName || zoneName === 'PJM') {
                            item.style.backgroundColor = '';
                            item.style.color = '';
                            return;
                        }

                        let fillColor = '#cccccc';
                        if (controller.activePriceType === 'locational') {
                            fillColor = controller.locationalColorMap?.get(zoneName) || '#cccccc';
                        } else if (controller.activePriceType === 'wholesale') {
                            const ws = controller.wholesalePrices?.[zoneName];
                            fillColor = ws === null || ws === undefined
                                ? '#cccccc'
                                : controller.getColorForPrice(ws, 'wholesale');
                        } else {
                            const rt = controller.retailPrices?.[zoneName];
                            fillColor = rt === null || rt === undefined
                                ? '#cccccc'
                                : controller.getColorForPrice(rt, 'retail');
                        }

                        item.style.backgroundColor = fillColor;
                        item.style.color = getContrastText(fillColor);
                    });
                };

                window.refreshZoneListColors = refreshZoneListColors;
                refreshZoneListColors();
            }

            zonePlotManager.initialize(map, filter);
            window.zonePlotManager = zonePlotManager;
            zonePlotManager.setVisibleSeries(
                document.getElementById('price-retail')?.checked !== false,
                document.getElementById('price-wholesale')?.checked !== false
            );

            // Hover Logic for Sidebar scrolling
            ['serviceTerritoryFill', 'serviceTerritoryFill-3d'].forEach(layerId => {
                map.on('click', layerId, (e) => {
                    if (controller.activePriceType !== 'locational') {
                        controller.handleMapClick(e);
                    }

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

            // Ensure the initial map starts in locational view with legend shown
            controller.setPriceType('locational');

        } catch (e) { console.error("Map Load Error", e); }
    });

    // 4. Bind DOM Controls (Layer Toggles & View Mode)
    const priceSelectorBox = document.querySelector('.price-selector'); 
    const legendBox = document.getElementById('legend'); 
    const priceLabel = document.querySelector('.price-label'); 
    
    console.log('🔍 priceLabel element found:', priceLabel);
    console.log('🔍 legendBox element found:', legendBox);
    
    // Remove master highlight box on load
    if (priceSelectorBox) priceSelectorBox.classList.remove('highlighted');
    // Show locational legend by default
    if (legendBox) legendBox.style.display = 'block';

    const syncPriceLabel = () => {
        if (!priceLabel) return;
        const isLocational = controller.activePriceType === 'locational';
        priceLabel.innerHTML = `${isLocational ? 'Locational' : 'Price'} View &rarr;`;
    };

    const setMasterView = (type) => {
        if (legendBox) legendBox.style.display = 'block';
        controller.setPriceType(type);
        syncPriceLabel();
    };

    // --- A. Master View Toggle (Clicking the Text Label) ---
    if (priceLabel) {
        // Initialize from controller state to avoid label/view drift.
        syncPriceLabel();
        priceLabel.style.cursor = 'pointer';
        priceLabel.style.padding = '4px 8px';
        priceLabel.style.borderRadius = '4px';
        priceLabel.style.transition = 'background 0.2s';
        
        // Hover effect to make it feel clickable
        priceLabel.onmouseenter = () => priceLabel.style.background = '#e9ecef';
        priceLabel.onmouseleave = () => priceLabel.style.background = 'transparent';

        priceLabel.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('🖱️ Price label clicked!');
            
            // Use controller state as source of truth.
            const isLocational = controller.activePriceType === 'locational';
            console.log('🔍 Current state - isLocational:', isLocational, 'activePriceType:', controller.activePriceType);
            
            if (isLocational) {
                console.log('✅ Switched to PRICE VIEW');
                setMasterView('retail'); 
            } else {
                console.log('✅ Switched to LOCATIONAL VIEW');
                setMasterView('locational');
            }
        });
    } else {
        console.warn('⚠️ priceLabel element NOT found! Check HTML for .price-label element');
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

        if (zonePlotManager) {
            zonePlotManager.setVisibleSeries(showRetail, showWholesale);
        }
    };

    // Initialize styles and listeners
    updateCheckboxStyles();
    if (retailInput) retailInput.addEventListener('change', handleLayerToggle);
    if (wholesaleInput) wholesaleInput.addEventListener('change', handleLayerToggle);

    // Play Button
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.onclick = () => {
            if (controller.activePriceType === 'locational') {
                setMasterView('retail');
            }

            controller.togglePlay();
        };
    }

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

    if (STATIC_DEMO_MODE && filterBtn) {
        filterBtn.style.cursor = 'not-allowed';
        filterBtn.style.opacity = '0.75';
        filterBtn.title = 'Demo snapshot mode uses a fixed date range.';
        filterBtn.onclick = () => {};
    }

    if (!STATIC_DEMO_MODE && filterBtn && modal && mountPoint) {
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
                
                // Automatically switch the UI and Map to 'Retail' view so the user 
                // sees the heatmap they just loaded (this also hides the pins!)
                const retailRadio = document.querySelector('input[value="retail"]');
                if (retailRadio) retailRadio.checked = true;
                setMasterView('retail');

                controller.loadData(filter);
                modal.close();
            });

            mountPoint.appendChild(picker);
            modal.showModal();
        };
    }
}
