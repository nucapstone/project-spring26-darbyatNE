import maplibregl from "npm:maplibre-gl";
// 1. Import the new scales from config
import { API_BASE_URL, RETAIL_COLOR_SCALE, WHOLESALE_COLOR_SCALE, STATIC_DEMO_MODE, DEMO_DATA_PATHS } from "../utils/config.js";
import { displayCurrentFilter, buildLegend } from "../components/ui.js";

function normalizeSnapshotMonths(monthValue) {
    if (!monthValue) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    const list = Array.isArray(monthValue)
        ? monthValue
        : String(monthValue).split(',').map(v => Number(v.trim()));

    // Snapshot payload is month numbers 1-12. UI state uses 0-11.
    return list
        .filter(v => Number.isFinite(v) && v >= 1 && v <= 12)
        .map(v => v - 1);
}

export class MapController {
    constructor(map, uiElements = {}) {
        this.map = map;
        this.ui = uiElements; 

        this.popup = null;
        this.congestionHelpPopup = null;
        this.activeZonePopupContext = null;
        this.pinPopup = null;
        this.activePinPopupContext = null;
        this.buildPinPopupHTML = null;
        
        // Data State
        this.zoneData = [];
        this.zonePrices = {}; 
        this.monthlyFrames = [];
        this.retailPrices = {};
        this.wholesalePrices = {};
        this.retailColorScale = [...RETAIL_COLOR_SCALE];
        this.wholesaleColorScale = [...WHOLESALE_COLOR_SCALE];
        
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
        this.showAverageView = true;
        this.contourLayer = null; 
    }

    async init(map) {
        this.map = map;

        this.popup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: false,  // Must be false — closeOnClick:true self-closes on the creating click
            className: 'zone-hover-popup'
        });
        this.popup.on('close', () => {
            this.activeZonePopupContext = null;
        });

        // Hover: cursor feedback only, no popup
        this.map.on('mousemove', 'serviceTerritoryFill', (e) => this.handleMouseMove(e));
        this.map.on('mouseleave', 'serviceTerritoryFill', () => {
            this.map.getCanvas().style.cursor = '';
        });

        this.map.on('click', 'serviceTerritoryFill', (e) => this.handleMapClick(e));
    }

    // ==========================================
    // DATA LOADING & CALCULATION
    // ==========================================

    async loadData(filter) {
        this.currentFilter = filter;

        if (STATIC_DEMO_MODE) {
            try {
                const response = await fetch(DEMO_DATA_PATHS.priceData);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const snapshot = await response.json();
                this.zoneData = Array.isArray(snapshot.data) ? snapshot.data : [];

                const effectiveFilter = {
                    startYear: snapshot.params?.startYear ?? filter.startYear,
                    endYear: snapshot.params?.endYear ?? filter.endYear,
                    months: normalizeSnapshotMonths(snapshot.params?.months)
                };

                this.currentFilter = effectiveFilter;
                if (typeof displayCurrentFilter === 'function') {
                    displayCurrentFilter(effectiveFilter);
                }

                this.buildMonthlyFrames();
                this.updateDynamicColorScales();
                if (window.zonePlotManager) {
                    window.zonePlotManager.updateFilter(effectiveFilter);
                    window.zonePlotManager.updateData(this.monthlyFrames);
                }
                this.calculateZonePrices();
                this.configureTimeControls();
                this.renderAverageView();
            } catch (error) {
                console.error("Error loading static demo snapshot:", error);
                if (typeof displayCurrentFilter === 'function') {
                    displayCurrentFilter(filter, "Demo snapshot unavailable");
                }
                this.zoneData = [];
                this.monthlyFrames = [];
                this.retailColorScale = [...RETAIL_COLOR_SCALE];
                this.wholesaleColorScale = [...WHOLESALE_COLOR_SCALE];
                if (window.zonePlotManager) {
                    window.zonePlotManager.updateData([]);
                }
                this.configureTimeControls();
                this.renderData();
            }
            return;
        }
        
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

            // Diagnostic: Log what the API returned
            const uniqueMonths = new Set();
            this.zoneData.forEach(row => {
                uniqueMonths.add(`${row.year}-${String(row.month).padStart(2, '0')}`);
            });
            console.log(`📡 API Response: ${this.zoneData.length} rows`);
            console.log(`   Request params:`, result.params);
            console.log(`   Unique month-year combos: ${Array.from(uniqueMonths).sort().join(', ')}`);

            this.buildMonthlyFrames();
            this.updateDynamicColorScales();
            if (window.zonePlotManager) {
                window.zonePlotManager.updateFilter(filter);
                window.zonePlotManager.updateData(this.monthlyFrames);
            }
            this.calculateZonePrices();
            this.configureTimeControls();
            this.renderAverageView();
            
            if (typeof displayCurrentFilter === 'function') {
                displayCurrentFilter(filter);
            }
            
        } catch (error) {
            console.error("Error fetching territory price data:", error);
            if (typeof displayCurrentFilter === 'function') {
                displayCurrentFilter(filter, "Error loading data");
            }
            this.zoneData = [];
            this.monthlyFrames = [];
            this.retailColorScale = [...RETAIL_COLOR_SCALE];
            this.wholesaleColorScale = [...WHOLESALE_COLOR_SCALE];
            if (window.zonePlotManager) {
                window.zonePlotManager.updateData([]);
            }
            this.configureTimeControls();
            this.renderData();
        }
    }

    buildMonthlyFrames() {
        const frameMap = new Map();

        for (const row of this.zoneData) {
            const year = Number(row.year);
            const month = Number(row.month);
            const zoneName = row.service_territory ? row.service_territory.trim().toUpperCase() : null;

            if (!zoneName || Number.isNaN(year) || Number.isNaN(month)) continue;

            const key = `${year}-${String(month).padStart(2, '0')}`;
            if (!frameMap.has(key)) {
                frameMap.set(key, {
                    key,
                    year,
                    month,
                    datetime: new Date(year, month - 1, 1).toISOString(),
                    label: this.formatMonthLabel(year, month),
                    retailPrices: {},
                    wholesalePrices: {}
                });
            }

            const frame = frameMap.get(key);
            frame.retailPrices[zoneName] = row.retail_price ?? null;
            frame.wholesalePrices[zoneName] = row.wholesale_price ?? null;
        }

        this.monthlyFrames = Array.from(frameMap.values()).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });

        // Diagnostic: Log which months are present
        const monthsFound = this.monthlyFrames.map(f => `${f.year}-${String(f.month).padStart(2, '0')}`);
        console.log(`🎬 Monthly Frames Built: ${this.monthlyFrames.length} months`);
        console.log(`   First month: ${this.monthlyFrames[0]?.label}`);
        console.log(`   Last month: ${this.monthlyFrames[this.monthlyFrames.length - 1]?.label}`);
        console.log(`   Months present: ${monthsFound.join(', ')}`);

        this.currentTimeIndex = 0;
    }

    updateDynamicColorScales(useCurrentView = false) {
        let retailValues = [];
        let wholesaleValues = [];

        if (useCurrentView) {
            retailValues = Object.values(this.getCurrentRetailPrices() || {})
                .filter(value => typeof value === 'number' && Number.isFinite(value));

            wholesaleValues = Object.values(this.getCurrentWholesalePrices() || {})
                .filter(value => typeof value === 'number' && Number.isFinite(value));
        } else {
            const dataArray = Array.isArray(this.zoneData) ? this.zoneData : (this.zoneData?.data || []);

            retailValues = dataArray
                .map(row => row?.retail_price)
                .filter(value => typeof value === 'number' && Number.isFinite(value));

            wholesaleValues = dataArray
                .map(row => row?.wholesale_price)
                .filter(value => typeof value === 'number' && Number.isFinite(value));
        }

        this.retailColorScale = this.buildRangeScale(retailValues, RETAIL_COLOR_SCALE);
        this.wholesaleColorScale = this.buildRangeScale(wholesaleValues, WHOLESALE_COLOR_SCALE);

        if (retailValues.length > 0 || wholesaleValues.length > 0) {
            const retailMin = retailValues.length ? Math.min(...retailValues) : null;
            const retailMax = retailValues.length ? Math.max(...retailValues) : null;
            const wholesaleMin = wholesaleValues.length ? Math.min(...wholesaleValues) : null;
            const wholesaleMax = wholesaleValues.length ? Math.max(...wholesaleValues) : null;
            console.log(`🎚️ Dynamic scale ranges (${useCurrentView ? 'current-view' : 'dataset'})`, {
                retail: retailMin !== null ? [retailMin, retailMax] : 'no-data',
                wholesale: wholesaleMin !== null ? [wholesaleMin, wholesaleMax] : 'no-data'
            });
        }
    }

    buildRangeScale(values, fallbackScale) {
        const colors = fallbackScale.map(step => step.color);
        if (!values.length || colors.length === 0) return [...fallbackScale];

        let min = Math.min(...values);
        let max = Math.max(...values);

        if (!Number.isFinite(min) || !Number.isFinite(max)) return [...fallbackScale];

        if (min === max) {
            const pad = Math.max(Math.abs(min) * 0.05, 0.0005);
            min -= pad;
            max += pad;
        }

        const stepSize = (max - min) / (colors.length - 1);
        return colors.map((color, index) => ({
            threshold: min + (stepSize * index),
            color
        }));
    }

    configureTimeControls() {
        if (!this.ui.slider) return;

        if (this.monthlyFrames.length === 0) {
            this.ui.slider.min = 0;
            this.ui.slider.max = 0;
            this.ui.slider.value = 0;
            this.updateTimeDisplay('Ready');
            return;
        }

        this.ui.slider.min = 0;
        this.ui.slider.max = Math.max(this.monthlyFrames.length - 1, 0);
        this.ui.slider.value = this.currentTimeIndex;
        this.updateTimeDisplay(this.monthlyFrames[this.currentTimeIndex].label);
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

        // Wholesale LMP pins should only follow the wholesale checkbox.
        if (this.map.getLayer('retailLmpPinsLayer')) {
            this.map.setLayoutProperty('retailLmpPinsLayer', 'visibility', wholesaleVisibility);
        }
    }
    
    calculateZonePrices() {
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

    getCurrentRetailPrices() {
        if (!this.showAverageView && this.monthlyFrames[this.currentTimeIndex]) {
            return this.monthlyFrames[this.currentTimeIndex].retailPrices;
        }
        return this.retailPrices || {};
    }

    getCurrentWholesalePrices() {
        if (!this.showAverageView && this.monthlyFrames[this.currentTimeIndex]) {
            return this.monthlyFrames[this.currentTimeIndex].wholesalePrices;
        }
        return this.wholesalePrices || {};
    }

    getCurrentContextLabel() {
        if (this.showAverageView) {
            return 'Average over selected period';
        }
        return this.monthlyFrames[this.currentTimeIndex]?.label || null;
    }

    refreshOpenPopups() {
        if (this.activeZonePopupContext && this.popup?.isOpen()) {
            const { zoneName, lngLat } = this.activeZonePopupContext;
            let price = null;

            if (this.activePriceType === 'retail') {
                price = this.getCurrentRetailPrices()?.[zoneName] ?? null;
            } else if (this.activePriceType === 'wholesale') {
                price = this.getCurrentWholesalePrices()?.[zoneName] ?? null;
            }

            const html = this.createZonePopupHTML(zoneName, this.activePriceType, price, this.getCurrentContextLabel());
            this.popup.setLngLat(lngLat).setHTML(html);
        }

        if (this.activePinPopupContext && this.pinPopup?.isOpen() && typeof this.buildPinPopupHTML === 'function') {
            const { coordinates, props } = this.activePinPopupContext;
            const html = this.buildPinPopupHTML(props);
            this.pinPopup.setLngLat(coordinates).setHTML(html);
        }
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
            if (typeof window.refreshZoneListColors === 'function') {
                window.refreshZoneListColors();
            }
            this.refreshLegend();
            this.refreshOpenPopups();
            return;
        }

        // Recompute the scale from the prices currently being shown so the
        // legend range updates whenever the filter or time window changes.
        this.updateDynamicColorScales(true);

        // 2. Build retail expression with price data
        const retailExpression = ['match', ['get', 'Zone_Code']];
        let hasRetailData = false;
        let matchedRetailZones = [];
        
        for (const [zoneName, price] of Object.entries(this.getCurrentRetailPrices())) {
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
            
            for (const [zoneName, price] of Object.entries(this.getCurrentWholesalePrices())) {
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
        if (typeof window.refreshZoneListColors === 'function') {
            window.refreshZoneListColors();
        }
        this.refreshLegend();
        this.refreshOpenPopups();
    }

    // 4. Updated to handle the new object-based scales
    getColorForPrice(price, type = 'retail') {
        if (price === null || price === undefined) return '#cccccc';
        
        const scale = type === 'wholesale' ? this.wholesaleColorScale : this.retailColorScale;

        for (let i = 0; i < scale.length; i++) {
            if (price <= scale[i].threshold) {
                return scale[i].color;
            }
        }
        return scale[scale.length - 1].color;
    }

    refreshLegend() {
        const legendBox = document.getElementById('legend');
        if (!legendBox || typeof buildLegend !== 'function') return;

        legendBox.style.display = 'block';

        if (this.activePriceType === 'locational') {
            buildLegend(null, null, 'Locational View', {
                locational: true,
                zoneColorMap: this.locationalColorMap
            });
            return;
        }

        buildLegend(this.retailColorScale, this.wholesaleColorScale, 'Price (¢/kWh)', {
            locational: false
        });
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
            const activePrices = type === 'wholesale' ? this.getCurrentWholesalePrices() : this.getCurrentRetailPrices();
            const priceZones = new Set(Object.keys(activePrices).filter(z => activePrices[z] !== null));
            
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
        this.refreshLegend();
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
        if (e && e._zonePopupHandled) return;

        // Pin clicks are handled separately in map.js — skip if cursor is over a pin
        const pinFeatures = this.map.queryRenderedFeatures(e.point, { layers: ['retailLmpPinsLayer'] });
        if (pinFeatures.length > 0) return;

        const features = this.map.queryRenderedFeatures(e.point, { 
            layers: ['serviceTerritoryFill', 'serviceTerritoryFill-3d'] 
        });

        if (features.length > 0) {
            const clickedZone = features[0].properties.Zone_Code;
            this.selectedZoneName = clickedZone;
            this.updateZoneBorders();

            // Show zone price popup on click in price view only
            if (this.activePriceType !== 'locational') {
                let price = null;
                if (this.activePriceType === 'retail') {
                    price = this.getCurrentRetailPrices()?.[clickedZone] ?? null;
                } else if (this.activePriceType === 'wholesale') {
                    price = this.getCurrentWholesalePrices()?.[clickedZone] ?? null;
                }
                const contextLabel = this.getCurrentContextLabel();
                const html = this.createZonePopupHTML(clickedZone, this.activePriceType, price, contextLabel);
                this.activeZonePopupContext = { zoneName: clickedZone, lngLat: e.lngLat };
                this.popup
                    .setLngLat(e.lngLat)
                    .setOffset([0, -10])
                    .setHTML(html)
                    .addTo(this.map);
                this.activeZonePopupContext = { zoneName: clickedZone, lngLat: e.lngLat };
                if (e) e._zonePopupHandled = true;
            }
        }
    }

    handleMouseMove(e) {
        // Hover only updates cursor — popups are shown on click
        const pinFeatures = this.map.queryRenderedFeatures(e.point, { layers: ['retailLmpPinsLayer'] });
        if (pinFeatures.length > 0) {
            this.map.getCanvas().style.cursor = 'pointer';
            return;
        }
        const features = this.map.queryRenderedFeatures(e.point, { layers: ['serviceTerritoryFill'] });
        this.map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : '';
    }

    createZonePopupHTML(zoneName, priceType, value, contextLabel = null) {
        // Convert $/kWh to cents/kWh and format
        const formattedPrice = value !== null ? `${(value * 100).toFixed(2)}¢` : 'N/A';
        
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
                ${contextLabel ? `<div style="font-size:11px; color:#666; margin-bottom:4px;"><em>${contextLabel}</em></div>` : ''}
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
        if (this.monthlyFrames.length === 0) {
            this.updateTimeDisplay('No monthly data');
            return;
        }

        this.isPlaying = !this.isPlaying;
        if (this.ui.playBtn) {
            this.ui.playBtn.innerText = this.isPlaying ? 'Pause' : 'Animate Months';
        }
        if (this.isPlaying) {
            this.showAverageView = false;
            this.renderTimeStep(this.currentTimeIndex);
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
            this.ui.playBtn.innerText = 'Animate Months';
        }

        if (this.monthlyFrames[this.currentTimeIndex]) {
            this.updateTimeDisplay(this.monthlyFrames[this.currentTimeIndex].label);
        }
    }

    runAnimation() {
        if (this.animationTimer) clearInterval(this.animationTimer);
        this.animationTimer = setInterval(() => {
            if (this.monthlyFrames.length === 0) return;

            const nextIndex = (this.currentTimeIndex + 1) % this.monthlyFrames.length;
            this.renderTimeStep(nextIndex);
            
            if (this.ui.slider) {
                this.ui.slider.value = this.currentTimeIndex;
            }
        }, this.playbackSpeed);
    }

    renderTimeStep(index) {
        if (this.monthlyFrames.length === 0) {
            this.updateTimeDisplay('Ready');
            return;
        }

        const maxIndex = this.monthlyFrames.length - 1;
        this.currentTimeIndex = Math.max(0, Math.min(index, maxIndex));
        this.showAverageView = false;
        this.updateTimeDisplay(this.monthlyFrames[this.currentTimeIndex].label);
        this.renderData();
    }

    renderAverageView() {
        this.showAverageView = true;
        this.stopAnimation();
        this.updateTimeDisplay(this.getAverageViewLabel());
        this.calculateZonePrices();
        this.renderData();
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
        if (this.isPlaying) {
            this.runAnimation(); 
        }
    }

    formatMonthLabel(year, month) {
        const date = new Date(year, month - 1, 1);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }

    getAverageViewLabel() {
        if (this.monthlyFrames.length === 0) return 'Ready';
        if (this.monthlyFrames.length === 1) return this.monthlyFrames[0].label;

        const first = this.monthlyFrames[0].label;
        const last = this.monthlyFrames[this.monthlyFrames.length - 1].label;
        return `Average: ${first} - ${last}`;
    }

    updateTimeDisplay(label) {
        if (this.ui.timeDisplay) {
            this.ui.timeDisplay.textContent = label;
        }
    }
}
