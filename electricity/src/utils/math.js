// src/utils/math.js

import * as d3 from "npm:d3";

export function calculateGlobalStats(constraintList, totalHours) {
    if (!constraintList || constraintList.length === 0) return [];
    return d3.rollups(
        constraintList,
        (group) => d3.sum(group, d => Number(d.shadow_price) || 0),
        d => d.name
    )
    .map(([name, totalSum]) => ({
        name: name,
        price: totalSum / (totalHours || 1) 
    }))
    .sort((a, b) => a.price - b.price) 
    .slice(0, 10); 
}

export function calculateZoneAverages(timeSeriesData) {
    const sums = {};
    
    timeSeriesData.forEach(step => {
        Object.entries(step.readings).forEach(([zone, values]) => {
            if (!sums[zone]) {
                sums[zone] = { da: 0, rt: 0, net: 0, congestion: 0, count: 0 };
            }
            sums[zone].da += Number(values.da) || 0;
            sums[zone].rt += Number(values.rt) || 0;
            sums[zone].net += Number(values.net) || 0;
            sums[zone].congestion += Number(values.congestion) || 0;
            sums[zone].count++;
        });
    });

    const averages = {};
    Object.keys(sums).forEach(zone => {
        const s = sums[zone];
        if (s.count > 0) {
            averages[zone] = {
                da: s.da / s.count,
                rt: s.rt / s.count,
                net: s.net / s.count,
                congestion: s.congestion / s.count 
            };
        }
    });
    
    return averages;
}

