import maplibregl from "npm:maplibre-gl";
// 1. Import the new scales from config
import { API_BASE_URL, RETAIL_COLOR_SCALE, WHOLESALE_COLOR_SCALE } from "../utils/config.js";
import { displayCurrentFilter, buildLegend } from "../components/ui.js";

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
        this.locationalColorExpression = null; 

        // Animation State
        this.isPlaying = false;
        this.animationTimer = null;
        this.playbackSpeed = 1000; 
        this.currentTimeIndex = 0;
        this.contourLayer = null; 
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

        if (this.map.getLayer('retailLmpPinsLayer')) {
            this.map.setLayoutProperty('retailLmpPinsLayer', 'visibility', wholesaleVisibility);
        }
    }
    
    calculateZonePrices() {
        if (this.activePriceType === 'locational') return;

        this.retailPrices = {};
        this.wholesalePrices = {};
        const zoneAggregates = {};

        const dataArray = Array.isArray(this.zoneData) ? this.zoneData : (this.zoneData?.data || []);

        if (dataArray.length === 0) {
            console.warn("⚠️ No pricing data found in this.zoneData");
            return;
        }

        console.log(`📥 Processing ${dataArray.length} price data rows`);

        dataArray.forEach(row => {
            const zoneName = row.service_territory ? row.service_territory.trim().toUpperCase() : null;
            if (!zoneName) {
                console.warn("⚠️ Row has no service_territory:", row);
                return;
            }

            if (!zoneAggregates[zoneName]) {
                zoneAggregates[zoneName] = { 
                    retailSum: 0, retailCount: 0, 
                    wholesaleSum: 0, wholesaleCount: 0 
                };
            }

            if (row.retail_price !== null && row.retail_price !== undefined) {
                zoneAggregates[zoneName].retailSum += row.retail_price;
                zoneAggregates[zoneName].retailCount += 1;
            }
            
            if (row.wholesale_price !== null && row.wholesale_price !== undefined) {
                zoneAggregates[zoneName].wholesaleSum += row.wholesale_price;
                zoneAggregates[zoneName].wholesaleCount += 1;
            }
        });

        for (const [zone, data] of Object.entries(zoneAggregates)) {
            this.retailPrices[zone] = data.retailCount > 0 ? (data.retailSum / data.retailCount) : null;
            this.wholesalePrices[zone] = data.wholesaleCount > 0 ? (data.wholesaleSum / data.wholesaleCount) : null;
        }

        console.log("📊 Aggregated zones:", Object.keys(zoneAggregates).length);
        console.log("📊 Zones with retail prices:", Object.keys(this.retailPrices).filter(z => this.retailPrices[z] !== null).length);
        console.log("📊 Zones with wholesale prices:", Object.keys(this.wholesalePrices).filter(z => this.wholesalePrices[z] !== null).length);
        console.log("📊 Retail Prices (¢/kWh):", this.retailPrices);
        console.log("📊 Wholesale Prices (¢/kWh):", this.wholesalePrices);
    }

    // ==========================================
    // RENDERING & VISUALS
    // ==========================================

    renderData() {
        if (!this.map || !this.map.getSource('serviceTerritories')) return;

        if (this.activePriceType === 'locational') {
            if (this.locationalColorExpression) {
                this.map.setPaintProperty('serviceTerritoryFill', 'fill-color', this.locationalColorExpression);
                if (this.map.getLayer('serviceTerritoryFill-3d')) {
                    this.map.setPaintProperty('serviceTerritoryFill-3d', 'fill-extrusion-color', this.locationalColorExpression);
                }
                
                if (this.map.getLayer('retailLmpPinsLayer')) {
                    const pinLocationalColors = ['match', ['get', 'service_territory'], ...this.locationalColorExpression.slice(2)];
                    this.map.setPaintProperty('retailLmpPinsLayer', 'circle-color', pinLocationalColors);
                }
            }
            this.updateZoneBorders();
            return;
        }

        // 2. Build retail expression with price data
        const retailExpression = ['match', ['get', 'Zone_Code']];
        let hasRetailData = false;
        let matchedRetailZones = [];
        
        for (const [zoneName, price] of Object.entries(this.retailPrices || {})) {
            if (price !== null) {
                retailExpression.push(zoneName, this.getColorForPrice(price, 'retail'));
                hasRetailData = true;
                matchedRetailZones.push(zoneName);
            }
        }
        retailExpression.push('#cccccc'); 

        if (hasRetailData) {
            console.log("🎨 Applying Retail Expression to shapes");
            console.log("   Matched zones:", matchedRetailZones);
            console.log("   Expression structure:", retailExpression.slice(0, 5), "...");
            this.map.setPaintProperty('serviceTerritoryFill', 'fill-color', retailExpression);
            if (this.map.getLayer('serviceTerritoryFill-3d')) {
                this.map.setPaintProperty('serviceTerritoryFill-3d', 'fill-extrusion-color', retailExpression);
            }
        } else {
            console.warn("⚠️ No retail price data to apply to shapes");
        }

        // 3. Build wholesale expression with price data
        if (this.map.getLayer('retailLmpPinsLayer')) {
            const wholesaleExpression = ['match', ['get', 'service_territory']];
            let hasWholesaleData = false;
            let matchedWholesaleZones = [];
            
            for (const [zoneName, price] of Object.entries(this.wholesalePrices || {})) {
                if (price !== null) {
                    wholesaleExpression.push(zoneName, this.getColorForPrice(price, 'wholesale'));
                    hasWholesaleData = true;
                    matchedWholesaleZones.push(zoneName);
                }
            }
            wholesaleExpression.push('#ffffff'); 

            if (hasWholesaleData) {
                console.log("📍 Applying Wholesale Expression to pins");
                console.log("   Matched zones:", matchedWholesaleZones);
                console.log("   Expression structure:", wholesaleExpression.slice(0, 5), "...");
                this.map.setPaintProperty('retailLmpPinsLayer', 'circle-color', wholesaleExpression);
            } else {
                console.warn("⚠️ No wholesale price data to apply to pins");
            }
        }
        
        this.updateZoneBorders();
    }

    // 4. Updated to handle the new object-based scales
    getColorForPrice(price, type = 'retail') {
        if (price === null || price === undefined) return '#cccccc';
        
        const scale = type === 'wholesale' ? WHOLESALE_COLOR_SCALE : RETAIL_COLOR_SCALE;

        for (let i = 0; i < scale.length; i++) {
            if (price <= scale[i].threshold) {
                return scale[i].color;
            }
        }
        return scale[scale.length - 1].color;
    }

    // 5. Updated to pass the correct scale to the legend builder
    setPriceType(type) {
        this.activePriceType = type;
        this.calculateZonePrices();
        
        // 🔍 DIAGNOSTIC: Log zone matching
        if (type !== 'locational' && this.map && this.map.getSource('serviceTerritories')) {
            const source = this.map.getSource('serviceTerritories');
            const features = source._data?.features || [];
            const mapZones = new Set(features.map(f => f.properties.Zone_Code).filter(Boolean));
            const priceZones = new Set(
                Object.keys(type === 'wholesale' ? (this.wholesalePrices || {}) : (this.retailPrices || {}))
                    .filter(z => (type === 'wholesale' ? this.wholesalePrices[z] : this.retailPrices[z]) !== null)
            );
            
            const matched = [...mapZones].filter(z => priceZones.has(z));
            const unmatched = [...mapZones].filter(z => !priceZones.has(z));
            const extra = [...priceZones].filter(z => !mapZones.has(z));
            
            console.log(`🔍 Zone Matching for ${type.toUpperCase()}`);
            console.log(`   📍 MAP ZONES (${mapZones.size}):`, Array.from(mapZones).join(", "));
            console.log(`   💰 PRICE DATA ZONES (${priceZones.size}):`, Array.from(priceZones).slice(0, 10).join(", "), priceZones.size > 10 ? `... and ${priceZones.size - 10} more` : "");
            console.log(`   ✓ Matched: ${matched.length}`, matched.join(", "));
            if (unmatched.length > 0) console.log(`   ✗ Map zones with NO price data: ${unmatched.length}`, unmatched.join(", "));
            if (extra.length > 0) console.log(`   ⚠️ Price data zones NOT in map: ${extra.length}`, extra.slice(0, 10).join(", "), extra.length > 10 ? `... and ${extra.length - 10} more` : "");
        }
        
        this.renderData();

        const legendBox = document.getElementById('legend');
        
        if (type === 'locational') {
            if (legendBox) legendBox.style.display = 'block';
            const title = "Locational View";
            if (typeof buildLegend === 'function') {
                buildLegend(null, null, title, {
                    locational: true,
                    zoneColorMap: this.locationalColorMap
                });
            }
        } else {
            if (legendBox) legendBox.style.display = 'block';
            const title = "Price (¢/kWh)";
            if (typeof buildLegend === 'function') {
                buildLegend(RETAIL_COLOR_SCALE, WHOLESALE_COLOR_SCALE, title, {
                    locational: false
                });
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
            // Use the appropriate price data based on active price type
            let price = null;
            if (this.activePriceType === 'retail' && this.retailPrices) {
                price = this.retailPrices[zoneName];
            } else if (this.activePriceType === 'wholesale' && this.wholesalePrices) {
                price = this.wholesalePrices[zoneName];
            }

            const html = this.createZonePopupHTML(zoneName, this.activePriceType, price);
            
            this.popup
                .setLngLat(e.lngLat)
                .setOffset([0, -10]) // Position popup above the cursor
                .setHTML(html)
                .addTo(this.map);
        } else {
            this.map.getCanvas().style.cursor = '';
            this.popup.remove();
        }
    }

    createZonePopupHTML(zoneName, priceType, value) {
        // Convert $/kWh to cents/kWh and format
        const formattedPrice = value !== null ? `${(value * 100).toFixed(1)}¢` : 'N/A';
        
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
    // ANIMATION & TIME CONTROLS
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
