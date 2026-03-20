import maplibregl from "npm:maplibre-gl";
import { API_BASE_URL } from "../utils/config.js";
import { displayCurrentFilter } from "../components/ui.js";

export class MapController {
    constructor(map, uiElements = {}) {
        this.map = map;
        this.ui = uiElements; 

        this.popup = null;
        this.congestionHelpPopup = null;
        
        // Data State
        this.zoneData = [];
        this.zonePrices = {}; 
        
        // Filter & View State
        this.currentFilter = {};
        this.activePriceType = 'locational'; // Defaults to locational view
        this.selectedZoneName = 'PJM'; 
        this.locationalColorExpression = null; // Stores the D3 colors from map.js

        // Animation State
        this.isPlaying = false;
        this.animationTimer = null;
        this.playbackSpeed = 1000; // Default 1 second per frame
        this.currentTimeIndex = 0;
        this.contourLayer = null; // Referenced in map.js
    }

    async init(map) {
        this.map = map;

        this.popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'zone-hover-popup'
        });

        this.map.on('mousemove', 'serviceTerritoryFill', (e) => this.handleMouseMove(e));
        this.map.on('mouseleave', 'serviceTerritoryFill', () => {
            this.map.getCanvas().style.cursor = '';
            this.popup.remove();
        });
        
        this.map.on('click', 'serviceTerritoryFill', (e) => this.handleMapClick(e));
    }

    // ==========================================
    // DATA LOADING & CALCULATION
    // ==========================================

    async loadData(filter) {
        this.currentFilter = filter;
        
        if (!filter.startYear || !filter.endYear) {
            console.warn("MapController: Missing years in filter, skipping API load.");
            return;
        }

        if (typeof displayCurrentFilter === 'function') {
            displayCurrentFilter(filter);
        }
        
        try {
            const url = new URL(`${API_BASE_URL}/api/service_territory_price_data`);
            url.searchParams.append('startYear', filter.startYear);
            url.searchParams.append('endYear', filter.endYear);
            
            if (filter.months && filter.months.length > 0 && filter.months.length < 12) {
                const apiMonths = filter.months.map(m => m + 1);
                url.searchParams.append('months', apiMonths.join(','));
            }

            const response = await fetch(url.toString());
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            this.zoneData = result.data || []; 
            
            this.calculateZonePrices();
            this.renderData();
            
            if (typeof displayCurrentFilter === 'function') {
                displayCurrentFilter(filter);
            }
            
        } catch (error) {
            console.error("Error fetching territory price data:", error);
            if (typeof displayCurrentFilter === 'function') {
                displayCurrentFilter(filter, "Error loading data");
            }
            this.zoneData = [];
            this.renderData();
        }
    }

    calculateZonePrices() {
        if (this.activePriceType === 'locational') return; // No math needed for locational view

        this.zonePrices = {};
        const zoneAggregates = {};

        // Group and sum the data by territory
        this.zoneData.forEach(row => {
            const zoneName = row.service_territory;
            if (!zoneName) return;

            let price = this.activePriceType === 'wholesale' ? row.wholesale_price : row.retail_total;

            if (price !== null && price !== undefined) {
                if (!zoneAggregates[zoneName]) {
                    zoneAggregates[zoneName] = { sum: 0, count: 0 };
                }
                zoneAggregates[zoneName].sum += price;
                zoneAggregates[zoneName].count += 1;
            }
        });

        // Calculate the average for the selected time period
        const averagedPrices = {};
        for (const [zone, data] of Object.entries(zoneAggregates)) {
            averagedPrices[zone] = data.sum / data.count;
        }

        this.zonePrices = averagedPrices;
    }

    // ==========================================
    // RENDERING & VISUALS
    // ==========================================

    renderData() {
        if (!this.map || !this.map.getSource('serviceTerritories')) return;

        // --- 1. Handle Locational View ---
        if (this.activePriceType === 'locational' && this.locationalColorExpression) {
            this.map.setPaintProperty('serviceTerritoryFill', 'fill-color', this.locationalColorExpression);
            if (this.map.getLayer('serviceTerritoryFill-3d')) {
                this.map.setPaintProperty('serviceTerritoryFill-3d', 'fill-extrusion-color', this.locationalColorExpression);
            }
            
            // Show the LMP pins in Locational View
            if (this.map.getLayer('retailLmpPinsLayer')) {
                this.map.setLayoutProperty('retailLmpPinsLayer', 'visibility', 'visible');
            }
            
            this.updateZoneBorders();
            return;
        }

        // --- 2. Handle Price Heatmap View ---
        
        // Hide the LMP pins when looking at prices
        if (this.map.getLayer('retailLmpPinsLayer')) {
            this.map.setLayoutProperty('retailLmpPinsLayer', 'visibility', 'none');
        }

        const expression = ['match', ['get', 'Zone_Code']];
        const values = Object.values(this.zonePrices);
        
        if (values.length === 0) {
            this.map.setPaintProperty('serviceTerritoryFill', 'fill-color', '#ccc');
            if (this.map.getLayer('serviceTerritoryFill-3d')) {
                this.map.setPaintProperty('serviceTerritoryFill-3d', 'fill-extrusion-color', '#ccc');
            }
            return;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        
        for (const [zoneName, price] of Object.entries(this.zonePrices)) {
            expression.push(zoneName);
            expression.push(this.getColorForPrice(price, min, max));
        }

        expression.push('#ccc'); // Fallback

        this.map.setPaintProperty('serviceTerritoryFill', 'fill-color', expression);
        if (this.map.getLayer('serviceTerritoryFill-3d')) {
            this.map.setPaintProperty('serviceTerritoryFill-3d', 'fill-extrusion-color', expression);
        }
        
        this.updateZoneBorders();
    }

    getColorForPrice(price, min, max) {
        if (price < 0) return '#4575b4'; 
        if (min === max) return '#fdae61'; 

        const ratio = (price - min) / (max - min);

        // Smooth gradient from Light Yellow to Dark Red
        if (ratio < 0.2) return '#ffffb2';
        if (ratio < 0.4) return '#fecc5c';
        if (ratio < 0.6) return '#fd8d3c';
        if (ratio < 0.8) return '#f03b20';
        return '#bd0026'; 
    }

    setPriceType(type) {
        this.activePriceType = type;
        this.calculateZonePrices();
        this.renderData();
    }

    renderCurrentView() {
        this.renderData();
    }

    updateZoneBorders() {
        const targetZone = this.selectedZoneName || '';

        if (this.map.getLayer('serviceTerritoryLines-selected')) {
            if (targetZone && targetZone !== 'PJM') {
                this.map.setFilter('serviceTerritoryLines-selected', ['==', 'Zone_Code', targetZone]);
                this.map.setPaintProperty('serviceTerritoryLines-selected', 'line-color', '#000000');
            } else {
                this.map.setFilter('serviceTerritoryLines-selected', ['==', 'Zone_Code', '']);
            }
        }

        if (this.congestionHelpPopup) { 
            this.congestionHelpPopup.remove(); 
            this.congestionHelpPopup = null; 
        }
    }

    // ==========================================
    // INTERACTION (HOVER & CLICK)
    // ==========================================

    handleMapClick(e) {
        const features = this.map.queryRenderedFeatures(e.point, { 
            layers: ['serviceTerritoryFill', 'serviceTerritoryFill-3d'] 
        });

        if (features.length > 0) {
            const clickedZone = features[0].properties.Zone_Code;
            this.selectedZoneName = clickedZone;
            this.updateZoneBorders();
        }
    }

    handleMouseMove(e) {
        // NEW: If we are in Locational View, don't show the territory popup at all
        if (this.activePriceType === 'locational') {
            this.map.getCanvas().style.cursor = '';
            this.popup.remove();
            return;
        }

        const features = this.map.queryRenderedFeatures(e.point, { layers: ['serviceTerritoryFill'] });
        
        if (!e.lngLat) return; 

        if (features.length > 0) {
            this.map.getCanvas().style.cursor = 'pointer';
            
            const zoneName = features[0].properties.Zone_Code;
            const price = this.zonePrices[zoneName] !== undefined ? this.zonePrices[zoneName] : null;

            const html = this.createZonePopupHTML(zoneName, this.activePriceType, price);
            
            this.popup
                .setLngLat(e.lngLat)
                .setHTML(html)
                .addTo(this.map);
        } else {
            this.map.getCanvas().style.cursor = '';
            this.popup.remove();
        }
    }


    createZonePopupHTML(zoneName, priceType, value) {
        const formattedPrice = value !== null ? `$${value.toFixed(2)}` : 'N/A';
        
        let label = 'View';
        if (priceType === 'locational') label = 'Locational View';
        else if (priceType === 'retail') label = 'Retail Price';
        else if (priceType === 'wholesale') label = 'Wholesale Price';

        const priceDisplay = priceType === 'locational' 
            ? `<span style="color:#888; font-style:italic;">Select a price view to see data</span>`
            : `<span class="zone-popup-value" style="font-weight:bold; color:#007bff;">${formattedPrice}</span>`;

        return `
            <div class="zone-popup-content" style="font-family: sans-serif; padding: 5px;">
                <strong class="zone-popup-header" style="display:block; margin-bottom:4px; font-size:13px;">${zoneName}</strong>
                <div style="font-size:12px;">
                    <span class="zone-popup-label" style="color:#666;">${label}:</span> 
                    ${priceDisplay}
                </div>
            </div>
        `;
    }

    // ==========================================
    // ANIMATION & TIME CONTROLS (From map.js)
    // ==========================================

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        if (this.ui.playBtn) {
            this.ui.playBtn.innerText = this.isPlaying ? 'Pause' : 'Play';
        }
        if (this.isPlaying) {
            this.runAnimation();
        } else {
            this.stopAnimation();
        }
    }

    stopAnimation() {
        this.isPlaying = false;
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
            this.animationTimer = null;
        }
        if (this.ui.playBtn) {
            this.ui.playBtn.innerText = 'Play';
        }
    }

    runAnimation() {
        if (this.animationTimer) clearInterval(this.animationTimer);
        this.animationTimer = setInterval(() => {
            // Increment time step logic here
            this.currentTimeIndex++;
            // Loop back if needed, or stop
            this.renderTimeStep(this.currentTimeIndex);
            
            if (this.ui.slider) {
                this.ui.slider.value = this.currentTimeIndex;
            }
        }, this.playbackSpeed);
    }

    renderTimeStep(index) {
        this.currentTimeIndex = index;
        // Add your specific time-step rendering logic here
        // e.g., filtering this.zoneData by the specific hour/day
        this.renderData();
    }

    renderAverageView() {
        // Resets view to the averaged data
        this.calculateZonePrices();
        this.renderData();
    }

    setPlaybackSpeed(speed) {
        // Assuming speed slider gives a value where higher is faster, or just milliseconds
        this.playbackSpeed = speed;
        if (this.isPlaying) {
            this.runAnimation(); // restart interval with new speed
        }
    }
}
