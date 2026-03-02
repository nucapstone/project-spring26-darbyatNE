// src/managers/app_controller.js

import maplibregl from "maplibre-gl";
import { API_BASE_URL } from "../utils/config.js";
import { displayCurrentFilter } from "../components/ui.js";

// Ensure this class is exported exactly as 'MapController'
export class MapController {
    constructor() {
        this.map = null;
        this.popup = null;
        this.congestionHelpPopup = null;
        
        // Data State
        this.zoneData = [];
        this.zonePrices = {}; 
        
        // Filter State
        this.currentFilter = {};
        this.activePriceType = 'rt'; 
        this.selectedZoneName = 'PJM'; 
    }

    async init(map) {
        this.map = map;

        this.popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'zone-hover-popup'
        });

        this.map.on('mousemove', 'zone-fill', (e) => this.handleMouseMove(e));
        this.map.on('mouseleave', 'zone-fill', () => {
            this.map.getCanvas().style.cursor = '';
            this.popup.remove();
        });
        
        this.map.on('click', 'zone-fill', (e) => this.handleMapClick(e));
    }

    async loadData(filter) {
        this.currentFilter = filter;
        
        // GUARD CLAUSE: Prevent API call if dates are missing
        if (!filter.startDate || !filter.endDate) {
            console.warn("MapController: Missing dates in filter, skipping API load.");
            displayCurrentFilter(filter, 0);
            return;
        }

        displayCurrentFilter(filter, "Loading...");

        // ---------------------------------------------------------
        // 🛑 TEMPORARY: API Call Silenced for Monthly Refactor
        // ---------------------------------------------------------
        console.warn("⚠️ API Call temporarily disabled in MapController.loadData (Pending Monthly Price Logic)");
        
        // Reset data to empty to prevent UI errors
        this.zoneData = [];
        this.calculateZonePrices();
        this.renderData();
        
        // Update UI to show "ready" state (but with no data)
        displayCurrentFilter(filter, null);
        
        return;   
    }

    calculateZonePrices() {
        this.zonePrices = {};

        if (this.activePriceType === 'congestion') {
            const refZone = this.zoneData.find(z => z.name === this.selectedZoneName);
            const refPrice = refZone ? refZone.price : 0;

            this.zoneData.forEach(zone => {
                this.zonePrices[zone.name] = zone.price - refPrice;
            });
        } else {
            this.zoneData.forEach(zone => {
                this.zonePrices[zone.name] = zone.price;
            });
        }
    }

    renderData() {
        if (!this.map || !this.map.getSource('zones')) return;

        const expression = ['match', ['get', 'Zone_Name']];
        const values = Object.values(this.zonePrices);
        
        // Handle case with no data
        if (values.length === 0) {
            // If no data, reset to default grey
            this.map.setPaintProperty('zone-fill', 'fill-color', '#ccc');
            return;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        
        for (const [zoneName, price] of Object.entries(this.zonePrices)) {
            expression.push(zoneName);
            expression.push(this.getColorForPrice(price, min, max));
        }

        expression.push('#ccc'); 

        this.map.setPaintProperty('zone-fill', 'fill-color', expression);
        this.updateZoneBorders();
    }

    getColorForPrice(price, min, max) {
        if (price < 0) return '#4575b4'; 
        if (price === 0) return '#ffffbf'; 
        return '#d73027'; 
    }

    updateZoneBorders() {
        const targetZone = this.selectedZoneName || '';
        const isCongestion = this.activePriceType === 'congestion';
        const highlightColor = isCongestion ? '#fff022' : '#000000'; 

        if (this.map.getLayer('zone-line')) {
            this.map.setPaintProperty('zone-line', 'line-width', [
                'case',
                ['==', ['get', 'Zone_Name'], targetZone],
                4, 1
            ]);

            this.map.setPaintProperty('zone-line', 'line-color', [
                'case',
                ['==', ['get', 'Zone_Name'], targetZone],
                highlightColor, '#444'
            ]);
        }

        if (this.congestionHelpPopup) { 
            this.congestionHelpPopup.remove(); 
            this.congestionHelpPopup = null; 
        }

        if (isCongestion && targetZone) {
            const popupNode = document.createElement('div');
            popupNode.innerHTML = `
                <div class="congestion-popup-content" style="padding: 10px; max-width: 250px; font-family: sans-serif;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong style="color: #d63384;">Load Congestion View</strong>
                        <span class="close-btn" style="cursor: pointer; font-weight: bold;">&times;</span>
                    </div>
                    <div style="font-size: 12px; color: #333;">
                        The <span style="background-color: #fff022; padding: 0 2px;">Yellow Bordered Zone</span> is the selected Load Zone.<br>
                        Prices displayed are the cost to "deliver" from each zone to the selected Load Zone.
                    </div>
                </div>
            `;

            popupNode.querySelector('.close-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.congestionHelpPopup) {
                    this.congestionHelpPopup.remove();
                    this.congestionHelpPopup = null;
                }
            });

            this.congestionHelpPopup = new maplibregl.Popup({ 
                closeButton: false, 
                closeOnClick: false, 
                className: 'congestion-info-popup',
                anchor: 'top-left'
            })
            .setLngLat([-79, 41]) 
            .setDOMContent(popupNode) 
            .addTo(this.map);
        }
    }

    handleMapClick(e) {
        const features = this.map.queryRenderedFeatures(e.point, { layers: ['zone-fill'] });
        if (features.length > 0) {
            const clickedZone = features[0].properties.Zone_Name;
            this.selectedZoneName = clickedZone;
            
            if (this.activePriceType === 'congestion') {
                this.calculateZonePrices();
                this.renderData();
            } else {
                this.updateZoneBorders();
            }
        }
    }

    handleMouseMove(e) {
        const features = this.map.queryRenderedFeatures(e.point, { layers: ['zone-fill'] });
        
        if (features.length > 0) {
            this.map.getCanvas().style.cursor = 'pointer';
            
            const zoneName = features[0].properties.Zone_Name;
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

    handleMapHover(event) {
        const feature = event.features[0];
        if (feature) {
            console.log(`Hovered over: ${feature.properties.Zone_Code}`);
        }
    }

    // setPriceMode(mode) {
    //     this.activePriceType = mode;
        
    //     if (mode === 'congestion' && !this.selectedZoneName) {
    //         this.selectedZoneName = 'PJM';
    //     }

    //     if (mode === 'congestion' || mode === 'net') {
    //         this.calculateZonePrices();
    //         this.renderData();
    //     } else {
    //         this.loadData(this.currentFilter);
    //     }
    // }

    createZonePopupHTML(zoneName, priceType, value) {
        const formattedPrice = value !== null ? `$${value.toFixed(2)}` : 'N/A';
        let label = priceType;
        if (priceType === 'rt') label = 'Real-Time';
        if (priceType === 'ws') label = 'Wholesale';
        if (priceType === 'net') label = 'Net Price';

    
        return `
            <div class="zone-popup-content" style="font-family: sans-serif; padding: 5px;">
                <strong class="zone-popup-header" style="display:block; margin-bottom:4px; font-size:13px;">${zoneName}</strong>
                <div style="font-size:12px;">
                    <span class="zone-popup-label" style="color:#666;">${label}:</span> 
                    <span class="zone-popup-value" style="font-weight:bold; color:#007bff;">${formattedPrice}</span>
                </div>
            </div>
        `;
    }
}
