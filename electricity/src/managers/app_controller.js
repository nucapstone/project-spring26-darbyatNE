// src/managers/app_controller.js
// src/managers/app_controller.js

import maplibregl from "npm:maplibre-gl";

import { API_BASE_URL, COLOR_SCALE, NET_COLOR_SCALE } from "../utils/config.js";
import { calculateGlobalStats, calculateZoneAverages } from "../utils/math.js";

import { getColorForLmp } from "../utils/formatters.js"; 
import { 
    renderConstraintList, 
    displayCurrentFilter, 
    setConstraintModeUI, 
    createZonePopupHTML, 
    CONGESTION_POPUP_HTML 
} from "../components/ui.js";

// 1. Import Contour Layer
import { ContourLayer } from "../components/contour.js";

export class MapController {
    constructor(map, uiElements) {
        this.map = map;
        this.ui = uiElements;
        this.interfaces = uiElements.interfaces || []; 
        
        this.timeSeriesData = [];
        this.constraintsData = [];
        this.averageDataCache = {};
        this.globalConstraintCache = [];
        
        this.currentIndex = 0;
        this.playbackSpeed = 1000;
        this.timer = null;
        this.activePriceType = 'da'; 
        this.isAverageMode = false;
        this.selectedZoneName = null;
        
        this.abortController = null;
        
        this.congestionHelpPopup = null;
        this.hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

        // 2. View Mode State
        this.viewMode = '2d'; // '2d', '3d', 'contour'
        this.contourLayer = null;

        // 3. Initialize Contour & Listeners
        this.map.on('load', () => {
             this.contourLayer = new ContourLayer(this.map);
             
             // Try to generate mask if global geojson is available
             if (window.pjmGeoJsonData) {
                 this.contourLayer.generateMaskFromZones(window.pjmGeoJsonData);
             }
        });

        // Bind View Mode Selector
        const viewSelector = document.getElementById('view-mode-selector');
        if (viewSelector) {
            viewSelector.addEventListener('change', (e) => {
                this.setViewMode(e.target.value);
            });
        }
    }

    // 4. Handle View Mode Switching
    setViewMode(mode) {
        this.viewMode = mode;
        console.log("Switching to mode:", mode);

        // Handle 3D Extrusions
        if (this.map.getLayer('zoneFill-3d')) {
            const visibility = mode === '3d' ? 'visible' : 'none';
            this.map.setLayoutProperty('zoneFill-3d', 'visibility', visibility);
        }

        // Handle 2D Fills
        if (this.map.getLayer('zoneFill')) {
            // In contour mode, hide solid fill but keep borders
            const visibility = mode === 'contour' ? 'none' : 'visible';
            this.map.setLayoutProperty('zoneFill', 'visibility', visibility);
        }

        // Handle Contour Layer
        if (this.contourLayer) {
            this.contourLayer.setVisibility(mode === 'contour');
            
            if (mode === 'contour') {
                // Ensure mask is generated
                if (!this.contourLayer.maskGenerated && window.pjmGeoJsonData) {
                    this.contourLayer.generateMaskFromZones(window.pjmGeoJsonData);
                }
                // Force update to draw data immediately
                this.renderCurrentView();
            }
        }
    }

    getZoneValue(zoneName, dataMap) {
        if (!dataMap || !dataMap[zoneName]) return null;
        
        if (this.activePriceType === 'congestion') {
            if (!this.selectedZoneName || !dataMap[this.selectedZoneName]) return null;
            if (zoneName === this.selectedZoneName) return 0;
            
            const loadZonePrice = Number(dataMap[this.selectedZoneName].rt || 0);
            const remoteZonePrice = Number(dataMap[zoneName].rt || 0);
            return loadZonePrice - remoteZonePrice;
        }
        
        return Number(dataMap[zoneName][this.activePriceType]);
    }

    async loadData(filter) {
        this.ui.timeDisplay.innerText = 'Querying Data...';
        this.stopAnimation();

        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        try {
            const cleanDate = (d) => {
                if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) return d;
                return d ? new Date(d).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            };

            const daysBooleans = filter.daysOfWeek || Array(7).fill(true);
            
            const query = {
                start_day: cleanDate(filter.startDate),
                end_day: cleanDate(filter.endDate),
                days_of_week: daysBooleans.map((isActive, index) => isActive ? index + 1 : null).filter(val => val !== null),
                start_hour: parseInt(filter.startTime) || 0,
                end_hour: parseInt(filter.endTime) || 24,
                monitored_facility: filter.selectedConstraint || null
            };

            const response = await fetch(`${API_BASE_URL}/api/lmp/range`, { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true' 
                }, 
                body: JSON.stringify(query),
                signal: this.abortController.signal 
            });
            
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            
            const rawData = await response.json();

            console.log("🔌 API RAW DATA:", rawData);

            // 5. Pass Locations to Contour Layer
            if (rawData.locations && this.contourLayer) {
                this.contourLayer.setLocations(rawData.locations);
            }

            this.constraintsData = rawData.constraints || [];
            let combinedData = {};
            if (rawData.zones) Object.assign(combinedData, rawData.zones);
            if (rawData.interfaces) Object.assign(combinedData, rawData.interfaces);
            
            if (Object.keys(combinedData).length === 0 && !rawData.zones && !rawData.interfaces) {
                combinedData = rawData;
            }

            this.timeSeriesData = transformApiData(combinedData);

            if (window.zonePlotManager && this.timeSeriesData) {
                window.zonePlotManager.updateTimeCursor(null);
                window.zonePlotManager.updateData(this.timeSeriesData);
            }

            this.currentIndex = 0;

            if (!this.timeSeriesData || this.timeSeriesData.length === 0) {
                this.ui.timeDisplay.innerText = 'No Data Found';
                displayCurrentFilter(filter, 0);
                return;
            }

            displayCurrentFilter(filter, this.timeSeriesData.length);
            this.globalConstraintCache = calculateGlobalStats(this.constraintsData, this.timeSeriesData.length);
            this.averageDataCache = calculateZoneAverages(this.timeSeriesData);
            
            this.ui.slider.max = this.timeSeriesData.length - 1;
            this.ui.slider.disabled = false;
            this.ui.playBtn.disabled = false;
            
            this.renderAverageView();

        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error("Fetch Error:", error);
            this.ui.timeDisplay.innerText = 'Data Error';
        }
    }

    renderCurrentView() {
        if (this.isAverageMode) { 
            this.renderAverageView(); 
        } else { 
            this.renderTimeStep(this.currentIndex); 
        }
    }

    updateMapAndSidebar(dataSource) {
        const currentScale = (this.activePriceType === 'net' || this.activePriceType === 'congestion') 
            ? NET_COLOR_SCALE 
            : COLOR_SCALE;

        // 1. Prepare Expressions
        const colorExpression = ['case'];
        const heightExpression = ['case'];
        
        let pjmSum = 0, pjmCount = 0;

        for (const zone in dataSource) {
            const val = this.getZoneValue(zone, dataSource);
            
            if (val !== null && !isNaN(val)) {
                // Color Logic
                colorExpression.push(['==', ['get', 'Zone_Name'], zone], getColorForLmp(val, currentScale));
                // Height Logic
                const heightVal = Math.max(0, val) * 2000; 
                heightExpression.push(['==', ['get', 'Zone_Name'], zone], heightVal);
            }

            if (val !== null && !isNaN(val)) {
                if (this.activePriceType === 'congestion' && zone === this.selectedZoneName) continue;
                pjmSum += val; 
                pjmCount++;
            }
        }
        
        // Defaults
        colorExpression.push('#cccccc');
        heightExpression.push(0);

        // 2. Apply to 2D Layer
        if (this.map.getLayer('zoneFill')) {
            this.map.setPaintProperty('zoneFill', 'fill-color', colorExpression);
        }

        // 3. Apply to 3D Layer
        if (this.map.getLayer('zoneFill-3d')) {
            this.map.setPaintProperty('zoneFill-3d', 'fill-extrusion-color', colorExpression);
            this.map.setPaintProperty('zoneFill-3d', 'fill-extrusion-height', heightExpression);
        }

        // 6. Apply to Contour Layer
        if (this.viewMode === 'contour' && this.contourLayer) {
            this.contourLayer.update(dataSource, this.activePriceType);
        }

        const pjmAvg = pjmCount > 0 ? pjmSum / pjmCount : 0;
        this.updateSidebarPrices((z) => this.getZoneValue(z, dataSource), currentScale, pjmAvg);

        this.updateInterfaceMarkers(dataSource);
    }

    updateInterfaceMarkers(dataSource) {
        if (!this.interfaces.length || !this.map.getSource('pjmInterfaceSource')) return;

        const currentScale = (this.activePriceType === 'net' || this.activePriceType === 'congestion') 
            ? NET_COLOR_SCALE 
            : COLOR_SCALE;

        const updatedFeatures = this.interfaces.map(iface => {
            let val = this.getZoneValue(iface.name, dataSource);
            
            if (val === null || val === undefined) {
                const cleanName = iface.name.toUpperCase();
                const match = Object.keys(dataSource).find(k => k.toUpperCase().trim() === cleanName);
                if (match) {
                    val = this.getZoneValue(match, dataSource);
                }
            }
            
            let color = '#cccccc'; 
            if (val !== null && !isNaN(val)) {
                color = getColorForLmp(val, currentScale);
            }

            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [iface.lon, iface.lat] },
                properties: {
                    ...iface,
                    color: color,
                    price: val
                }
            };
        });

        this.map.getSource('pjmInterfaceSource').setData({
            type: "FeatureCollection",
            features: updatedFeatures
        });
    }

    renderAverageView() {
        this.isAverageMode = true;
        this.ui.timeDisplay.innerText = 'All Filtered Hours';
        
        this.currentIndex = 0; 
        this.ui.slider.value = 0;
        
        if (window.zonePlotManager) {
            window.zonePlotManager.updateTimeCursor(null);
        }
        
        setConstraintModeUI('global');
        renderConstraintList(this.globalConstraintCache, 'Avg $/MWHr');

        this.updateMapAndSidebar(this.averageDataCache);
    }

    renderTimeStep(index) {
        this.isAverageMode = false;
        if (!this.timeSeriesData || !this.timeSeriesData[index]) return;

        this.currentIndex = index;
        this.ui.slider.value = index;
        const data = this.timeSeriesData[index];
        
        let displayDateStr = "Invalid Date";
        if (data.datetime) {
            const match = data.datetime.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
            if (match) {
                const [_, y, m, d, hr, min] = match;
                const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const timeStr = `${parseInt(hr)}:${min}`; 
                displayDateStr = `${dateStr} | ${timeStr}`;
            } else {
                displayDateStr = data.datetime;
            }
        }
        this.ui.timeDisplay.innerText = displayDateStr;
        
        this.updateMapAndSidebar(data.readings);

        if (window.zonePlotManager) {
            window.zonePlotManager.updateTimeCursor(data.datetime);
        }

        setConstraintModeUI('current');
        
        const targetTimeStr = data.datetime.substring(0, 16).replace('T', ' ');
        const activeConstraints = this.constraintsData
            .filter(c => {
                if (!c.timestamp) return false;
                const cTimeStr = c.timestamp.substring(0, 16).replace('T', ' ');
                return cTimeStr === targetTimeStr;
            })
            .map(c => ({ name: c.name || c.monitored_facility, price: Number(c.shadow_price || 0) }))
            .sort((a, b) => a.price - b.price)
            .slice(0, 10);
        
        renderConstraintList(activeConstraints, 'Shadow Price');
    }

    updateSidebarPrices(getValueFn, scale, pjmAvg) {
        document.querySelectorAll('.zone-item').forEach(item => {
            const zName = item.dataset.zoneName;
            const priceSpan = item.querySelector('.zone-price');
            if (!priceSpan) return;
            
            let val;
            if (zName === 'PJM') { 
                val = pjmAvg; 
            } else { 
                val = getValueFn(zName); 
            }
            
            if (val !== null && val !== undefined && !isNaN(val)) {
                priceSpan.innerText = `$${val.toFixed(2)}`;
                priceSpan.style.color = getColorForLmp(val, scale);
            } else {
                priceSpan.innerText = '';
                priceSpan.style.color = '#000';
            }
        });
    }

    updateZoneBorders() {
        const targetZone = this.selectedZoneName || '';
        const isCongestion = this.activePriceType === 'congestion';
        const highlightColor = isCongestion ? '#fff022ff' : '#000000';

        if (this.map.getLayer('zoneLines-selected')) {
            this.map.setPaintProperty('zoneLines-selected', 'line-color', highlightColor);
        }

        if (this.map.getLayer('zoneLines')) {
            this.map.setPaintProperty('zoneLines', 'line-width', [
                'case',
                ['==', ['get', 'Zone_Name'], targetZone],
                5, 1.5
            ]);

            this.map.setPaintProperty('zoneLines', 'line-color', [
                'case',
                ['==', ['get', 'Zone_Name'], targetZone],
                highlightColor, '#000000'   
            ]);
        }

        if (this.congestionHelpPopup) { 
            this.congestionHelpPopup.remove(); 
            this.congestionHelpPopup = null; 
        }

        if (isCongestion && targetZone && targetZone !== 'PJM') {
            const popupNode = document.createElement('div');
            popupNode.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                    <strong style="font-size: 12px; color: #333;">Congestion Info</strong>
                    <span class="close-btn" style="cursor: pointer; font-weight: bold; font-size: 18px; color: #666; line-height: 1;">&times;</span>
                </div>
                <div style="font-size: 12px; color: #444; line-height: 1.4;">
                    ${CONGESTION_POPUP_HTML}
                </div>
            `;

            const closeBtn = popupNode.querySelector('.close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    if (this.congestionHelpPopup) {
                        this.congestionHelpPopup.remove();
                        this.congestionHelpPopup = null;
                    }
                });
            }

            this.congestionHelpPopup = new maplibregl.Popup({ 
                closeButton: false, 
                closeOnClick: false, 
                className: 'congestion-info-popup', 
                maxWidth: '300px' 
            })
            .setLngLat([-72, 37]) 
            .setDOMContent(popupNode) 
            .addTo(this.map);
        }
    }

    handleMapHover(e) {
        if (!e.features[0]) return;
        const props = e.features[0].properties;
        const zoneId = props.Zone_Name;
        const zoneDisplay = props.Zone_FullName || zoneId;
        
        let dataSource = null;
        if (this.isAverageMode) { 
            dataSource = this.averageDataCache; 
        } else if (this.timeSeriesData.length > 0) { 
            const step = this.timeSeriesData[this.currentIndex]; 
            dataSource = step ? step.readings : null; 
        }
        
        const val = this.getZoneValue(zoneId, dataSource);
        this.hoverPopup.setLngLat(e.lngLat).setHTML(createZonePopupHTML(zoneDisplay, this.activePriceType, val)).addTo(this.map);
    }

    handleMapClick(e, allowPopup = true) {
        if (!e.features.length) return;
        const clickedZone = e.features[0].properties.Zone_Name;
        
        const sidebarItem = document.querySelector(`.zone-item[data-zone-name="${clickedZone}"]`);
        if (sidebarItem) sidebarItem.click();

        if (allowPopup) {
            const props = e.features[0].properties;
            const displayName = props.Zone_FullName || props.Zone_Name;
            const content = `
                <div style="text-align:center;">
                    <strong>${displayName}</strong>
                </div>`;
            new maplibregl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(content) 
                .addTo(this.map);
        }
    }

    setPriceType(type) { 
        this.activePriceType = type; 
        this.updateZoneBorders(); 
        this.renderCurrentView(); 
        
        if (window.zonePlotManager) {
            window.zonePlotManager.updatePriceType(type);
        }
    }
    
    setPlaybackSpeed(val) { 
        this.playbackSpeed = 3100 - val; 
        if (this.timer) { 
            clearInterval(this.timer); 
            this.startAnimation(); 
        } 
    }

    startAnimation() { 
        this.ui.playBtn.innerText = 'Pause'; 
        this.timer = setInterval(() => { 
            const nextIndex = this.currentIndex + 1; 
            if (nextIndex >= this.timeSeriesData.length) { 
                this.stopAnimation(); 
            } else { 
                this.renderTimeStep(nextIndex); 
            } 
        }, this.playbackSpeed); 
    }

    stopAnimation() { 
        if (this.timer) { 
            clearInterval(this.timer); 
            this.timer = null; 
        } 
        this.ui.playBtn.innerText = 'Animate Hours'; 
    }

    findIndexForTime(targetDate) {
        if (!targetDate || !this.timeSeriesData.length) return -1;
        const targetTs = new Date(targetDate).getTime();
        
        return this.timeSeriesData.findIndex(d => {
            const ts = new Date(d.datetime.replace(' ', 'T')).getTime();
            return ts >= targetTs;
        });
    }

    togglePlay() { 
        if (this.timer) { 
            this.stopAnimation(); 
        } else { 
            if (this.timeSeriesData.length === 0) return;

            let newIndex = this.currentIndex;
            let rangeStartFound = false;

            if (window.zonePlotManager && typeof window.zonePlotManager.getVisibleRange === 'function') {
                const range = window.zonePlotManager.getVisibleRange(); 
                if (range && range[0] && range[1]) {
                    const startIndex = this.findIndexForTime(range[0]);
                    const endIndex = this.findIndexForTime(range[1]);

                    if (startIndex !== -1) {
                        if (this.currentIndex < startIndex || (endIndex !== -1 && this.currentIndex > endIndex)) {
                            newIndex = startIndex;
                        }
                        rangeStartFound = true;
                    }
                }
            }

            if (!rangeStartFound) {
                const sliderVal = parseInt(this.ui.slider.value);
                if (!isNaN(sliderVal) && sliderVal !== this.currentIndex) {
                    newIndex = sliderVal;
                }
            }

            this.currentIndex = newIndex;

            if (this.currentIndex >= this.timeSeriesData.length - 1) {
                this.currentIndex = 0;
            }
            
            this.renderTimeStep(this.currentIndex);
            this.startAnimation(); 
        } 
    }
}

function transformApiData(apiData) {
    const dataByTimestamp = {};
    
    for (const zoneName in apiData) {
        for (const reading of apiData[zoneName]) {
            const timestamp = reading.datetime_beginning_ept;
            
            if (!dataByTimestamp[timestamp]) {
                dataByTimestamp[timestamp] = { datetime: timestamp, readings: {} };
            }

            const rawVals = reading.lmp_values || {};            
            const cleanName = zoneName.trim();
            
            dataByTimestamp[timestamp].readings[cleanName] = {
                da: rawVals.da !== null ? Number(rawVals.da) : null,
                rt: rawVals.rt !== null ? Number(rawVals.rt) : null,
                net: rawVals.net !== null ? Number(rawVals.net) : null,
                congestion: rawVals.congestion !== null ? Number(rawVals.congestion) : null
            };
        }
    }
    
    return Object.keys(dataByTimestamp).sort().map(ts => dataByTimestamp[ts]);
}