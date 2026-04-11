import * as d3 from "npm:d3";
import * as turf from "npm:@turf/turf";

export class ContourLayer {
    constructor(map) {
        this.map = map;
        this.sourceId = 'lmp-contours';
        this.layerId = 'lmp-contours-fill';
        this.maskSourceId = 'pjm-mask-source';
        this.maskLayerId = 'pjm-mask-layer';
        
        this.gridWidth = 120; 
        this.gridHeight = 100;
        
        // Latitude 34.0 covers Southern VA/NC (Dominion Zone)
        this.bounds = {
            minLon: -92.0, maxLon: -70.0,
            minLat: 34.0,  maxLat: 43.0
        };

        this.zoneLocations = {}; 
        this.maskGenerated = false;
        
        this.init();
    }

    init() {
        if (this.map.getSource(this.sourceId)) return;

        this.map.addSource(this.sourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        this.map.addSource(this.maskSourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        let beforeId = 'zoneLines';
        if (!this.map.getLayer(beforeId)) {
            const layers = this.map.getStyle().layers;
            const labelLayer = layers.find(l => l.type === 'symbol');
            beforeId = labelLayer ? labelLayer.id : undefined;
        }

        try {
            this.map.addLayer({
                id: this.layerId,
                type: 'fill',
                source: this.sourceId,
                layout: { visibility: 'none' },
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.6,
                    'fill-outline-color': 'transparent'
                }
            }, beforeId);

            this.map.addLayer({
                id: this.maskLayerId,
                type: 'fill',
                source: this.maskSourceId,
                layout: { visibility: 'none' },
                paint: {
                    'fill-color': '#ffffff', 
                    'fill-opacity': 1.0
                }
            }, beforeId);
            
        } catch (e) {
            console.warn("[Contour] Error adding layers:", e);
        }
    }

    setLocations(locations) {
        this.zoneLocations = locations;
    }

    generateMaskFromZones(zoneGeoJSON) {
        if (!zoneGeoJSON || this.maskGenerated) return;

        if (Object.keys(this.zoneLocations).length === 0) {
            zoneGeoJSON.features.forEach(f => {
                const name = f.properties.Zone_Name || f.properties.transact_z || f.properties.zone_name;
                if (name) {
                    const centroid = turf.centroid(f);
                    this.zoneLocations[name] = centroid.geometry.coordinates; 
                }
            });
        }

        try {
            const worldMask = turf.polygon([[
                [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]
            ]]);

            const features = zoneGeoJSON.features.filter(f => 
                f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
            );

            if (features.length > 0) {
                const zonesFC = turf.featureCollection(features);
                const pjmUnion = turf.union(zonesFC);
                if (pjmUnion) {
                    const diffFC = turf.featureCollection([worldMask, pjmUnion]);
                    const maskPoly = turf.difference(diffFC);
                    if (maskPoly) {
                        this.map.getSource(this.maskSourceId).setData(maskPoly);
                        this.maskGenerated = true;
                    }
                }
            }
            this.ensureLayersOrdered();
        } catch (e) {
            console.error("[Contour] Mask Gen Error:", e);
        }
    }

    ensureLayersOrdered() {
        if (this.map.getLayer('zoneLines') && this.map.getLayer(this.layerId)) {
            try {
                this.map.moveLayer(this.layerId, 'zoneLines');
                this.map.moveLayer(this.maskLayerId, 'zoneLines');
            } catch(e) {}
        }
    }

    update(dataMap, priceType = 'da') {
        if (!dataMap) return;

        // 1. Match Points
        const points = [];
        // We still track min/max for the grid generation algorithm, 
        // but coloring will use fixed ranges.
        let minVal = Infinity, maxVal = -Infinity;

        Object.entries(dataMap).forEach(([zone, values]) => {
            let coords = this.zoneLocations[zone] || this.zoneLocations[zone.toUpperCase()];
            if (!coords) {
                 const cleanZone = zone.toUpperCase().trim();
                 const match = Object.keys(this.zoneLocations).find(k => 
                     k.toUpperCase() === cleanZone || k.toUpperCase().includes(cleanZone)
                 );
                 if (match) coords = this.zoneLocations[match];
            }

            if (coords && values) {
                const val = values[priceType];
                if (val !== null && !isNaN(val)) {
                    points.push({ x: coords[0], y: coords[1], v: val });
                    if (val < minVal) minVal = val;
                    if (val > maxVal) maxVal = val;
                }
            }
        });

        if (points.length < 3) return;

        // 2. Grid Generation (IDW)
        const grid = new Array(this.gridWidth * this.gridHeight);
        const lonStep = (this.bounds.maxLon - this.bounds.minLon) / this.gridWidth;
        const latStep = (this.bounds.maxLat - this.bounds.minLat) / this.gridHeight;

        for (let j = 0; j < this.gridHeight; j++) {
            for (let i = 0; i < this.gridWidth; i++) {
                const lon = this.bounds.minLon + (i * lonStep);
                const lat = this.bounds.maxLat - (j * latStep);

                let num = 0, den = 0, minDist = Infinity, closestVal = 0;
                for (const p of points) {
                    const d2 = (lon - p.x) ** 2 + (lat - p.y) ** 2;
                    if (d2 < 0.005) { closestVal = p.v; minDist = 0; break; }
                    const w = 1 / (d2 ** 2);
                    num += w * p.v; den += w;
                }
                
                const val = (minDist === 0) ? closestVal : (num / den);
                grid[j * this.gridWidth + i] = isNaN(val) ? minVal : val;
            }
        }

        // 3. Contour Generation
        // Note: We generate contours based on the ACTUAL data range to ensure shapes exist,
        // but we COLOR them based on the FIXED range.
        let geojsonFeatures = [];
        
        if (Math.abs(maxVal - minVal) < 0.01) {
            geojsonFeatures = [{
                type: "Feature",
                properties: { value: minVal, color: this.getColor(minVal, priceType) },
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [this.bounds.minLon, this.bounds.minLat],
                        [this.bounds.maxLon, this.bounds.minLat],
                        [this.bounds.maxLon, this.bounds.maxLat],
                        [this.bounds.minLon, this.bounds.maxLat],
                        [this.bounds.minLon, this.bounds.minLat]
                    ]]
                }
            }];
        } else {
            // Generate thresholds based on actual data spread for smooth shapes
            const thresholds = d3.range(minVal, maxVal, (maxVal - minVal) / 20);
            const contours = d3.contours()
                .size([this.gridWidth, this.gridHeight])
                .thresholds(thresholds)(grid);

            const transformPolygon = (coordinates) => {
                return coordinates.map(ring => {
                    return ring.map(coord => {
                        const x = coord[0];
                        const y = coord[1];
                        const lon = this.bounds.minLon + (x * lonStep);
                        const lat = this.bounds.maxLat - (y * latStep);
                        return [lon, lat];
                    });
                });
            };

            geojsonFeatures = contours.map(geometry => {
                if (!geometry.coordinates || geometry.coordinates.length === 0) return null;

                const transformedCoords = geometry.coordinates.map(polygon => transformPolygon(polygon));

                const feature = {
                    type: "Feature",
                    properties: {
                        value: geometry.value,
                        color: this.getColor(geometry.value, priceType)
                    },
                    geometry: {
                        type: "MultiPolygon",
                        coordinates: transformedCoords
                    }
                };
                
                return turf.rewind(feature, { reverse: true });
            }).filter(f => f !== null);
        }

        const data = { type: "FeatureCollection", features: geojsonFeatures };
        
        if (this.map.getSource(this.sourceId)) {
            this.map.getSource(this.sourceId).setData(data);
        }
    }

    getColor(value, type) {
        // --- CONFIGURATION MIMIC ---
        // Adjust these to match src/utils/config.js exactly
        const PRICE_MIN = 0;
        const PRICE_MAX = 150; 
        const NET_LIMIT = 100; // Represents +/- 100
        
        // 1. Diverging Scales (Net Load / Congestion)
        if (type === 'net' || type === 'congestion') {
            // Clamp value to -100 to 100
            const clamped = Math.max(-NET_LIMIT, Math.min(NET_LIMIT, value));
            
            // Normalize to 0-1 range (0 = -100, 0.5 = 0, 1 = +100)
            const t = 0.5 + (clamped / (NET_LIMIT * 2));
            
            // Use RdBu (Red-White-Blue). 
            // Usually Blue is Positive (Congestion Credit/High Load) and Red is Negative.
            // 1-t flips it if needed. Standard RdBu: 0=Red, 1=Blue.
            return d3.interpolateRdBu(1 - t); 
        }

        // 2. Standard Prices (DA / RT)
        // Clamp value to 0-150
        const clamped = Math.max(PRICE_MIN, Math.min(PRICE_MAX, value));
        
        // Normalize to 0-1
        const t = (clamped - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
        
        // Use Turbo (Blue -> Green -> Yellow -> Red)
        // This is the standard "Rainbow" heatmap for prices
        return d3.interpolateTurbo(t);
    }

    setVisibility(isVisible) {
        const val = isVisible ? 'visible' : 'none';
        if (this.map.getLayer(this.layerId)) {
            this.map.setLayoutProperty(this.layerId, 'visibility', val);
        }
        if (this.map.getLayer(this.maskLayerId)) {
            this.map.setLayoutProperty(this.maskLayerId, 'visibility', val);
        }
    }
}