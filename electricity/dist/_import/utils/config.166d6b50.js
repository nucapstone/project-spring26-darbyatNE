// src/utils/config.js

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// export const API_BASE_URL = "https://obvolutive-secondarily-lainey.ngrok-free.dev";
export const API_BASE_URL = "http://localhost:8000";

// --- NEW SCALES ---

// Heat palette: green -> yellow -> orange -> red
const PRICE_COLORS = [
    '#1a9850', // 0: deep green
    '#66bd63', // 1: green
    '#a6d96a', // 2: light green
    '#d9ef8b', // 3: yellow-green
    '#fee08b', // 4: yellow
    '#fdae61', // 5: orange
    '#f46d43', // 6: orange-red
    '#d73027'  // 7: red
];

// Retail fits approximately 0.13 -> 0.28
export const RETAIL_COLOR_SCALE = [
    { threshold: 0.13, color: PRICE_COLORS[0] },
    { threshold: 0.145, color: PRICE_COLORS[1] },
    { threshold: 0.16, color: PRICE_COLORS[2] },
    { threshold: 0.175, color: PRICE_COLORS[3] },
    { threshold: 0.19, color: PRICE_COLORS[4] },
    { threshold: 0.205, color: PRICE_COLORS[5] },
    { threshold: 0.225, color: PRICE_COLORS[6] },
    { threshold: 0.25, color: PRICE_COLORS[7] }
];

// Wholesale fits approximately 0.015 -> 0.038
export const WHOLESALE_COLOR_SCALE = [
    { threshold: 0.015, color: PRICE_COLORS[0] },
    { threshold: 0.018, color: PRICE_COLORS[1] },
    { threshold: 0.021, color: PRICE_COLORS[2] },
    { threshold: 0.024, color: PRICE_COLORS[3] },
    { threshold: 0.027, color: PRICE_COLORS[4] },
    { threshold: 0.03, color: PRICE_COLORS[5] },
    { threshold: 0.034, color: PRICE_COLORS[6] },
    { threshold: 0.038, color: PRICE_COLORS[7] }
];

// --- RETAINED SCALE ---

export const NET_COLOR_SCALE = [
    { threshold: 20,  color: '#8b0000' }, // Deepest Red
    { threshold: 15,  color: '#cc0000' }, // Strong Red
    { threshold: 10,  color: '#ff6666' }, // Light Red
    { threshold: 6,   color: '#ff9999' }, // Medium Pink
    { threshold: 2,   color: '#ffcccc' }, // Light Pink
    { threshold: -2,  color: '#ffffff' }, // White
    { threshold: -6,  color: '#bbdefb' }, // Very Pale Blue
    { threshold: -10, color: '#64b5f6' }, // Light Blue
    { threshold: -15, color: '#1976d2' }, // Medium Blue
    { threshold: -20, color: '#0d47a1' }, // Deep Blue
    { threshold: -Infinity, color: '#000050' } // Black-Blue
];
