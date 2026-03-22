import maplibregl from "npm:maplibre-gl";
import { API_BASE_URL } from "../utils/config.js";
import { displayCurrentFilter, buildLegend } from "../components/ui.js"; // <-- Added buildLegend

// ==========================================================================
// 1. COLOR SCALES (10-Step Increments)
// ==========================================================================
const COLOR_SCALE = [
    [0, '#313695'],   [20, '#4575b4'],  [40, '#74add1'],  [60, '#abd9e9'],
    [80, '#ffffbf'],  [100, '#fee090'], [125, '#fdae61'], [150, '#f46d43'],
    [200, '#d73027'], [300, '#a50026']
];

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

        toggleLayerVisibility(showRetail, showWholesale) {
        if (!this.map) return;

        const retailVisibility = showRetail ? 'visible' : 'none';
        const wholesaleVisibility = showWholesale ? 'visible' : 'none';

        // 1. Toggle Retail (Shapes & Borders)
        const retailLayers = [
            'serviceTerritoryFill', 
            'serviceTerritoryFill-3d', 
            'serviceTerritoryLines', 
            'serviceTerritoryLabels'
        ];
        
        retailLayers.forEach(layer => {
            if (this.map.getLayer(layer)) {
                this.map.setLayoutProperty(layer, 'visibility', retailVisibility);
            }
        });

        // 2. Toggle Wholesale (LMP Pins)
        if (this.map.getLayer('retailLmpPinsLayer')) {
            this.map.setLayoutProperty('retailLmpPinsLayer', 'visibility', wholesaleVisibility);
        }
    }
    
        calculateZonePrices() {
        if (this.activePriceType === 'locational') return;

        this.retailPrices = {};
        this.wholesalePrices = {};
        const zoneAggregates = {};

        // Group and sum BOTH retail and wholesale data by territory
        this.zoneData.forEach(row => {
            const zoneName = row.service_territory;
            if (!zoneName) return;

            if (!zoneAggregates[zoneName]) {
                zoneAggregates[zoneName] = { 
                    retailSum: 0, retailCount: 0, 
                    wholesaleSum: 0, wholesaleCount: 0 
                };
            }

            // Tally Retail
            if (row.retail_price !== null && row.retail_price !== undefined) {
                zoneAggregates[zoneName].retailSum += row.retail_price;
                zoneAggregates[zoneName].retailCount += 1;
            }
            
            // Tally Wholesale
            if (row.wholesale_price !== null && row.wholesale_price !== undefined) {
                zoneAggregates[zoneName].wholesaleSum += row.wholesale_price;
                zoneAggregates[zoneName].wholesaleCount += 1;
            }
        });

        // Calculate the averages for the selected time period
        for (const [zone, data] of Object.entries(zoneAggregates)) {
            this.retailPrices[zone] = data.retailCount > 0 ? (data.retailSum / data.retailCount) : null;
            this.wholesalePrices[zone] = data.wholesaleCount > 0 ? (data.wholesaleSum / data.wholesaleCount) : null;
        }
    }

    // ==========================================
    // RENDERING & VISUALS
    // ==========================================

        renderData() {
        if (!this.map || !this.map.getSource('serviceTerritories')) return;

        // --- 1. Handle Locational View (Reset Colors) ---
        if (this.activePriceType === 'locational') {
            if (this.locationalColorExpression) {
                // Reset Shapes
                this.map.setPaintProperty('serviceTerritoryFill', 'fill-color', this.locationalColorExpression);
                if (this.map.getLayer('serviceTerritoryFill-3d')) {
                    this.map.setPaintProperty('serviceTerritoryFill-3d', 'fill-extrusion-color', this.locationalColorExpression);
                }
                
                // Reset Pins (Reconstructs the match expression for pins using the shape colors)
                if (this.map.getLayer('retailLmpPinsLayer')) {
                    const pinLocationalColors = ['match', ['get', 'service_territory'], ...this.locationalColorExpression.slice(2)];
                    this.map.setPaintProperty('retailLmpPinsLayer', 'circle-color', pinLocationalColors);
                }
            }
            this.updateZoneBorders();
            return;
        }

        // --- 2. Handle Price Heatmap View ---
        
        // A. Color the Retail Shapes
        const retailExpression = ['match', ['get', 'Zone_Code']];
        let hasRetailData = false;
        
        for (const [zoneName, price] of Object.entries(this.retailPrices || {})) {
            if (price !== null) {
                retailExpression.push(zoneName, this.getColorForPrice(price));
                hasRetailData = true;
            }
        }
        retailExpression.push('#cccccc'); // Fallback color

        if (hasRetailData) {
            this.map.setPaintProperty('serviceTerritoryFill', 'fill-color', retailExpression);
            if (this.map.getLayer('serviceTerritoryFill-3d')) {
                this.map.setPaintProperty('serviceTerritoryFill-3d', 'fill-extrusion-color', retailExpression);
            }
        }

        // B. Color the Wholesale Pins
        if (this.map.getLayer('retailLmpPinsLayer')) {
            const wholesaleExpression = ['match', ['get', 'service_territory']];
            let hasWholesaleData = false;
            
            for (const [zoneName, price] of Object.entries(this.wholesalePrices || {})) {
                if (price !== null) {
                    wholesaleExpression.push(zoneName, this.getColorForPrice(price));
                    hasWholesaleData = true;
                }
            }
            wholesaleExpression.push('#ffffff'); // Fallback color for pins with no data

            if (hasWholesaleData) {
                this.map.setPaintProperty('retailLmpPinsLayer', 'circle-color', wholesaleExpression);
            }
        }
        
        this.updateZoneBorders();
    }

    getColorForPrice(price) {
        // Iterate through the 10-step scale. First one it's less than or equal to, it uses.
        for (let i = 0; i < COLOR_SCALE.length; i++) {
            if (price <= COLOR_SCALE[i][0]) {
                return COLOR_SCALE[i][1];
            }
        }
        // If it's higher than the max limit ($300+), return the darkest red
        return COLOR_SCALE[COLOR_SCALE.length - 1][1];
    }

    setPriceType(type) {
        this.activePriceType = type;
        this.calculateZonePrices();
        this.renderData();

        // --- Handle Legend Updates ---
        const legendBox = document.getElementById('legend');
        
        if (type === 'locational') {
            if (legendBox) legendBox.style.display = 'none';
        } else {
            if (legendBox) legendBox.style.display = 'block';
            
            // Dynamically set the title based on the view
            const title = type === 'wholesale' ? "Wholesale Price ($/MWh)" : "Retail Price ($/MWh)";
            
            // Call the UI builder to draw the 10-step legend
            if (typeof buildLegend === 'function') {
                buildLegend(COLOR_SCALE, title);
            }
        }
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
        else if (priceType === 'retail' || priceType === 'price') label = 'Retail Price';
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
            this.currentTimeIndex++;
            this.renderTimeStep(this.currentTimeIndex);
            
            if (this.ui.slider) {
                this.ui.slider.value = this.currentTimeIndex;
            }
        }, this.playbackSpeed);
    }

    renderTimeStep(index) {
        this.currentTimeIndex = index;
        this.renderData();
    }

    renderAverageView() {
        this.calculateZonePrices();
        this.renderData();
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
        if (this.isPlaying) {
            this.runAnimation(); 
        }
    }
}
